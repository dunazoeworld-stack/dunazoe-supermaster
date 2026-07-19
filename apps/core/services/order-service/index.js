// ================================================================
// DUNAZOE OS — ORDER SERVICE
// services/order-service/index.js
// Port: 4006
//
// CTO RULE — ORDER FLOW (NEVER BREAK THIS):
//   1. Validate input
//   2. Call Fraud Service → block if HIGH_RISK
//   3. Call Inventory Service → reserve stock
//   4. Save order to DB
//   5. Call Escrow Service → hold funds
//   6. Return order + escrow to client
//
// CTO RULE — CANCELLATION FLOW:
//   1. Call Inventory Service → release reserved stock
//   2. Call Escrow Service → refund if already held
//   3. Update order status → cancelled
//
// ❌ NEVER reduce stock before step 4 (payment intent)
// ❌ NEVER release escrow before delivery confirmation
// ================================================================

require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const axios    = require("axios");
const { Pool } = require("pg");
const { requireAuth } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");

const app  = express();
const PORT = process.env.PORT || 4006;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Service URLs
const FRAUD_URL     = process.env.FRAUD_SERVICE_URL     || "http://localhost:4008";
const INVENTORY_URL = process.env.INVENTORY_SERVICE_URL || "http://localhost:4005";
const ESCROW_URL    = process.env.ESCROW_SERVICE_URL    || "http://localhost:4007";
const PRODUCT_URL   = process.env.PRODUCT_SERVICE_URL   || "http://localhost:4004";

const PLATFORM_FEE = parseFloat(process.env.PLATFORM_FEE_PCT || "0.10");
const AI_FEE       = parseFloat(process.env.AI_FEE_PCT       || "0.015");

// SW Nigeria cities — same-city deliveries use self-pickup
const SW_SELF_PICKUP = [
  "ibadan","osogbo","ile-ife","akure","owo","ore","ondo",
  "abeokuta","ado-ekiti","ijebu-ode",
];

// ── HEALTH ────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ service: "order-service", status: "ok", port: PORT });
});

// ── CREATE ORDER ──────────────────────────────────────────────
/**
 * POST /orders
 * Auth: Required
 * Body: {
 *   product_id, quantity, payment_type,
 *   delivery_address, dest_city?,
 *   ref_code?,        ← copytrader referral
 *   ai_assisted?,
 *   notes?
 * }
 *
 * Full orchestrated flow:
 *   fraud check → reserve stock → save order → hold escrow
 */
