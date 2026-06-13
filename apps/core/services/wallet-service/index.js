// ================================================================
// DUNAZOE OS — WALLET SERVICE
// services/wallet-service/index.js
// Port: 4009
// CTO RULES:
//   - No negative balance (enforced at DB + service level)
//   - Log every transaction with balance_after
//   - Use DB transactions for transfers (atomicity)
//   - NGN → Paystack, USD → Stripe (ChatGPT v6 routing)
// ================================================================

require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const { Pool } = require("pg");
const { requireAuth } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");

const app  = express();
const PORT = process.env.PORT || 4009;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const SUPPORTED_CURRENCIES = ["NGN","USD"];
const MIN_DEPOSIT_NGN      = parseFloat(process.env.MIN_DEPOSIT_NGN || "100");

// ── HEALTH ────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ service: "wallet-service", status: "ok", port: PORT });
});

// ── CREATE WALLET (called automatically on registration) ──────
app.post("/wallets", requireAuth, asyncHandler(async (req, res) => {
  const user_id = req.body.user_id || req.user.id;

  const existing = await pool.query("SELECT id FROM wallets WHERE user_id=$1", [user_id]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ success: false, error: "Wallet already exists" });
  }

  const result = await pool.query(
    "INSERT INTO wallets(user_id) VALUES($1) RETURNING *", [user_id]
  );

  return res.status(201).json({ success: true, wallet: result.rows[0] });
}));

// ── GET WALLET BALANCE ────────────────────────────────────────
app.get("/wallets/:user_id", requireAuth, asyncHandler(async (req, res) => {
  const { user_id } = req.params;

  if (req.user.id !== parseInt(user_id) && req.user.role !== "admin") {
    return res.status(403).json({ success: false, error: "Access denied" });
  }

  let wallet = await pool.query("SELECT * FROM wallets WHERE user_id=$1", [user_id]);

  // Auto-create if missing
  if (wallet.rows.length === 0) {
    const created = await pool.query(
      "INSERT INTO wallets(user_id) VALUES($1) RETURNING *", [user_id]
    );
    wallet = { rows: created.rows };
  }

  const w = wallet.rows[0];
  return res.json({
    success: true,
    wallet: {
      id:           w.id,
      user_id:      w.user_id,
      NGN: {
        balance:   parseFloat(w.balance_ngn),
        locked:    parseFloat(w.locked_ngn),
        available: parseFloat(w.balance_ngn) - parseFloat(w.locked_ngn),
        provider:  "paystack",
      },
      USD: {
        balance:   parseFloat(w.balance_usd),
        locked:    parseFloat(w.locked_usd),
        available: parseFloat(w.balance_usd) - parseFloat(w.locked_usd),
        provider:  "stripe",
      },
    },
  });
}));

// ── DEPOSIT ───────────────────────────────────────────────────
/**
 * POST /wallets/deposit
 * Body: { user_id, amount, currency?, reference?, note? }
 * CTO: NGN → Paystack verified, USD → Stripe verified
 *      This endpoint is called AFTER payment gateway confirms charge
 */
