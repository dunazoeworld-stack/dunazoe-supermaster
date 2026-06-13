// ================================================================
// DUNAZOE OS — FRAUD DETECTION SERVICE
// services/fraud-service/index.js
// Port: 4008
// CTO NOTE: Plan's fraud rules were correct but missing:
//   - persistent fraud_log (added)
//   - quantity-based check (added per ChatGPT v6)
//   - IP-based velocity check (added)
//   - Referral self-abuse detection (added)
//   - Extendable rule engine (added for ML upgrade later)
// ================================================================

require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const { Pool } = require("pg");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");

const app  = express();
const PORT = process.env.PORT || 4008;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// ── THRESHOLDS (configurable via env) ─────────────────────────
const RULES = {
  HIGH_RISK_AMOUNT:     parseFloat(process.env.FRAUD_HIGH_RISK_AMOUNT    || "500000"),
  SUSPICIOUS_QUANTITY:  parseInt(process.env.FRAUD_SUSPICIOUS_QTY        || "50"),
  SUSPICIOUS_AMOUNT:    parseFloat(process.env.FRAUD_SUSPICIOUS_AMOUNT   || "200000"),
  MAX_ORDERS_PER_HOUR:  parseInt(process.env.FRAUD_MAX_ORDERS_PER_HOUR   || "5"),
  MAX_ORDERS_PER_DAY:   parseInt(process.env.FRAUD_MAX_ORDERS_PER_DAY    || "20"),
};

// ── HEALTH ────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ service: "fraud-service", status: "ok", port: PORT, rules: RULES });
});

// ── CHECK ORDER FRAUD ─────────────────────────────────────────
/**
 * POST /fraud/check
 * Body: { user_id, amount, quantity, ip_address?, product_id?, referrer_id? }
 * Returns: { risk_level, decision, rules_fired, allowed }
 *
 * Decision:
 *   safe        → allow order to proceed
 *   suspicious  → flag for review, but allow (with manual review)
 *   high_risk   → BLOCK order completely
 */