app.post("/orders", requireAuth, asyncHandler(async (req, res) => {
  const {
    product_id, quantity = 1, payment_type = "full",
    delivery_address, dest_city,
    ref_code, ai_assisted = false, notes
  } = req.body;

  const customer_id = req.user.id;
  const ip          = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  // ── VALIDATE INPUT ────────────────────────────────────────
  if (!product_id || !delivery_address) {
    return res.status(400).json({
      success: false,
      error:   "product_id and delivery_address are required"
    });
  }
  if (parseInt(quantity) <= 0) {
    return res.status(400).json({ success: false, error: "quantity must be at least 1" });
  }

  // ── BLOCK CASH PAYMENT ────────────────────────────────────
  if (payment_type === "cash") {
    return res.status(400).json({
      success: false,
      error:   "❌ Cash payments not accepted. Use: full, thrift, split_50, on_delivery (card/transfer only), wallet"
    });
  }

  // ── FETCH PRODUCT ─────────────────────────────────────────
  let product;
  try {
    const prod_res = await axios.get(`${PRODUCT_URL}/products/${product_id}`);
    product        = prod_res.data.product;
  } catch (err) {
    return res.status(404).json({ success: false, error: "Product not found" });
  }

  if (!product.is_active) {
    return res.status(400).json({ success: false, error: "Product is no longer available" });
  }

  const vendor_id  = product.vendor_id;
  const unit_price = parseFloat(product.price);
  const amount     = parseFloat((unit_price * parseInt(quantity)).toFixed(2));

  // ── STEP 1: FRAUD CHECK ───────────────────────────────────
  let fraud_result;
  try {
    const fraud_res = await axios.post(`${FRAUD_URL}/fraud/check`, {
      user_id: customer_id,
      amount,
      quantity: parseInt(quantity),
      ip_address: ip,
      product_id,
      referrer_id: ref_code ? await _resolve_ref_code(ref_code) : null,
    });
    fraud_result = fraud_res.data;
  } catch (err) {
    // Fraud service down — log and allow (fail open for UX, log for review)
    console.error("Fraud service unavailable — proceeding with caution:", err.message);
    fraud_result = { risk_level: "suspicious", decision: "flag", allowed: true };
  }

  if (!fraud_result.allowed) {
    return res.status(403).json({
      success:     false,
      error:       fraud_result.message || "Order blocked by fraud detection",
      risk_level:  fraud_result.risk_level,
      rules_fired: fraud_result.rules_fired,
    });
  }

  // ── STEP 2: RESERVE STOCK ────────────────────────────────
  let inventory_result;
  try {
    const inv_res = await axios.post(`${INVENTORY_URL}/inventory/reserve`, {
      product_id,
      quantity: parseInt(quantity),
      order_ref: `ORDER_TEMP_${Date.now()}`,
    });
    inventory_result = inv_res.data;
  } catch (err) {
    const msg = err.response?.data?.error || "Stock reservation failed";
    return res.status(409).json({ success: false, error: msg });
  }

  // ── STEP 3: SAVE ORDER ───────────────────────────────────
  const platform_fee = parseFloat((amount * PLATFORM_FEE).toFixed(2));
  const ai_fee_amt   = ai_assisted ? parseFloat((amount * AI_FEE).toFixed(2)) : 0;

  // Determine inter-location
  const vendor_city = (product.city || "").toLowerCase().trim();
  const buyer_city  = (dest_city    || "").toLowerCase().trim();
  const is_inter    = vendor_city && buyer_city && vendor_city !== buyer_city;
  const is_self_pickup = !is_inter && SW_SELF_PICKUP.includes(vendor_city);

  // Resolve referrer
  const referrer_id = ref_code ? await _resolve_ref_code(ref_code) : null;

  let order;
  try {
    const result = await pool.query(
      `INSERT INTO orders(
         customer_id, vendor_id, product_id, quantity,
         unit_price, amount, payment_type,
         delivery_address, dest_city, source_city,
         is_inter_location, is_self_pickup,
         platform_fee, ai_assisted,
         fraud_status, referrer_id, ref_code, notes
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        customer_id, vendor_id, product_id, parseInt(quantity),
        unit_price, amount, payment_type,
        delivery_address, buyer_city || null, vendor_city || null,
        is_inter, is_self_pickup,
        platform_fee, ai_assisted,
        fraud_result.risk_level, referrer_id, ref_code || null,
        notes || null
      ]
    );
    order = result.rows[0];
  } catch (err) {
    // Order save failed — release reserved stock
    await axios.post(`${INVENTORY_URL}/inventory/release`, {
      product_id, quantity: parseInt(quantity), order_ref: "ROLLBACK"
    }).catch(() => {});
    throw err;
  }

  // Update inventory reservation with real order ID
  await pool.query(
    "INSERT INTO inventory_movements(product_id, vendor_id, type, quantity, reference, note) VALUES($1,$2,$3,$4,$5,$6)",
    [product_id, vendor_id, "reserve", parseInt(quantity), `ORD-${order.id}`, "Reserved for confirmed order"]
  ).catch(() => {});

  // ── STEP 4: CREATE ESCROW ─────────────────────────────────
  let escrow;
  try {
    const esc_res = await axios.post(`${ESCROW_URL}/escrow`, {
      order_id:       order.id,
      amount,
      has_agent:      is_inter,      // 2% commission applies
      has_copytrader: !!referrer_id, // 6% copytrader commission
    });
    escrow = esc_res.data;
  } catch (err) {
    // Escrow failed — release stock and cancel order
    await axios.post(`${INVENTORY_URL}/inventory/release`, {
      product_id, quantity: parseInt(quantity), order_ref: `ORD-${order.id}`
    }).catch(() => {});
    await pool.query("UPDATE orders SET status='cancelled' WHERE id=$1", [order.id]);
    return res.status(502).json({
      success: false,
      error:   "Payment hold failed. Order cancelled and stock released. Please try again."
    });
  }

  // ── COPYTRADER REFERRAL RECORD ────────────────────────────
  if (referrer_id) {
    await pool.query(
      `INSERT INTO referrals(product_id, referrer_id, buyer_id, order_id, ref_code, commission, commission_pct)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        product_id, referrer_id, customer_id, order.id, ref_code,
        escrow.breakdown?.copytrader_commission || 0, 0.06
      ]
    ).catch(() => {});
  }

  return res.status(201).json({
    success:      true,
    order_id:     order.id,
    order: {
      id:            order.id,
      status:        "pending",
      amount,
      payment_type,
      fraud_status:  fraud_result.risk_level,
      is_inter_location: is_inter,
      is_self_pickup,
      delivery_method: is_self_pickup ? "Collect from vendor" : is_inter ? "Shipbubble courier" : "Local delivery agent",
    },
    escrow: {
      status:         "held",
      amount,
      vendor_net:     escrow.breakdown?.vendor_net,
      platform_fee:   escrow.breakdown?.platform_fee,
      agent_commission: escrow.breakdown?.agent_commission,
      copytrader_commission: escrow.breakdown?.copytrader_commission,
    },
    next_step: `Pay via Paystack: dunazoe.com/pay/${order.id}`,
  });
}));