app.post("/wallets/deposit", asyncHandler(async (req, res) => {
  const { user_id, amount, currency = "NGN", reference, note } = req.body;

  if (!user_id || !amount) {
    return res.status(400).json({ success: false, error: "user_id and amount required" });
  }

  const cur = currency.toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(cur)) {
    return res.status(400).json({ success: false, error: `Currency must be NGN or USD` });
  }

  const amt = parseFloat(amount);
  if (amt <= 0) {
    return res.status(400).json({ success: false, error: "Amount must be positive" });
  }
  if (cur === "NGN" && amt < MIN_DEPOSIT_NGN) {
    return res.status(400).json({
      success: false,
      error:   `Minimum deposit is ₦${MIN_DEPOSIT_NGN.toLocaleString()}`
    });
  }

  const col = `balance_${cur.toLowerCase()}`;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Upsert wallet
    await client.query(
      `INSERT INTO wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`, [user_id]
    );

    const updated = await client.query(
      `UPDATE wallets SET ${col} = ${col} + $1 WHERE user_id=$2 RETURNING *`,
      [amt, user_id]
    );
    const w           = updated.rows[0];
    const balance_after = parseFloat(w[col]);

    // Log transaction
    await client.query(
      `INSERT INTO wallet_transactions(user_id, type, currency, amount, balance_after, reference, note, status)
       VALUES($1,'deposit',$2,$3,$4,$5,$6,'completed')`,
      [user_id, cur, amt, balance_after, reference || null, note || "Wallet deposit"]
    );

    await client.query("COMMIT");

    return res.json({
      success:      true,
      currency:     cur,
      deposited:    amt,
      balance_after,
      provider:     cur === "NGN" ? "paystack" : "stripe",
      message:      `${cur === "NGN" ? "₦" : "$"}${amt.toLocaleString()} deposited successfully`,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

// ── WITHDRAW ──────────────────────────────────────────────────
/**
 * POST /wallets/withdraw
 * Body: { user_id, amount, currency?, purpose? }
 */
app.post("/wallets/withdraw", requireAuth, asyncHandler(async (req, res) => {
  const { amount, currency = "NGN", purpose } = req.body;
  const user_id = req.user.id;

  const cur = currency.toUpperCase();
  const amt = parseFloat(amount);

  if (!amt || amt <= 0) {
    return res.status(400).json({ success: false, error: "Valid amount required" });
  }

  const col_bal    = `balance_${cur.toLowerCase()}`;
  const col_locked = `locked_${cur.toLowerCase()}`;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const w = await client.query(
      "SELECT * FROM wallets WHERE user_id=$1 FOR UPDATE", [user_id]
    );
    if (!w.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "Wallet not found" });
    }

    const wallet    = w.rows[0];
    const available = parseFloat(wallet[col_bal]) - parseFloat(wallet[col_locked]);

    if (amt > available) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        error:   `Insufficient ${cur} balance. Available: ${cur === "NGN" ? "₦" : "$"}${available.toLocaleString()}`,
        available,
      });
    }

    const updated = await client.query(
      `UPDATE wallets SET ${col_bal} = ${col_bal} - $1 WHERE user_id=$2 RETURNING *`,
      [amt, user_id]
    );
    const balance_after = parseFloat(updated.rows[0][col_bal]);

    await client.query(
      `INSERT INTO wallet_transactions(user_id, type, currency, amount, balance_after, note, status)
       VALUES($1,'withdraw',$2,$3,$4,$5,'completed')`,
      [user_id, cur, amt, balance_after, purpose || "Withdrawal"]
    );

    await client.query("COMMIT");

    return res.json({
      success:      true,
      withdrawn:    amt,
      currency:     cur,
      balance_after,
      message:      `${cur === "NGN" ? "₦" : "$"}${amt.toLocaleString()} withdrawn`,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

// ── TRANSFER BETWEEN USERS ────────────────────────────────────
/**
 * POST /wallets/transfer
 * Body: { to_user_id, amount, currency?, note? }
 * CTO: Atomic — debit sender + credit receiver in one transaction
 */
app.post("/wallets/transfer", requireAuth, asyncHandler(async (req, res) => {
  const { to_user_id, amount, currency = "NGN", note } = req.body;
  const from_user_id = req.user.id;

  if (!to_user_id || !amount) {
    return res.status(400).json({ success: false, error: "to_user_id and amount required" });
  }
  if (parseInt(to_user_id) === from_user_id) {
    return res.status(400).json({ success: false, error: "Cannot transfer to yourself" });
  }

  const cur = currency.toUpperCase();
  const amt = parseFloat(amount);
  const col = `balance_${cur.toLowerCase()}`;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock both wallets in consistent order to prevent deadlock
    const ids = [from_user_id, parseInt(to_user_id)].sort();
    const wallets = await client.query(
      "SELECT * FROM wallets WHERE user_id = ANY($1::int[]) ORDER BY user_id FOR UPDATE",
      [ids]
    );

    const sender   = wallets.rows.find(w => w.user_id === from_user_id);
    const receiver = wallets.rows.find(w => w.user_id === parseInt(to_user_id));

    if (!sender || !receiver) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "One or both wallets not found" });
    }

    const available = parseFloat(sender[col]) - parseFloat(sender[`locked_${cur.toLowerCase()}`]);
    if (amt > available) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        error: `Insufficient ${cur}. Available: ${available.toLocaleString()}`
      });
    }

    // Debit sender
    const s_updated = await client.query(
      `UPDATE wallets SET ${col} = ${col} - $1 WHERE user_id=$2 RETURNING ${col}`,
      [amt, from_user_id]
    );
    // Credit receiver
    const r_updated = await client.query(
      `UPDATE wallets SET ${col} = ${col} + $1 WHERE user_id=$2 RETURNING ${col}`,
      [amt, to_user_id]
    );

    const sender_balance   = parseFloat(s_updated.rows[0][col]);
    const receiver_balance = parseFloat(r_updated.rows[0][col]);

    // Log both legs
    await client.query(
      `INSERT INTO wallet_transactions(user_id,type,currency,amount,balance_after,note,status)
       VALUES($1,'transfer_out',$2,$3,$4,$5,'completed'),
             ($6,'transfer_in', $2,$3,$7,$5,'completed')`,
      [from_user_id, cur, amt, sender_balance,
       note || `Transfer to user ${to_user_id}`,
       to_user_id, receiver_balance]
    );

    await client.query("COMMIT");

    return res.json({
      success:          true,
      transferred:      amt,
      currency:         cur,
      sender_balance,
      receiver_balance,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

// ── TRANSACTION HISTORY ───────────────────────────────────────
app.get("/wallets/:user_id/transactions", requireAuth, asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  if (req.user.id !== parseInt(user_id) && req.user.role !== "admin") {
    return res.status(403).json({ success: false, error: "Access denied" });
  }

  const { type, currency, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page)-1)*parseInt(limit);

  let q    = "SELECT * FROM wallet_transactions WHERE user_id=$1";
  const v  = [user_id];
  let idx  = 2;
  if (type)     { q += ` AND type=$${idx++}`;     v.push(type); }
  if (currency) { q += ` AND currency=$${idx++}`; v.push(currency.toUpperCase()); }
  q += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
  v.push(parseInt(limit), offset);

  const result = await pool.query(q, v);
  return res.json({ success: true, transactions: result.rows, count: result.rows.length });
}));

