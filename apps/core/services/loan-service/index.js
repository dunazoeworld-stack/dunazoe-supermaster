// ================================================================
// DUNAZOE OS — LOAN SERVICE
// services/loan-service/index.js
// Port: 4012
//
// Loan eligibility gates:
//   - Trust score >= 40 (Bronze tier minimum)
//   - No active defaulted loan
//   - Amount <= trust_multiplier × (wallet + thrift balance)
//
// Interest: 5% flat per loan
// Repayment: via wallet or thrift withdrawal
// ================================================================

require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const axios    = require("axios");
const { Pool } = require("pg");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");

const app  = express();
const PORT = process.env.PORT || 4012;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const TRUST_URL  = process.env.TRUST_SERVICE_URL  || "http://localhost:4011";
const WALLET_URL = process.env.WALLET_SERVICE_URL || "http://localhost:4009";
const INTEREST   = parseFloat(process.env.LOAN_INTEREST_RATE || "0.05"); // 5% flat
const MIN_TRUST  = parseFloat(process.env.LOAN_MIN_TRUST_SCORE || "40");

const MULTIPLIERS = {
  Platinum: 3.0,
  Gold:     2.0,
  Silver:   1.0,
  Bronze:   0.5,
  New:      0.0,
};

// ── HEALTH ────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ service: "loan-service", status: "ok", port: PORT });
});

// ── APPLY FOR LOAN ────────────────────────────────────────────
/**
 * POST /loans/apply
 * Auth: Required
 * Body: { amount, repayment_days? }
 */
app.post("/loans/apply", requireAuth, asyncHandler(async (req, res) => {
  const { amount, repayment_days = 30 } = req.body;
  const user_id = req.user.id;
  const amt     = parseFloat(amount);

  if (!amt || amt <= 0) {
    return res.status(400).json({ success: false, error: "Valid loan amount required" });
  }

  // ── CHECK NO ACTIVE DEFAULT ───────────────────────────────
  const active_bad = await pool.query(
    "SELECT id FROM loans WHERE user_id=$1 AND repayment_status='defaulted' AND status='disbursed'",
    [user_id]
  );
  if (active_bad.rows.length > 0) {
    return res.status(400).json({
      success: false,
      error:   "You have a defaulted loan. Clear it before applying for a new one."
    });
  }

  // ── GET TRUST SCORE ───────────────────────────────────────
  let trust_data;
  try {
    const t_res  = await axios.get(`${TRUST_URL}/trust/${user_id}`, {
      headers: { Authorization: req.headers.authorization }
    });
    trust_data = t_res.data;
  } catch (err) {
    return res.status(503).json({ success: false, error: "Trust service unavailable" });
  }

  const score      = parseFloat(trust_data.trust_score);
  const tier_label = trust_data.tier?.split(" ")[1] || "New";
  const multiplier = MULTIPLIERS[tier_label] || 0;

  if (score < MIN_TRUST || multiplier === 0) {
    return res.status(403).json({
      success:     false,
      error:       `Loan requires minimum trust score of ${MIN_TRUST}. Your score: ${score}`,
      your_score:  score,
      your_tier:   trust_data.tier,
      advice:      "Contribute to Ajo savings regularly to improve your trust score.",
    });
  }

  // ── GET ASSET BASE ────────────────────────────────────────
  let wallet_balance = 0;
  let thrift_balance = 0;
  try {
    const w_res   = await axios.get(`${WALLET_URL}/wallets/${user_id}`, {
      headers: { Authorization: req.headers.authorization }
    });
    wallet_balance = parseFloat(w_res.data.wallet?.NGN?.balance || 0);
  } catch (_) {}

  const thrift_res = await pool.query(
    "SELECT balance FROM thrift_accounts WHERE user_id=$1", [user_id]
  );
  thrift_balance = parseFloat(thrift_res.rows[0]?.balance || 0);

  const total_assets = wallet_balance + thrift_balance;
  const max_loan     = Math.round(total_assets * multiplier / 100) * 100;

  if (amt > max_loan) {
    return res.status(400).json({
      success:    false,
      error:      `Maximum loan for your tier is ₦${max_loan.toLocaleString()}`,
      your_tier:  trust_data.tier,
      max_loan,
      formula:    `₦${total_assets.toLocaleString()} assets × ${multiplier}× multiplier`,
    });
  }

  // ── SAVE LOAN APPLICATION ─────────────────────────────────
  const interest_amt = parseFloat((amt * INTEREST).toFixed(2));
  const total_due    = amt + interest_amt;
  const due_date     = new Date();
  due_date.setDate(due_date.getDate() + parseInt(repayment_days));

  const result = await pool.query(
    `INSERT INTO loans(
       user_id, amount, trust_score_at_approval, trust_multiplier,
       interest_rate, status, due_date
     ) VALUES($1,$2,$3,$4,$5,'pending',$6)
     RETURNING *`,
    [user_id, amt, score, multiplier, INTEREST, due_date.toISOString().split("T")[0]]
  );

  return res.status(201).json({
    success:      true,
    loan_id:      result.rows[0].id,
    amount:       amt,
    interest:     interest_amt,
    total_due,
    due_date:     due_date.toISOString().split("T")[0],
    status:       "pending",
    message:      "Loan application submitted. Admin will review within 24 hours.",
    trust_score:  score,
    tier:         trust_data.tier,
  });
}));

