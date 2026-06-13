// ================================================================
// DUNAZOE OS — TRUST SCORE SERVICE
// services/trust-service/index.js
// Port: 4011
//
// Formula (100 points total):
//   Consistency  (25pts) — contribution regularity
//   Cycle        (25pts) — completed Ajo cycles
//   Timeliness   (25pts) — on-time payments
//   Activity     (25pts) — platform engagement + order completion
//
// Loan multipliers by trust tier:
//   0–39   → No loan
//   40–59  → 0.5× wallet balance
//   60–74  → 1×  wallet balance
//   75–89  → 2×  wallet balance
//   90–100 → 3×  wallet balance
// ================================================================

require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const { Pool } = require("pg");
const { requireAuth } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");

const app  = express();
const PORT = process.env.PORT || 4011;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// ── LOAN MULTIPLIER TABLE ─────────────────────────────────────
const LOAN_TIERS = [
  { min: 90, label: "Platinum", multiplier: 3.0, emoji: "🏆" },
  { min: 75, label: "Gold",     multiplier: 2.0, emoji: "⭐" },
  { min: 60, label: "Silver",   multiplier: 1.0, emoji: "✅" },
  { min: 40, label: "Bronze",   multiplier: 0.5, emoji: "🔶" },
  { min: 0,  label: "New",      multiplier: 0.0, emoji: "⏳" },
];

function getLoanTier(score) {
  return LOAN_TIERS.find(t => score >= t.min);
}

// ── HEALTH ────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ service: "trust-service", status: "ok", port: PORT });
});

// ── COMPUTE TRUST SCORE ───────────────────────────────────────
/**
 * POST /trust/compute/:user_id
 * Recalculates from raw data. Expensive — cache for 1 hour.
 */
app.post("/trust/compute/:user_id", requireAuth, asyncHandler(async (req, res) => {
  const user_id = parseInt(req.params.user_id);

  if (req.user.id !== user_id && req.user.role !== "admin") {
    return res.status(403).json({ success: false, error: "Access denied" });
  }

  // ── CONSISTENCY SCORE (25pts) ─────────────────────────────
  // Based on number of thrift contributions in last 90 days
  const contributions = await pool.query(
    `SELECT COUNT(*) c FROM thrift_contributions
     WHERE user_id=$1 AND type='contribution' AND created_at > NOW() - INTERVAL '90 days'`,
    [user_id]
  );
  const contrib_count   = parseInt(contributions.rows[0].c);
  const consistency_raw = Math.min(25, contrib_count * 3); // 3pts per contribution, max 25

  // ── CYCLE SCORE (25pts) ───────────────────────────────────
  // Completed savings targets + interest earned
  const thrift_acc = await pool.query(
    "SELECT * FROM thrift_accounts WHERE user_id=$1", [user_id]
  );
  let cycle_raw = 0;
  if (thrift_acc.rows[0]) {
    const a = thrift_acc.rows[0];
    // Points for meeting savings target
    if (parseFloat(a.target_amount) > 0) {
      const pct = Math.min(1, parseFloat(a.balance) / parseFloat(a.target_amount));
      cycle_raw += pct * 15; // up to 15pts for target progress
    }
    // Points for interest earned (shows long-term saving)
    const interest_pts = Math.min(10, parseFloat(a.interest_earned || 0) / 500);
    cycle_raw += interest_pts; // up to 10pts
  }
  cycle_raw = Math.min(25, cycle_raw);

  // ── TIMELINESS SCORE (25pts) ──────────────────────────────
  // Based on thrift lock/release patterns (on-time payments vs missed)
  const on_time = await pool.query(
    `SELECT COUNT(*) c FROM thrift_contributions
     WHERE user_id=$1 AND type='lock'`,
    [user_id]
  );
  const missed = await pool.query(
    `SELECT COUNT(*) c FROM thrift_contributions
     WHERE user_id=$1 AND note ILIKE '%missed%'`,
    [user_id]
  );
  const on_time_count = parseInt(on_time.rows[0].c);
  const missed_count  = parseInt(missed.rows[0].c);
  const timeliness_raw = on_time_count > 0
    ? Math.min(25, (on_time_count / (on_time_count + missed_count)) * 25)
    : 10; // default 10 for new users

  // ── ACTIVITY SCORE (25pts) ────────────────────────────────
  // Orders completed + vendor rating + no disputes
  const orders = await pool.query(
    "SELECT COUNT(*) total, COUNT(*) FILTER (WHERE status='delivered') completed FROM orders WHERE customer_id=$1",
    [user_id]
  );
  const disputes = await pool.query(
    "SELECT COUNT(*) c FROM fraud_log WHERE user_id=$1 AND risk_level='high_risk'", [user_id]
  );
  const o             = orders.rows[0];
  const total_orders  = parseInt(o.total);
  const completed     = parseInt(o.completed);
  const dispute_count = parseInt(disputes.rows[0].c);

  let activity_raw = 0;
  if (total_orders > 0) {
    activity_raw += (completed / total_orders) * 15; // up to 15pts for completion rate
  }
  activity_raw += Math.min(10, total_orders * 0.5);  // up to 10pts for order count
  activity_raw -= dispute_count * 5;                  // -5pts per high-risk fraud log
  activity_raw  = Math.max(0, Math.min(25, activity_raw));

  // ── FINAL SCORE ───────────────────────────────────────────
  const raw_score = consistency_raw + cycle_raw + timeliness_raw + activity_raw;
  const score     = Math.round(Math.min(100, Math.max(0, raw_score)) * 10) / 10;
  const tier      = getLoanTier(score);

  // Get wallet balance for loan calculation
  const wallet = await pool.query(
    "SELECT balance_ngn FROM wallets WHERE user_id=$1", [user_id]
  );
  const wallet_balance = parseFloat(wallet.rows[0]?.balance_ngn || 0);
  const thrift_balance = parseFloat(thrift_acc.rows[0]?.balance || 0);
  const total_assets   = wallet_balance + thrift_balance;
  const max_loan       = Math.round(total_assets * tier.multiplier / 100) * 100;

  // ── PERSIST ───────────────────────────────────────────────
  await pool.query(
    `INSERT INTO trust_scores(
       user_id, score, consistency_score, cycle_score,
       timeliness_score, activity_score,
       total_contributions, on_time_payments, missed_payments,
       completed_cycles, total_orders, label, updated_at
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
     ON CONFLICT(user_id) DO UPDATE SET
       score=$2, consistency_score=$3, cycle_score=$4,
       timeliness_score=$5, activity_score=$6,
       total_contributions=$7, on_time_payments=$8, missed_payments=$9,
       completed_cycles=$10, total_orders=$11, label=$12, updated_at=NOW()`,
    [user_id, score, consistency_raw, cycle_raw, timeliness_raw, activity_raw,
     contrib_count, on_time_count, missed_count,
     0, total_orders, tier.label]
  );

  return res.json({
    success:    true,
    user_id,
    trust_score: score,
    tier:        `${tier.emoji} ${tier.label}`,
    breakdown: {
      consistency:  Math.round(consistency_raw * 10) / 10,
      cycle:        Math.round(cycle_raw * 10) / 10,
      timeliness:   Math.round(timeliness_raw * 10) / 10,
      activity:     Math.round(activity_raw * 10) / 10,
    },
    loan_eligibility: {
      eligible:    tier.multiplier > 0,
      multiplier:  tier.multiplier,
      max_loan_ngn: max_loan,
      based_on:    `₦${total_assets.toLocaleString()} total assets × ${tier.multiplier}×`,
    },
  });
}));