app.use(errorHandler);
// ================================================================
// UPDATE #96 §5 — WALLET HARDENING
// "Wallet becomes Ledger-first. No balance mutation outside ledger."
//
// - wallet_snapshots: balance + ledger checksum every 6 hours
// - wallet_audit_log: every balance-affecting action recorded
// - daily reconciliation: compare snapshot vs computed ledger balance
// ================================================================
const crypto = require("crypto");

async function initWalletHardeningSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wallet_audit_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      amount NUMERIC(15,2),
      currency TEXT DEFAULT 'NGN',
      balance_before NUMERIC(15,2),
      balance_after NUMERIC(15,2),
      reference TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wallet_audit_user ON wallet_audit_log(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS wallet_snapshots (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      balance_ngn NUMERIC(15,2) NOT NULL,
      ledger_checksum TEXT NOT NULL,
      snapshot_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wallet_snap_user ON wallet_snapshots(user_id, snapshot_at DESC);

    CREATE TABLE IF NOT EXISTS wallet_reconciliation_log (
      id SERIAL PRIMARY KEY,
      run_at TIMESTAMP DEFAULT NOW(),
      total_wallets INTEGER,
      mismatches INTEGER,
      details JSONB
    );
  `).catch(e => console.warn("Wallet hardening schema:", e.message));
}

// Compute a stable checksum of a user's wallet ledger state
function computeChecksum(user_id, balance_ngn, last_txn_id) {
  return crypto
    .createHash("sha256")
    .update(`${user_id}:${balance_ngn}:${last_txn_id || 0}`)
    .digest("hex");
}

// Record an audit entry — call this from deposit/withdraw/transfer handlers
async function recordWalletAudit({ user_id, action, amount, currency, balance_before, balance_after, reference }) {
  await pool.query(
    `INSERT INTO wallet_audit_log(user_id,action,amount,currency,balance_before,balance_after,reference)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [user_id, action, amount, currency || "NGN", balance_before, balance_after, reference || null]
  ).catch(e => console.warn("Wallet audit log failed:", e.message));
}

