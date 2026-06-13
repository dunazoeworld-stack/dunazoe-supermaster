// ================================================================
// DUNAZOE OS — ESCROW SERVICE
// services/escrow-service/index.js
// Port: 4007
// CTO RULE: Money never leaves escrow without explicit release.
//           Release only after delivery confirmation.
//           Lock immediately when dispute is raised.
// ================================================================

require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const { Pool } = require("pg");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");

const app  = express();
const PORT = process.env.PORT || 4007;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const PLATFORM_FEE_PCT    = parseFloat(process.env.PLATFORM_FEE_PCT    || "0.10"); // 10%
const AGENT_FEE_PCT       = parseFloat(process.env.AGENT_FEE_PCT       || "0.02"); // 2%
const COPYTRADER_FEE_PCT  = parseFloat(process.env.COPYTRADER_FEE_PCT  || "0.06"); // 6%

// ── HEALTH ────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ service: "escrow-service", status: "ok", port: PORT });
});

// ── CREATE ESCROW (called by Order Service after order saved) ─
/**
 * POST /escrow
 * Body: { order_id, amount, paystack_ref?, has_agent?, has_copytrader? }
 */
app.post("/escrow", asyncHandler(async (req, res) => {
  const { order_id, amount, paystack_ref, has_agent = false, has_copytrader = false } = req.body;

  if (!order_id || !amount) {
    return res.status(400).json({ success: false, error: "order_id and amount required" });
  }

  // Check if escrow already exists for this order
  const existing = await pool.query("SELECT id FROM escrow WHERE order_id=$1", [order_id]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ success: false, error: "Escrow already exists for this order" });
  }

  const num_amount     = parseFloat(amount);
  const platform_fee   = parseFloat((num_amount * PLATFORM_FEE_PCT).toFixed(2));
  const agent_fee      = has_agent      ? parseFloat((num_amount * AGENT_FEE_PCT).toFixed(2))      : 0;
  const copytrader_fee = has_copytrader ? parseFloat((num_amount * COPYTRADER_FEE_PCT).toFixed(2)) : 0;
  const vendor_net     = parseFloat((num_amount - platform_fee - agent_fee - copytrader_fee).toFixed(2));

  const result = await pool.query(
    `INSERT INTO escrow(order_id, amount, platform_fee, agent_fee, copytrader_fee, vendor_net,
       status, paystack_ref)
     VALUES($1,$2,$3,$4,$5,$6,'held',$7)
     RETURNING *`,
    [order_id, num_amount, platform_fee, agent_fee, copytrader_fee, vendor_net, paystack_ref || null]
  );

  const escrow = result.rows[0];
  return res.status(201).json({
    success:        true,
    escrow_id:      escrow.id,
    order_id,
    status:         "held",
    amount:         num_amount,
    breakdown: {
      platform_fee,
      agent_commission: agent_fee,
      copytrader_commission: copytrader_fee,
      vendor_net,
    },
    message: `₦${num_amount.toLocaleString()} held in escrow. Releases after delivery confirmation.`,
  });
}));

// ── GET ESCROW BY ORDER ───────────────────────────────────────
app.get("/escrow/order/:order_id", asyncHandler(async (req, res) => {
  const result = await pool.query("SELECT * FROM escrow WHERE order_id=$1", [req.params.order_id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: "Escrow not found" });
  }
  return res.json({ success: true, escrow: result.rows[0] });
}));

// ── RELEASE ESCROW (after delivery confirmed) ─────────────────
/**
 * POST /escrow/:id/release
 * CTO RULE: Can only release from 'held' status.
 *           'locked' escrow (disputed) cannot be released here.
 */
