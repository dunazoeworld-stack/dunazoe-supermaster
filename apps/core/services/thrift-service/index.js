// ================================================================
// DUNAZOE OS — THRIFT SERVICE (AJO SAVINGS)
// services/thrift-service/index.js
// Port: 4010
// The DUNAZOE Ajo engine: save → earn interest → lock for purchase
// Supports: personal, commerce, group (rotating Ajo)
// ================================================================

require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const { Pool } = require("pg");
const { requireAuth } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");

const app  = express();
const PORT = process.env.PORT || 4010;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const MIN_CONTRIBUTION  = parseFloat(process.env.THRIFT_MIN || "1000");
const ANNUAL_INTEREST   = parseFloat(process.env.THRIFT_INTEREST || "0.05");   // 5% p.a.
const AJO_SURCHARGE_WKS = parseInt(process.env.AJO_SURCHARGE_WEEKS || "2");
const AJO_SURCHARGE_PCT = parseFloat(process.env.AJO_SURCHARGE_PCT || "0.10"); // +10%

// ── HEALTH ────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ service: "thrift-service", status: "ok", port: PORT });
});

// ── OPEN THRIFT ACCOUNT ───────────────────────────────────────
app.post("/thrift/accounts", requireAuth, asyncHandler(async (req, res) => {
  const {
    purpose = "personal", plan_type = "monthly",
    target_amount = 0, target_date, ajo_weeks = 0
  } = req.body;

  const existing = await pool.query(
    "SELECT id FROM thrift_accounts WHERE user_id=$1", [req.user.id]
  );
  if (existing.rows.length > 0) {
    return res.status(409).json({ success: false, error: "Thrift account already exists" });
  }

  const result = await pool.query(
    `INSERT INTO thrift_accounts(user_id, purpose, plan_type, target_amount, target_date, ajo_weeks)
     VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user.id, purpose, plan_type, parseFloat(target_amount), target_date || null, parseInt(ajo_weeks)]
  );

  return res.status(201).json({
    success: true,
    account: result.rows[0],
    note:    "Your Ajo savings account is active. Start contributing to earn 5% annual interest!",
  });
}));

// ── GET THRIFT ACCOUNT ────────────────────────────────────────
app.get("/thrift/accounts/:user_id", requireAuth, asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  if (req.user.id !== parseInt(user_id) && req.user.role !== "admin") {
    return res.status(403).json({ success: false, error: "Access denied" });
  }

  const acc = await pool.query("SELECT * FROM thrift_accounts WHERE user_id=$1", [user_id]);
  if (!acc.rows[0]) {
    return res.status(404).json({ success: false, error: "No thrift account found" });
  }

  const a    = acc.rows[0];
  const prog = a.target_amount > 0
    ? Math.min(100, parseFloat((a.balance / a.target_amount * 100).toFixed(1)))
    : 0;

  const txns = await pool.query(
    "SELECT * FROM thrift_contributions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10",
    [user_id]
  );

  return res.json({
    success:      true,
    account:      a,
    available:    parseFloat(a.balance) - parseFloat(a.locked),
    progress_pct: prog,
    recent:       txns.rows,
  });
}));

// ── CONTRIBUTE ────────────────────────────────────────────────
app.post("/thrift/contribute", requireAuth, asyncHandler(async (req, res) => {
  const { amount, reference, note } = req.body;

  const amt = parseFloat(amount);
  if (!amt || amt < MIN_CONTRIBUTION) {
    return res.status(400).json({
      success: false,
      error:   `Minimum contribution is ₦${MIN_CONTRIBUTION.toLocaleString()}`
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const acc = await client.query(
      "SELECT * FROM thrift_accounts WHERE user_id=$1 FOR UPDATE", [req.user.id]
    );
    if (!acc.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "No thrift account found" });
    }

    const new_balance = parseFloat(acc.rows[0].balance) + amt;

    await client.query(
      "UPDATE thrift_accounts SET balance=$1 WHERE user_id=$2",
      [new_balance, req.user.id]
    );

    await client.query(
      `INSERT INTO thrift_contributions(account_id, user_id, type, amount, balance_after, reference, note)
       VALUES($1,$2,'contribution',$3,$4,$5,$6)`,
      [acc.rows[0].id, req.user.id, amt, new_balance, reference || null, note || "Ajo contribution"]
    );

    await client.query("COMMIT");

    const target  = parseFloat(acc.rows[0].target_amount || 0);
    const prog    = target > 0 ? Math.min(100, parseFloat((new_balance/target*100).toFixed(1))) : 0;

    return res.json({
      success:      true,
      contributed:  amt,
      new_balance,
      available:    new_balance - parseFloat(acc.rows[0].locked),
      progress_pct: prog,
      message:      `₦${amt.toLocaleString()} added to your Ajo savings`,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

// ── WITHDRAW ──────────────────────────────────────────────────
app.post("/thrift/withdraw", requireAuth, asyncHandler(async (req, res) => {
  const { amount, purpose } = req.body;
  const amt = parseFloat(amount);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const acc = await client.query(
      "SELECT * FROM thrift_accounts WHERE user_id=$1 FOR UPDATE", [req.user.id]
    );
    if (!acc.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "No thrift account found" });
    }

    const a         = acc.rows[0];
    const available = parseFloat(a.balance) - parseFloat(a.locked);

    if (amt > available) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success:   false,
        error:     `Insufficient balance. Available: ₦${available.toLocaleString()}`,
        available,
      });
    }

    const new_balance = parseFloat(a.balance) - amt;
    await client.query(
      "UPDATE thrift_accounts SET balance=$1 WHERE user_id=$2", [new_balance, req.user.id]
    );
    await client.query(
      `INSERT INTO thrift_contributions(account_id, user_id, type, amount, balance_after, note)
       VALUES($1,$2,'withdrawal',$3,$4,$5)`,
      [a.id, req.user.id, amt, new_balance, purpose || "Withdrawal"]
    );

    await client.query("COMMIT");
    return res.json({ success: true, withdrawn: amt, new_balance });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

// ── LOCK FOR PURCHASE ─────────────────────────────────────────
app.post("/thrift/lock", requireAuth, asyncHandler(async (req, res) => {
  const { amount, order_id } = req.body;
  const amt = parseFloat(amount);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const acc = await client.query(
      "SELECT * FROM thrift_accounts WHERE user_id=$1 FOR UPDATE", [req.user.id]
    );
    const a         = acc.rows[0];
    const available = parseFloat(a.balance) - parseFloat(a.locked);

    if (amt > available) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "Insufficient available balance" });
    }

    await client.query(
      "UPDATE thrift_accounts SET locked=locked+$1 WHERE user_id=$2", [amt, req.user.id]
    );
    await client.query(
      `INSERT INTO thrift_contributions(account_id, user_id, type, amount, balance_after, note)
       VALUES($1,$2,'lock',$3,$4,$5)`,
      [a.id, req.user.id, amt, parseFloat(a.balance), `Locked for order ${order_id}`]
    );

    await client.query("COMMIT");
    return res.json({
      success:   true,
      locked:    amt,
      order_id,
      available: available - amt,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

// ── APPLY MONTHLY INTEREST ────────────────────────────────────
// Called by a cron job — not exposed to users
app.post("/thrift/apply-interest", asyncHandler(async (req, res) => {
  const internal_key = req.headers["x-internal-key"];
  if (internal_key !== process.env.INTERNAL_SECRET) {
    return res.status(401).json({ success: false, error: "Unauthorised" });
  }

  const accounts = await pool.query(
    "SELECT * FROM thrift_accounts WHERE balance > 0"
  );

  const monthly_rate = ANNUAL_INTEREST / 12;
  let total_interest = 0;
  let count          = 0;

  for (const a of accounts.rows) {
    const interest    = parseFloat((parseFloat(a.balance) * monthly_rate).toFixed(2));
    const new_balance = parseFloat(a.balance) + interest;

    await pool.query(
      `UPDATE thrift_accounts SET balance=$1, interest_earned=interest_earned+$2 WHERE id=$3`,
      [new_balance, interest, a.id]
    );
    await pool.query(
      `INSERT INTO thrift_contributions(account_id, user_id, type, amount, balance_after, note)
       VALUES($1,$2,'interest',$3,$4,$5)`,
      [a.id, a.user_id, interest, new_balance, `Monthly interest @ ${(monthly_rate*100).toFixed(3)}%`]
    );
    total_interest += interest;
    count++;
  }

  return res.json({
    success: true, accounts_updated: count,
    total_interest_paid: total_interest,
    rate: `${(monthly_rate*100).toFixed(3)}% monthly (${ANNUAL_INTEREST*100}% annual)`,
  });
}));

// ── AJO GROUP ─────────────────────────────────────────────────
app.post("/thrift/groups", requireAuth, asyncHandler(async (req, res) => {
  const { name, contribution_amount, cycle_days = 30 } = req.body;
  if (!name || !contribution_amount) {
    return res.status(400).json({ success: false, error: "name and contribution_amount required" });
  }
  const result = await pool.query(
    `INSERT INTO thrift_groups(name, coordinator_id, contribution_amount, cycle_days)
     VALUES($1,$2,$3,$4) RETURNING *`,
    [name, req.user.id, parseFloat(contribution_amount), parseInt(cycle_days)]
  );
  return res.status(201).json({ success: true, group: result.rows[0] });
}));

// ── SET SAVINGS TARGET ────────────────────────────────────────
app.put("/thrift/target", requireAuth, asyncHandler(async (req, res) => {
  const { target_amount, target_date } = req.body;
  await pool.query(
    "UPDATE thrift_accounts SET target_amount=$1, target_date=$2 WHERE user_id=$3",
    [parseFloat(target_amount), target_date, req.user.id]
  );
  return res.json({ success: true, target_amount, target_date });
}));

app.use(errorHandler);
app.listen(PORT, () => console.log(`✅ Thrift Service running on port ${PORT}`));
module.exports = app;