// ── APPROVE LOAN (Admin) ──────────────────────────────────────
app.post("/loans/:id/approve", requireAuth, requireRole("admin"),
  asyncHandler(async (req, res) => {
    const loan = await pool.query(
      "SELECT * FROM loans WHERE id=$1 AND status='pending'", [req.params.id]
    );
    if (!loan.rows[0]) {
      return res.status(404).json({ success: false, error: "Loan not found or not pending" });
    }
    const l = loan.rows[0];

    // Disburse to wallet
    await axios.post(`${WALLET_URL}/wallets/deposit`, {
      user_id:   l.user_id,
      amount:    l.amount,
      currency:  "NGN",
      reference: `LOAN-${l.id}`,
      note:      `Loan disbursement`,
    }).catch(() => {});

    // Log in payout ledger
    await pool.query(
      "INSERT INTO payout_ledger(user_id,type,amount,source,order_id,status,processed_at) VALUES($1,'loan_disbursement',$2,$3,$4,'paid',NOW())",
      [l.user_id, l.amount, `Loan ${l.id}`, null]
    ).catch(() => {});

    await pool.query(
      "UPDATE loans SET status='disbursed', approved_by=$1, approved_at=NOW() WHERE id=$2",
      [req.user.id, req.params.id]
    );

    return res.json({
      success:   true,
      loan_id:   l.id,
      status:    "disbursed",
      amount:    l.amount,
      message:   `₦${parseFloat(l.amount).toLocaleString()} disbursed to user's wallet`,
    });
  })
);

// ── REJECT LOAN (Admin) ───────────────────────────────────────
app.post("/loans/:id/reject", requireAuth, requireRole("admin"),
  asyncHandler(async (req, res) => {
    const { reason } = req.body;
    await pool.query(
      "UPDATE loans SET status='rejected' WHERE id=$1", [req.params.id]
    );
    return res.json({ success: true, reason: reason || "Does not meet criteria" });
  })
);

// ── REPAY LOAN ────────────────────────────────────────────────
/**
 * POST /loans/:id/repay
 * Body: { amount, source: "wallet"|"thrift" }
 */
app.post("/loans/:id/repay", requireAuth, asyncHandler(async (req, res) => {
  const { amount, source = "wallet" } = req.body;
  const user_id = req.user.id;
  const amt     = parseFloat(amount);

  const loan = await pool.query(
    "SELECT * FROM loans WHERE id=$1 AND user_id=$2 AND status='disbursed'",
    [req.params.id, user_id]
  );
  if (!loan.rows[0]) {
    return res.status(404).json({ success: false, error: "Active loan not found" });
  }
  const l = loan.rows[0];

  const remaining = parseFloat(l.amount) * (1 + parseFloat(l.interest_rate))
                  - parseFloat(l.amount_repaid);

  if (amt > remaining) {
    return res.status(400).json({
      success: false,
      error:  `Repayment exceeds remaining balance. Remaining: ₦${remaining.toLocaleString()}`,
    });
  }

  // Deduct from wallet or thrift
  if (source === "wallet") {
    await axios.post(`${WALLET_URL}/wallets/withdraw`, {
      amount: amt, currency: "NGN", purpose: `Loan repayment ${l.id}`
    }, { headers: { Authorization: req.headers.authorization } });
  }

  const new_repaid = parseFloat(l.amount_repaid) + amt;
  const is_done    = new_repaid >= remaining;

  await pool.query(
    `UPDATE loans SET amount_repaid=$1,
       repayment_status=$2,
       status=CASE WHEN $3 THEN 'closed' ELSE status END
     WHERE id=$4`,
    [new_repaid,
     is_done ? "completed" : "partial",
     is_done, l.id]
  );

  await pool.query(
    "INSERT INTO loan_repayments(loan_id,user_id,amount,source) VALUES($1,$2,$3,$4)",
    [l.id, user_id, amt, source]
  );

  return res.json({
    success:       true,
    repaid:        amt,
    total_repaid:  new_repaid,
    remaining:     Math.max(0, remaining - amt),
    status:        is_done ? "LOAN FULLY REPAID ✅" : "partial",
    note:          is_done ? "Your trust score will be boosted!" : null,
  });
}));

// ── GET MY LOANS ──────────────────────────────────────────────
app.get("/loans/my", requireAuth, asyncHandler(async (req, res) => {
  const loans = await pool.query(
    "SELECT * FROM loans WHERE user_id=$1 ORDER BY created_at DESC", [req.user.id]
  );
  return res.json({ success: true, loans: loans.rows });
}));

app.use(errorHandler);
app.listen(PORT, () => console.log(`✅ Loan Service running on port ${PORT}`));
module.exports = app;