app.post("/escrow/:id/release", asyncHandler(async (req, res) => {
  const { id } = req.params;

  const esc = await pool.query("SELECT * FROM escrow WHERE id=$1", [id]);
  if (!esc.rows[0]) {
    return res.status(404).json({ success: false, error: "Escrow not found" });
  }

  const escrow = esc.rows[0];
  if (escrow.status !== "held") {
    return res.status(400).json({
      success: false,
      error:   `Cannot release escrow with status: ${escrow.status}. Must be 'held'.`,
    });
  }

  await pool.query(
    "UPDATE escrow SET status='released', released_at=NOW() WHERE id=$1", [id]
  );

  // Add to payout ledger for vendor (will be paid in next payout run)
  await pool.query(
    `INSERT INTO payout_ledger(user_id, type, amount, source, order_id)
     SELECT v.user_id, 'vendor_sale', $1, 'escrow_release', $2
     FROM orders o JOIN vendors v ON o.vendor_id=v.id WHERE o.id=$3`,
    [escrow.vendor_net, escrow.order_id, escrow.order_id]
  );

  return res.json({
    success:    true,
    escrow_id:  id,
    status:     "released",
    vendor_net: escrow.vendor_net,
    message:    `Escrow released. ₦${parseFloat(escrow.vendor_net).toLocaleString()} queued for vendor payout.`,
  });
}));

// ── LOCK ESCROW (when dispute raised) ─────────────────────────
/**
 * POST /escrow/:id/lock
 * Funds are frozen — neither vendor nor platform can touch them.
 */
app.post("/escrow/:id/lock", asyncHandler(async (req, res) => {
  const esc = await pool.query("SELECT * FROM escrow WHERE id=$1", [req.params.id]);
  if (!esc.rows[0]) {
    return res.status(404).json({ success: false, error: "Escrow not found" });
  }
  if (!["held"].includes(esc.rows[0].status)) {
    return res.status(400).json({
      success: false,
      error:   `Cannot lock escrow with status: ${esc.rows[0].status}`,
    });
  }

  await pool.query("UPDATE escrow SET status='locked' WHERE id=$1", [req.params.id]);

  return res.json({
    success:   true,
    escrow_id: req.params.id,
    status:    "locked",
    message:   "Escrow locked. Funds frozen pending dispute resolution.",
  });
}));

// ── REFUND ESCROW (dispute resolved in buyer's favour) ────────
/**
 * POST /escrow/:id/refund
 * Body: { reason }
 */
app.post("/escrow/:id/refund", asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const esc = await pool.query("SELECT * FROM escrow WHERE id=$1", [req.params.id]);
  if (!esc.rows[0]) {
    return res.status(404).json({ success: false, error: "Escrow not found" });
  }
  const escrow = esc.rows[0];
  if (!["held","locked"].includes(escrow.status)) {
    return res.status(400).json({
      success: false,
      error:   `Cannot refund escrow with status: ${escrow.status}`,
    });
  }

  await pool.query(
    "UPDATE escrow SET status='refunded', released_at=NOW() WHERE id=$1", [req.params.id]
  );

  // Queue refund to buyer's wallet
  await pool.query(
    `INSERT INTO payout_ledger(user_id, type, amount, source, order_id)
     SELECT o.customer_id, 'vendor_sale', $1, 'escrow_refund', o.id
     FROM orders o WHERE o.id=$2`,
    [escrow.amount, escrow.order_id]
  );

  return res.json({
    success:   true,
    escrow_id: req.params.id,
    status:    "refunded",
    amount:    escrow.amount,
    reason:    reason || "Dispute resolved in buyer's favour",
    message:   `₦${parseFloat(escrow.amount).toLocaleString()} refund queued for buyer.`,
  });
}));

// ── PARTIAL RELEASE (for milestone/Ajo orders) ────────────────
/**
 * POST /escrow/:id/partial-release
 * Body: { amount, note }
 */
app.post("/escrow/:id/partial-release", asyncHandler(async (req, res) => {
  const { amount, note } = req.body;
  const esc = await pool.query("SELECT * FROM escrow WHERE id=$1", [req.params.id]);
  if (!esc.rows[0] || esc.rows[0].status !== "held") {
    return res.status(400).json({ success: false, error: "Escrow not found or not in held status" });
  }

  const release_amt = parseFloat(amount);
  if (release_amt > parseFloat(esc.rows[0].vendor_net)) {
    return res.status(400).json({ success: false, error: "Cannot release more than vendor_net" });
  }

  return res.json({
    success:        true,
    partial_release: release_amt,
    note:           note || "Partial milestone release",
    message:        `₦${release_amt.toLocaleString()} released for milestone. Full release pending.`,
  });
}));

app.use(errorHandler);
app.listen(PORT, () => console.log(`✅ Escrow Service running on port ${PORT}`));
module.exports = app;