// ── GET ORDER BY ID ───────────────────────────────────────────
app.get("/orders/:id", requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT o.*,
            p.name product_name, p.images,
            v.business_name store_name, v.city vendor_city, v.phone vendor_phone,
            u.name customer_name, u.phone customer_phone
     FROM orders o
     JOIN products p ON o.product_id = p.id
     JOIN vendors  v ON o.vendor_id  = v.id
     JOIN users    u ON o.customer_id= u.id
     WHERE o.id = $1`,
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: "Order not found" });
  }

  const order = result.rows[0];

  // Security: only customer, vendor owner, or admin can see order
  const is_customer = order.customer_id === req.user.id;
  const is_admin    = req.user.role === "admin";

  // Check if user owns the vendor
  const vendor_check = await pool.query(
    "SELECT user_id FROM vendors WHERE id=$1", [order.vendor_id]
  );
  const is_vendor_owner = vendor_check.rows[0]?.user_id === req.user.id;

  if (!is_customer && !is_vendor_owner && !is_admin) {
    return res.status(403).json({ success: false, error: "Access denied" });
  }

  // Get escrow status
  const escrow = await pool.query("SELECT * FROM escrow WHERE order_id=$1", [req.params.id]);

  return res.json({
    success: true,
    order,
    escrow:  escrow.rows[0] || null,
    tracking_stages: ["pending","confirmed","ready","shipped","delivered"],
  });
}));

// ── GET MY ORDERS (customer) ──────────────────────────────────
app.get("/orders/my/list", requireAuth, asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page)-1)*parseInt(limit);

  let q = `SELECT o.*, p.name product_name, v.business_name
           FROM orders o
           JOIN products p ON o.product_id=p.id
           JOIN vendors v ON o.vendor_id=v.id
           WHERE o.customer_id=$1`;
  const v = [req.user.id];
  if (status) { q += " AND o.status=$2"; v.push(status); }
  q += ` ORDER BY o.created_at DESC LIMIT $${v.length+1} OFFSET $${v.length+2}`;
  v.push(parseInt(limit), offset);

  const result = await pool.query(q, v);
  const count  = await pool.query("SELECT COUNT(*) c FROM orders WHERE customer_id=$1", [req.user.id]);

  return res.json({
    success: true,
    orders:  result.rows,
    total:   parseInt(count.rows[0].c),
    page:    parseInt(page),
  });
}));

// ── GET VENDOR ORDERS ─────────────────────────────────────────
app.get("/orders/vendor/:vendor_id", requireAuth, asyncHandler(async (req, res) => {
  const { vendor_id } = req.params;
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page)-1)*parseInt(limit);

  // Check ownership
  const v_check = await pool.query("SELECT user_id FROM vendors WHERE id=$1", [vendor_id]);
  if (!v_check.rows[0] || (v_check.rows[0].user_id !== req.user.id && req.user.role !== "admin")) {
    return res.status(403).json({ success: false, error: "Access denied" });
  }

  let q = `SELECT o.*, p.name product_name, u.name customer_name, u.phone customer_phone
           FROM orders o
           JOIN products p ON o.product_id=p.id
           JOIN users u ON o.customer_id=u.id
           WHERE o.vendor_id=$1`;
  const vals = [parseInt(vendor_id)];
  if (status) { q += " AND o.status=$2"; vals.push(status); }
  q += ` ORDER BY o.created_at DESC LIMIT $${vals.length+1} OFFSET $${vals.length+2}`;
  vals.push(parseInt(limit), offset);

  const result = await pool.query(q, vals);
  return res.json({ success: true, orders: result.rows });
}));

// ── UPDATE ORDER STATUS ───────────────────────────────────────
/**
 * PUT /orders/:id/status
 * Auth: vendor (for their orders) or admin
 * Body: { status, tracking_status?, delivery_photo? }
 */
app.put("/orders/:id/status", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, tracking_status, delivery_photo } = req.body;

  const VALID_STATUSES = ["pending","fraud_review","reserved","paid","processing",
                           "shipped","delivered","cancelled","disputed","refunded"];
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false, error: `Invalid status. Valid: ${VALID_STATUSES.join(", ")}`
    });
  }

  // Delivery photo required for 'delivered' status
  if (status === "delivered" && !delivery_photo) {
    return res.status(400).json({
      success: false,
      error:   "Delivery photo proof required to mark as delivered"
    });
  }

  const result = await pool.query(
    `UPDATE orders SET
       status           = $1,
       tracking_status  = COALESCE($2, tracking_status),
       delivery_photo   = COALESCE($3, delivery_photo),
       updated_at       = NOW()
     WHERE id = $4
     RETURNING *`,
    [status, tracking_status || null, delivery_photo || null, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: "Order not found" });
  }

  const order = result.rows[0];

  // Auto-release escrow when delivered + schedule 5% vendor payout deduction (24h delay)
  if (status === "delivered") {
    try {
      const escrow = await pool.query("SELECT id FROM escrow WHERE order_id=$1 AND status='held'", [id]);
      if (escrow.rows[0]) {
        await axios.post(`${ESCROW_URL}/escrow/${escrow.rows[0].id}/release`).catch(() => {});
      }
      // Confirm sale in inventory (actually deduct stock)
      await axios.post(`${INVENTORY_URL}/inventory/confirm`, {
        product_id: order.product_id,
        quantity:   order.quantity,
        order_ref:  `ORD-${id}`,
      }).catch(() => {});

      // ── SCHEDULE 5% service charge deduction from vendor payout (24h delay) ──
      // The 5% is on the product amount (order.amount), not delivery fee.
      const SERVICE_CHARGE_PCT = parseFloat(process.env.SERVICE_CHARGE_PCT || "0.05");
      const service_charge_amt = parseFloat((order.amount * SERVICE_CHARGE_PCT).toFixed(2));
      const payout_net         = parseFloat((order.amount - service_charge_amt).toFixed(2));
      const payout_at          = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      // Record the scheduled payout in vendor_payouts table (created if not exists)
      await pool.query(
        `INSERT INTO vendor_payouts(
           vendor_id, order_id, gross_amount, service_charge, net_amount,
           service_charge_pct, status, scheduled_at, note
         ) VALUES($1,$2,$3,$4,$5,$6,'scheduled',$7,$8)
         ON CONFLICT (order_id) DO UPDATE SET
           status='scheduled', scheduled_at=$7, updated_at=NOW()`,
        [
          order.vendor_id, id,
          order.amount, service_charge_amt, payout_net,
          SERVICE_CHARGE_PCT, payout_at,
          `Auto-scheduled: 5% service charge (₦${service_charge_amt}) deducted. Net payout ₦${payout_net} on ${payout_at.toISOString()}`
        ]
      ).catch(err => {
        // Table may not exist yet — log and skip (non-fatal)
        console.warn("[order-service] vendor_payouts insert skipped:", err.message);
      });

      console.log(`[order-service] Vendor payout scheduled: ORD-${id} → vendor ${order.vendor_id} gets ₦${payout_net} at ${payout_at.toISOString()} (5% deducted: ₦${service_charge_amt})`);
    } catch (err) {
      console.error("[order-service] Post-delivery hook error:", err.message);
    }
  }

  return res.json({ success: true, order: result.rows[0] });
}));

// ── CANCEL ORDER ──────────────────────────────────────────────
/**
 * POST /orders/:id/cancel
 * Releases reserved stock. Refunds escrow if held.
 */
app.post("/orders/:id/cancel", requireAuth, asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const order_res = await pool.query("SELECT * FROM orders WHERE id=$1", [req.params.id]);

  if (!order_res.rows[0]) {
    return res.status(404).json({ success: false, error: "Order not found" });
  }
  const order = order_res.rows[0];

  if (!["pending","reserved","paid"].includes(order.status)) {
    return res.status(400).json({
      success: false,
      error:   `Cannot cancel order with status: ${order.status}`
    });
  }

  // Security check
  if (order.customer_id !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ success: false, error: "Not your order" });
  }

  // Release stock
  await axios.post(`${INVENTORY_URL}/inventory/release`, {
    product_id: order.product_id,
    quantity:   order.quantity,
    order_ref:  `CANCEL-${order.id}`,
  }).catch(() => {});

  // Refund escrow
  const escrow = await pool.query(
    "SELECT id FROM escrow WHERE order_id=$1 AND status IN ('held','locked')", [order.id]
  );
  if (escrow.rows[0]) {
    await axios.post(`${ESCROW_URL}/escrow/${escrow.rows[0].id}/refund`, {
      reason: reason || "Customer cancelled"
    }).catch(() => {});
  }

  await pool.query(
    "UPDATE orders SET status='cancelled', updated_at=NOW() WHERE id=$1", [order.id]
  );

  return res.json({
    success: true,
    message: "Order cancelled. Stock released. Refund queued.",
    reason:  reason || "Customer request",
  });
}));

// ── HELPER: Resolve ref_code to vendor ID ──────────────────────
async function _resolve_ref_code(ref_code) {
  if (!ref_code) return null;
  try {
    const result = await pool.query(
      "SELECT id FROM vendors WHERE shareable_link LIKE $1 LIMIT 1",
      [`%${ref_code}%`]
    );
    return result.rows[0]?.id || null;
  } catch (_) { return null; }
}

app.use(errorHandler);
app.listen(PORT, () => console.log(`✅ Order Service running on port ${PORT}`));
module.exports = app;
