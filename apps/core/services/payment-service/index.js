// ================================================================
// DUNAZOE OS — PAYMENT SERVICE
// services/payment-service/index.js
// Port: 4015
//
// Phase 5: Paystack (NGN) + Stripe (USD)
//
// FLOW:
//   Client places order → gets order_id
//   Client calls POST /payments/initialize → gets payment URL
//   Client redirects to Paystack/Stripe → pays
//   Paystack calls POST /payments/webhook → we confirm
//   Webhook handler:
//     → verify signature (CRITICAL)
//     → confirm inventory (stock deducted)
//     → confirm escrow (mark as paid)
//     → notify vendor via WhatsApp
//     → notify customer
//
// CTO RULES:
//   ❌ NEVER trust the client to confirm payment
//   ✅ ALWAYS verify webhook signature before processing
//   ✅ ALWAYS use idempotency (duplicate webhooks are normal)
//   ✅ Log every webhook event — even ones we don't handle
// ================================================================

require("dotenv").config();

const express   = require("express");
const cors      = require("cors");
const crypto    = require("crypto");
const axios     = require("axios");
const { Pool }  = require("pg");
const { requireAuth } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");

const app  = express();
const PORT = process.env.PORT || 4015;

// ── IMPORTANT: raw body needed for webhook signature verification ──
app.use("/payments/webhook", express.raw({ type: "application/json" }));
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Service URLs
const INVENTORY_URL  = process.env.INVENTORY_SERVICE_URL  || "http://localhost:4005";
const ESCROW_URL     = process.env.ESCROW_SERVICE_URL     || "http://localhost:4007";
const WALLET_URL     = process.env.WALLET_SERVICE_URL     || "http://localhost:4009";
const ORDER_URL      = process.env.ORDER_SERVICE_URL      || "http://localhost:4006";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY   || "";
const STRIPE_SECRET   = process.env.STRIPE_SECRET_KEY     || "";
const PAYSTACK_BASE   = "https://api.paystack.co";

// ── HEALTH ────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    service:  "payment-service",
    status:   "ok",
    port:     PORT,
    providers:{
      paystack: PAYSTACK_SECRET ? "configured" : "⚠️ PAYSTACK_SECRET_KEY not set",
      stripe:   STRIPE_SECRET   ? "configured" : "⚠️ STRIPE_SECRET_KEY not set (USD only)",
    },
  });
});

// ── INITIALIZE PAYMENT ────────────────────────────────────────
/**
 * POST /payments/initialize
 * Auth: Required
 * Body: { order_id, currency? }
 *
 * Returns a payment URL that the client redirects to.
 * NGN → Paystack
 * USD → Stripe (phase 5b)
 */