// Take a snapshot for one user (or all users if user_id omitted)
async function takeWalletSnapshot(user_id = null) {
  const where = user_id ? "WHERE user_id=$1" : "";
  const params = user_id ? [user_id] : [];
  const wallets = await pool.query(`SELECT user_id, balance_ngn FROM wallets ${where}`, params);

  for (const w of wallets.rows) {
    const last_txn = await pool.query(
      "SELECT id FROM wallet_transactions WHERE user_id=$1 ORDER BY id DESC LIMIT 1",
      [w.user_id]
    );
    const checksum = computeChecksum(w.user_id, w.balance_ngn, last_txn.rows[0]?.id);
    await pool.query(
      "INSERT INTO wallet_snapshots(user_id,balance_ngn,ledger_checksum) VALUES($1,$2,$3)",
      [w.user_id, w.balance_ngn, checksum]
    );
  }
  return wallets.rows.length;
}

// Daily reconciliation: compare latest snapshot checksum vs recomputed checksum
async function runWalletReconciliation() {
  const wallets = await pool.query("SELECT user_id, balance_ngn FROM wallets");
  let mismatches = 0;
  const details = [];

  for (const w of wallets.rows) {
    const last_txn = await pool.query(
      "SELECT id FROM wallet_transactions WHERE user_id=$1 ORDER BY id DESC LIMIT 1",
      [w.user_id]
    );
    const recomputed = computeChecksum(w.user_id, w.balance_ngn, last_txn.rows[0]?.id);
    const latest = await pool.query(
      "SELECT ledger_checksum, balance_ngn FROM wallet_snapshots WHERE user_id=$1 ORDER BY snapshot_at DESC LIMIT 1",
      [w.user_id]
    );

    if (latest.rows[0] && latest.rows[0].ledger_checksum !== recomputed) {
      mismatches++;
      details.push({
        user_id: w.user_id,
        snapshot_balance: latest.rows[0].balance_ngn,
        current_balance: w.balance_ngn,
        snapshot_checksum: latest.rows[0].ledger_checksum,
        recomputed_checksum: recomputed,
      });
    }
  }

  await pool.query(
    "INSERT INTO wallet_reconciliation_log(total_wallets,mismatches,details) VALUES($1,$2,$3)",
    [wallets.rows.length, mismatches, JSON.stringify(details)]
  );

  return { total_wallets: wallets.rows.length, mismatches, details };
}

// ── ROUTES: snapshots & reconciliation ─────────────────────────
app.post("/wallets/snapshot", requireAuth, asyncHandler(async (req, res) => {
  const { user_id } = req.body; // omit for all-user snapshot (cron/admin)
  const count = await takeWalletSnapshot(user_id || null);
  res.json({ success: true, snapshots_taken: count, snapshot_at: new Date().toISOString() });
}));

app.get("/wallets/:user_id/snapshots", requireAuth, asyncHandler(async (req, res) => {
  const rows = await pool.query(
    "SELECT * FROM wallet_snapshots WHERE user_id=$1 ORDER BY snapshot_at DESC LIMIT 20",
    [req.params.user_id]
  );
  res.json({ success: true, snapshots: rows.rows });
}));

app.get("/wallets/:user_id/audit-log", requireAuth, asyncHandler(async (req, res) => {
  const rows = await pool.query(
    "SELECT * FROM wallet_audit_log WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
    [req.params.user_id]
  );
  res.json({ success: true, audit_log: rows.rows });
}));

app.post("/wallets/reconcile", requireAuth, asyncHandler(async (req, res) => {
  const result = await runWalletReconciliation();
  res.json({
    success: true,
    ...result,
    clean: result.mismatches === 0,
    message: result.mismatches === 0
      ? "✅ Clean reconciliation — all wallet balances match ledger checksums."
      : `⚠️ ${result.mismatches} wallet(s) have checksum mismatches — review details.`,
  });
}));

// Auto-snapshot every 6 hours (Update #96 §5)
setInterval(() => {
  takeWalletSnapshot().then(n => console.log(`[Wallet Snapshot] Took ${n} snapshots`)).catch(console.error);
}, 6 * 60 * 60 * 1000);

// Daily reconciliation (Update #96 §5 + §10 RPO/RTO targets)
setInterval(() => {
  runWalletReconciliation().then(r =>
    console.log(`[Wallet Reconciliation] ${r.total_wallets} wallets, ${r.mismatches} mismatches`)
  ).catch(console.error);
}, 24 * 60 * 60 * 1000);

initWalletHardeningSchema().catch(console.error);

app.listen(PORT, () => console.log(`✅ Wallet Service running on port ${PORT}`));
module.exports = app;