// ── GET TRUST SCORE (cached) ──────────────────────────────────
app.get("/trust/:user_id", requireAuth, asyncHandler(async (req, res) => {
  const user_id = parseInt(req.params.user_id);

  if (req.user.id !== user_id && req.user.role !== "admin") {
    return res.status(403).json({ success: false, error: "Access denied" });
  }

  const cached = await pool.query(
    "SELECT * FROM trust_scores WHERE user_id=$1", [user_id]
  );

  if (!cached.rows[0]) {
    // First time — compute now
    return res.redirect(307, `/trust/compute/${user_id}`);
  }

  const ts    = cached.rows[0];
  const score = parseFloat(ts.score);
  const tier  = getLoanTier(score);

  // Check if cache is stale (> 1 hour)
  const age_hours = (Date.now() - new Date(ts.updated_at).getTime()) / 3600000;
  const stale     = age_hours > 1;

  return res.json({
    success:     true,
    user_id,
    trust_score: score,
    tier:        `${tier.emoji} ${tier.label}`,
    breakdown: {
      consistency: parseFloat(ts.consistency_score),
      cycle:       parseFloat(ts.cycle_score),
      timeliness:  parseFloat(ts.timeliness_score),
      activity:    parseFloat(ts.activity_score),
    },
    loan_eligibility: {
      eligible:        tier.multiplier > 0,
      multiplier:      tier.multiplier,
    },
    cached:      !stale,
    last_updated: ts.updated_at,
    stale_note:  stale ? "Score may be outdated. POST /trust/compute/:id to refresh." : null,
  });
}));

// ── LEADERBOARD (Top savers — anonymised) ────────────────────
app.get("/trust/leaderboard/top", asyncHandler(async (req, res) => {
  const top = await pool.query(
    `SELECT ts.user_id, ts.score, ts.label,
            LEFT(u.name, 1) || REPEAT('*', LENGTH(u.name)-2) || RIGHT(u.name,1) AS masked_name
     FROM trust_scores ts
     JOIN users u ON ts.user_id=u.id
     WHERE ts.score >= 60
     ORDER BY ts.score DESC LIMIT 10`
  );
  return res.json({ success: true, leaderboard: top.rows });
}));

app.use(errorHandler);
app.listen(PORT, () => console.log(`✅ Trust Service running on port ${PORT}`));
module.exports = app;