app.post("/fraud/check", asyncHandler(async (req, res) => {
  const { user_id, amount, quantity, ip_address, product_id, referrer_id } = req.body;

  if (!user_id || amount === undefined) {
    return res.status(400).json({ success: false, error: "user_id and amount required" });
  }

  const num_amount   = parseFloat(amount);
  const num_qty      = parseInt(quantity || 1);
  const rules_fired  = [];
  let   risk_level   = "safe";

  // ── RULE 1: High-value amount (plan's original rule) ──────
  if (num_amount > RULES.HIGH_RISK_AMOUNT) {
    rules_fired.push(`HIGH_RISK_AMOUNT: ₦${num_amount.toLocaleString()} > ₦${RULES.HIGH_RISK_AMOUNT.toLocaleString()}`);
    risk_level = "high_risk";
  }

  // ── RULE 2: Suspicious quantity (ChatGPT v6 addition) ─────
  if (num_qty > RULES.SUSPICIOUS_QUANTITY) {
    rules_fired.push(`SUSPICIOUS_QUANTITY: ${num_qty} units > ${RULES.SUSPICIOUS_QUANTITY}`);
    risk_level = risk_level === "high_risk" ? "high_risk" : "suspicious";
  }

  // ── RULE 3: Suspicious amount (mid-tier flag) ─────────────
  if (num_amount > RULES.SUSPICIOUS_AMOUNT && risk_level === "safe") {
    rules_fired.push(`SUSPICIOUS_AMOUNT: ₦${num_amount.toLocaleString()} > ₦${RULES.SUSPICIOUS_AMOUNT.toLocaleString()}`);
    risk_level = "suspicious";
  }

  // ── RULE 4: Velocity — orders per hour ────────────────────
  if (pool && user_id) {
    try {
      const hourly = await pool.query(
        `SELECT COUNT(*) c FROM fraud_log
         WHERE user_id=$1 AND created_at > NOW() - INTERVAL '1 hour'`,
        [user_id]
      );
      if (parseInt(hourly.rows[0].c) >= RULES.MAX_ORDERS_PER_HOUR) {
        rules_fired.push(`VELOCITY_HOURLY: ${hourly.rows[0].c} orders in last hour`);
        risk_level = "high_risk";
      }
    } catch (_) {/* DB may not be set up yet in dev */}
  }

  // ── RULE 5: IP velocity ────────────────────────────────────
  if (pool && ip_address) {
    try {
      const ip_count = await pool.query(
        `SELECT COUNT(*) c FROM fraud_log
         WHERE ip_address=$1 AND created_at > NOW() - INTERVAL '1 hour'`,
        [ip_address]
      );
      if (parseInt(ip_count.rows[0].c) >= RULES.MAX_ORDERS_PER_HOUR * 2) {
        rules_fired.push(`IP_VELOCITY: ${ip_count.rows[0].c} orders from same IP in 1hr`);
        risk_level = "high_risk";
      }
    } catch (_) {}
  }

  // ── RULE 6: Self-referral abuse ────────────────────────────
  if (referrer_id) {
    try {
      const self_ref = await pool.query(
        "SELECT user_id FROM vendors WHERE id=$1", [referrer_id]
      );
      if (self_ref.rows[0] && parseInt(self_ref.rows[0].user_id) === parseInt(user_id)) {
        rules_fired.push("SELF_REFERRAL: User is trying to earn commission from their own purchase");
        risk_level = "high_risk";
      }
    } catch (_) {}
  }

  // ── DECISION ──────────────────────────────────────────────
  const decision = risk_level === "high_risk"   ? "block"
                 : risk_level === "suspicious"  ? "flag"
                 : "allow";

  // ── PERSIST LOG ───────────────────────────────────────────
  try {
    await pool.query(
      `INSERT INTO fraud_log(user_id, ip_address, amount, quantity, risk_level, rules_fired, action)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [user_id, ip_address || null, num_amount, num_qty,
       risk_level, JSON.stringify(rules_fired), decision]
    );
  } catch (_) {}

  return res.json({
    success:     decision !== "block",
    risk_level,
    decision,
    allowed:     decision !== "block",
    rules_fired,
    message:
      decision === "block"  ? `Order blocked: ${rules_fired[0] || "High risk detected"}` :
      decision === "flag"   ? `Order flagged for review: ${rules_fired[0] || "Suspicious activity"}` :
                              "Order cleared for processing",
  });
}));

// ── GET FRAUD LOGS (admin) ────────────────────────────────────
app.get("/fraud/logs", asyncHandler(async (req, res) => {
  const { risk_level, user_id, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page)-1)*parseInt(limit);
  let q    = "SELECT * FROM fraud_log WHERE 1=1";
  const v  = [];
  let idx  = 1;
  if (risk_level) { q += ` AND risk_level=$${idx++}`; v.push(risk_level); }
  if (user_id)    { q += ` AND user_id=$${idx++}`;    v.push(parseInt(user_id)); }
  q += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
  v.push(parseInt(limit), offset);
  const result = await pool.query(q, v);
  return res.json({ success: true, logs: result.rows, count: result.rows.length });
}));

// ── FRAUD STATS ───────────────────────────────────────────────
app.get("/fraud/stats", asyncHandler(async (req, res) => {
  const stats = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE risk_level='high_risk')  AS high_risk_count,
      COUNT(*) FILTER (WHERE risk_level='suspicious') AS suspicious_count,
      COUNT(*) FILTER (WHERE risk_level='safe')       AS safe_count,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS last_24h
    FROM fraud_log
  `);
  return res.json({ success: true, stats: stats.rows[0] });
}));

app.use(errorHandler);
app.listen(PORT, () => console.log(`✅ Fraud Service running on port ${PORT}`));
module.exports = app;