app.post("/payments/initialize", requireAuth, asyncHandler(async (req, res) => {
  const { order_id, currency = "NGN" } = req.body;

  if (!order_id) {
    return res.status(400).json({ success: false, error: "order_id required" });
  }

  // Fetch order
  const order = await pool.query(
    `SELECT o.*, u.email, u.name
     FROM orders o
     JOIN users u ON o.customer_id = u.id
     WHERE o.id = $1 AND o.customer_id = $2`,
    [order_id, req.user.id]
  );

  if (!order.rows[0]) {
    return res.status(404).json({ success: false, error: "Order not found" });
  }

  const o = order.rows[0];

  if (o.status !== "pending") {
    return res.status(400).json({
      success: false,
      error:   `Order is already ${o.status}. Cannot initialize payment again.`,
    });
  }

  if (o.paystack_ref) {
    return res.status(409).json({
      success: false,
      error:   "Payment already initialized for this order.",
      ref:     o.paystack_ref,
    });
  }

  const amount_kobo = Math.round(parseFloat(o.amount) * 100); // Paystack uses kobo
  const reference   = `DZ-ORD-${order_id}-${Date.now()}`;
  const callback    = `${process.env.FRONTEND_URL || "https://dunazoe.com"}/payment/verify?order=${order_id}`;

  // ── PAYSTACK INITIALIZATION ───────────────────────────────
  if (currency.toUpperCase() === "NGN") {
    if (!PAYSTACK_SECRET) {
      return res.status(503).json({ success: false, error: "Payment gateway not configured" });
    }

    let ps_response;
    try {
      ps_response = await axios.post(
        `${PAYSTACK_BASE}/transaction/initialize`,
        {
          email:        o.email,
          amount:       amount_kobo,
          reference,
          callback_url: callback,
          metadata: {
            order_id,
            customer_name: o.name,
            custom_fields: [
              { display_name: "Order ID",   variable_name: "order_id",   value: order_id },
              { display_name: "Platform",   variable_name: "platform",   value: "DUNAZOE" },
            ],
          },
          channels: ["card", "bank", "ussd", "bank_transfer", "mobile_money"],
        },
        {
          headers: {
            Authorization:  `Bearer ${PAYSTACK_SECRET}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (err) {
      const msg = err.response?.data?.message || "Paystack initialization failed";
      return res.status(502).json({ success: false, error: msg });
    }

    const ps = ps_response.data.data;

    // Save reference to order
    await pool.query(
      "UPDATE orders SET paystack_ref=$1, status='reserved', updated_at=NOW() WHERE id=$2",
      [reference, order_id]
    );

    return res.json({
      success:      true,
      provider:     "paystack",
      currency:     "NGN",
      amount_ngn:   parseFloat(o.amount),
      reference,
      payment_url:  ps.authorization_url,
      access_code:  ps.access_code,
      message:      "Redirect customer to payment_url to complete payment",
    });
  }

  // ── STRIPE INITIALIZATION (USD) ───────────────────────────
  if (currency.toUpperCase() === "USD") {
    if (!STRIPE_SECRET) {
      return res.status(503).json({ success: false, error: "Stripe not configured for USD payments" });
    }

    const amount_cents = Math.round(parseFloat(o.amount) * 100);

    let session;
    try {
      const stripe = require("stripe")(STRIPE_SECRET);
      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency:     "usd",
            unit_amount:  amount_cents,
            product_data: { name: `DUNAZOE Order #${order_id}` },
          },
          quantity: 1,
        }],
        mode:          "payment",
        success_url:   `${callback}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:    `${process.env.FRONTEND_URL}/cart`,
        metadata:      { order_id: String(order_id) },
      });
    } catch (err) {
      return res.status(502).json({ success: false, error: err.message });
    }

    await pool.query(
      "UPDATE orders SET paystack_ref=$1, status='reserved', updated_at=NOW() WHERE id=$2",
      [`STRIPE-${session.id}`, order_id]
    );

    return res.json({
      success:      true,
      provider:     "stripe",
      currency:     "USD",
      amount_usd:   parseFloat(o.amount),
      payment_url:  session.url,
      session_id:   session.id,
    });
  }

  return res.status(400).json({ success: false, error: "Currency must be NGN or USD" });
})));

// ── VERIFY PAYMENT (client callback) ─────────────────────────
/**
 * GET /payments/verify/:reference
 * Called by frontend after Paystack redirect
 * Double-checks with Paystack API — never trust client alone
 */
app.get("/payments/verify/:reference", requireAuth, asyncHandler(async (req, res) => {
  const { reference } = req.params;

  if (!PAYSTACK_SECRET) {
    return res.status(503).json({ success: false, error: "Gateway not configured" });
  }

  let verify_res;
  try {
    verify_res = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );
  } catch (err) {
    return res.status(502).json({ success: false, error: "Verification request failed" });
  }

  const tx = verify_res.data.data;

  if (tx.status !== "success") {
    return res.status(402).json({
      success: false,
      error:   `Payment not successful. Status: ${tx.status}`,
      status:  tx.status,
    });
  }

  // Find order by reference
  const order = await pool.query(
    "SELECT * FROM orders WHERE paystack_ref=$1", [reference]
  );
  if (!order.rows[0]) {
    return res.status(404).json({ success: false, error: "Order not found for this reference" });
  }

  // If already confirmed (idempotency)
  if (order.rows[0].status === "paid") {
    return res.json({ success: true, message: "Payment already confirmed", already_done: true });
  }

  // Confirm payment
  await _confirm_payment(order.rows[0], reference, tx.amount / 100);

  return res.json({
    success:    true,
    message:    "Payment confirmed. Order is being processed.",
    order_id:   order.rows[0].id,
    amount_ngn: tx.amount / 100,
  });
}));

// ── PAYSTACK WEBHOOK ──────────────────────────────────────────
/**
 * POST /payments/webhook/paystack
 * Called by Paystack servers — NOT by client
 *
 * CTO: Raw body required for signature verification.
 *      Respond 200 immediately — process async.
 *      Every event logged — even ones we don't handle.
 */
app.post("/payments/webhook/paystack", asyncHandler(async (req, res) => {
  // ── STEP 1: Verify signature ──────────────────────────────
  const signature = req.headers["x-paystack-signature"] || "";
  const body      = req.body; // raw Buffer (because of express.raw middleware)
  const hash      = crypto
    .createHmac("sha512", PAYSTACK_SECRET)
    .update(body)
    .digest("hex");

  if (hash !== signature) {
    // Log the failed attempt but return 200 (Paystack retries on non-200)
    console.error("[Webhook] Invalid Paystack signature — possible spoofing attempt");
    return res.status(200).json({ received: true }); // still 200 to stop retries
  }

  // ── STEP 2: Parse event ───────────────────────────────────
  let event;
  try {
    event = JSON.parse(body.toString());
  } catch {
    return res.status(200).json({ received: true });
  }

  // ── STEP 3: Respond immediately ───────────────────────────
  // Paystack times out after 30s — we MUST respond first then process
  res.status(200).json({ received: true });

  // ── STEP 4: Log all webhook events ───────────────────────
  await pool.query(
    `INSERT INTO webhook_log(provider, event_type, reference, payload, created_at)
     VALUES('paystack',$1,$2,$3,NOW())
     ON CONFLICT(reference) DO NOTHING`,
    [event.event, event.data?.reference || null, JSON.stringify(event).substring(0, 5000)]
  ).catch(() => {}); // webhook_log table optional

  // ── STEP 5: Handle specific events ───────────────────────
  const data = event.data || {};

  if (event.event === "charge.success") {
    const reference = data.reference;
    const amount    = data.amount / 100; // convert kobo to naira

    const order = await pool.query(
      "SELECT * FROM orders WHERE paystack_ref=$1", [reference]
    ).catch(() => ({ rows: [] }));

    if (!order.rows[0]) {
      console.error(`[Webhook] No order found for reference: ${reference}`);
      return;
    }

    // Idempotency — skip if already processed
    if (order.rows[0].status === "paid") {
      console.log(`[Webhook] Already processed: ${reference}`);
      return;
    }

    await _confirm_payment(order.rows[0], reference, amount);
  }

  if (event.event === "transfer.success") {
    // Payout confirmed — update payout_ledger
    await pool.query(
      "UPDATE payout_ledger SET status='paid', processed_at=NOW() WHERE reference=$1",
      [data.reference]
    ).catch(() => {});
  }

  if (event.event === "charge.dispute.create") {
    // Paystack flagged a dispute — lock escrow immediately
    const reference = data.reference;
    const order = await pool.query(
      "SELECT * FROM orders WHERE paystack_ref=$1", [reference]
    ).catch(() => ({ rows: [] }));

    if (order.rows[0]) {
      await pool.query(
        "UPDATE orders SET status='disputed', updated_at=NOW() WHERE id=$1",
        [order.rows[0].id]
      ).catch(() => {});

      const escrow = await pool.query(
        "SELECT id FROM escrow WHERE order_id=$1 AND status='held'", [order.rows[0].id]
      ).catch(() => ({ rows: [] }));

      if (escrow.rows[0]) {
        await axios.post(`${ESCROW_URL}/escrow/${escrow.rows[0].id}/lock`).catch(() => {});
      }
    }
  }
}));

// ── STRIPE WEBHOOK ────────────────────────────────────────────
/**
 * POST /payments/webhook/stripe
 * Called by Stripe servers for USD payments
 */
app.post("/payments/webhook/stripe",
  express.raw({ type: "application/json" }),
  asyncHandler(async (req, res) => {
    const sig = req.headers["stripe-signature"] || "";

    if (!STRIPE_SECRET) {
      return res.status(200).json({ received: true });
    }

    let event;
    try {
      const stripe = require("stripe")(STRIPE_SECRET);
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ""
      );
    } catch (err) {
      console.error("[Stripe Webhook] Signature verification failed:", err.message);
      return res.status(200).json({ received: true }); // still 200
    }

    res.status(200).json({ received: true });

    if (event.type === "checkout.session.completed") {
      const session  = event.data.object;
      const order_id = session.metadata?.order_id;

      if (order_id) {
        const order = await pool.query(
          "SELECT * FROM orders WHERE id=$1", [order_id]
        ).catch(() => ({ rows: [] }));

        if (order.rows[0] && order.rows[0].status !== "paid") {
          await _confirm_payment(order.rows[0], `STRIPE-${session.id}`, session.amount_total / 100);
        }
      }
    }
  })
);

// ── GET PAYMENT STATUS ────────────────────────────────────────
app.get("/payments/status/:order_id", requireAuth, asyncHandler(async (req, res) => {
  const order = await pool.query(
    "SELECT id, status, paystack_ref, amount, payment_type FROM orders WHERE id=$1 AND customer_id=$2",
    [req.params.order_id, req.user.id]
  );
  if (!order.rows[0]) {
    return res.status(404).json({ success: false, error: "Order not found" });
  }
  const o = order.rows[0];
  return res.json({
    success:     true,
    order_id:    o.id,
    status:      o.status,
    amount:      o.amount,
    is_paid:     ["paid","processing","shipped","delivered"].includes(o.status),
    reference:   o.paystack_ref,
  });
}));

// ── CORE: CONFIRM PAYMENT ─────────────────────────────────────
/**
 * Central payment confirmation logic.
 * Called by both webhook handler AND verify endpoint.
 * Idempotent — safe to call multiple times.
 */
async function _confirm_payment(order, reference, amount_paid) {
  try {
    console.log(`[Payment] Confirming order ${order.id} — ₦${amount_paid?.toLocaleString()}`);

    // 1. Mark order as paid
    await pool.query(
      "UPDATE orders SET status='paid', updated_at=NOW() WHERE id=$1 AND status != 'paid'",
      [order.id]
    );

    // 2. Confirm stock deduction (reserved → confirmed)
    await axios.post(`${INVENTORY_URL}/inventory/confirm`, {
      product_id: order.product_id,
      quantity:   order.quantity,
      order_ref:  `ORD-${order.id}`,
    }).catch(err => console.error("[Payment] Inventory confirm failed:", err.message));

    // 3. Get escrow and mark as held with paystack_ref
    const escrow = await pool.query(
      "SELECT * FROM escrow WHERE order_id=$1", [order.id]
    );
    if (escrow.rows[0]) {
      await pool.query(
        "UPDATE escrow SET paystack_ref=$1, held_at=NOW() WHERE order_id=$2",
        [reference, order.id]
      ).catch(() => {});
    }

    // 4. Notify vendor
    const vendor = await pool.query(
      `SELECT u.name, u.phone FROM vendors v JOIN users u ON v.user_id=u.id WHERE v.id=$1`,
      [order.vendor_id]
    );
    if (vendor.rows[0]) {
      // In production: call notification service / Termii WhatsApp API
      await _notify(order.vendor_id, "vendor", "📦 New Paid Order!",
        `Order #${order.id} — ₦${parseFloat(order.amount).toLocaleString()} received. Prepare for dispatch.`
      );
    }

    // 5. Notify customer
    await _notify(order.customer_id, "customer", "✅ Payment Confirmed!",
      `Your payment of ₦${parseFloat(order.amount).toLocaleString()} was received. Order #${order.id} is being prepared.`
    );

    console.log(`[Payment] ✅ Order ${order.id} confirmed successfully`);

  } catch (err) {
    console.error(`[Payment] Confirmation failed for order ${order.id}:`, err.message);
    // Don't throw — we already responded 200 to Paystack
  }
}

async function _notify(user_id, role, title, body) {
  try {
    await pool.query(
      "INSERT INTO notifications(user_id, title, body, type, channel) VALUES($1,$2,$3,'success','in_app')",
      [user_id, title, body]
    );
    // In production: also trigger WhatsApp via Termii
  } catch (_) {}
}

// ── ERROR HANDLER ─────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`✅ Payment Service running on port ${PORT}`);
  console.log(`   Paystack webhook: POST /payments/webhook/paystack`);
  console.log(`   Stripe webhook:   POST /payments/webhook/stripe`);
});

module.exports = app;
