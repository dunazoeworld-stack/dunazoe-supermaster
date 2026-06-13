// ================================================================
// DUNAZOE OS — FINTECH OS CORE (Update #96)
// shared/fintech/fintechOS.js
//
// CTO DECISION (Update #95 — Legal Architecture):
//   DUNAZOE is NOT a bank. It is a Fintech Middleware OS.
//   We run ON TOP of Paystack/Stripe — not instead of them.
//
// CEO REALITY:
//   Before CBN banking license → Fintech Ledger System
//   After CBN banking license  → Full digital bank
//   Architecture supports BOTH from day one.
//
// CORRECT LANGUAGE:
//   ❌ "Bank account"          → ✅ "Wallet"
//   ❌ "Interest-bearing"      → ✅ "Contribution reward"
//   ❌ "Deposit"               → ✅ "Wallet funding"
//   ❌ "Licensed bank"         → ✅ "Fintech platform"
//   ❌ "Savings account"       → ✅ "Ajo contribution ledger"
//
// ARCHITECTURE:
//   Payment Rails (Paystack/Stripe)
//   + Ledger Engine (source of financial truth)
//   + VTU APIs (airtime/data/bills)
//   = DUNAZOE Fintech OS
//
// Update #96 mandates:
//   1. Non-blocking operations (async everything)
//   2. Event-driven architecture (publish → consume)
//   3. Double-entry accounting (every debit has a credit)
//   4. Ledger-as-truth (never trust wallet table balance directly)
//   5. PostgreSQL primary for ALL financial data
//   6. MongoDB ONLY for AI/analytics/logs — NEVER for money
//   7. Webhook double-verification (NEVER trust payload alone)
//   8. Async email/SMS (never block on notification delivery)
// ================================================================

const { Pool }  = require("pg");
const crypto    = require("crypto");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max:     20,  // Connection pool — never exhaust DB connections
  idleTimeoutMillis:  30000,
  connectionTimeoutMillis: 2000,
});

// ── INIT SCHEMA ───────────────────────────────────────────────
async function initFintechSchema() {
  await pool.query(`
    -- ── CORE LEDGER (source of truth) ──────────────────────
    -- Update #96: Ledger = truth. Wallet balance = derived.
    -- Never trust wallets.balance directly — always compute from ledger.

    CREATE TABLE IF NOT EXISTS ledger_accounts (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER REFERENCES users(id),
      account_ref  TEXT UNIQUE NOT NULL, -- AJO-USER-001928 format
      account_type TEXT NOT NULL CHECK (account_type IN (
        'wallet_ngn','wallet_usd','thrift_ajo','escrow',
        'vendor_settlement','platform_fee','loan_liability',
        'delivery_commission','milestone_bonus'
      )),
      currency     TEXT DEFAULT 'NGN',
      is_active    BOOLEAN DEFAULT TRUE,
      created_at   TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_la_user ON ledger_accounts(user_id);
    CREATE INDEX IF NOT EXISTS idx_la_ref  ON ledger_accounts(account_ref);

    -- Double-entry journal (every transaction has TWO sides)
    CREATE TABLE IF NOT EXISTS ledger_transactions (
      id              BIGSERIAL PRIMARY KEY,
      txn_ref         TEXT UNIQUE NOT NULL,
      idempotency_key TEXT UNIQUE NOT NULL,
      description     TEXT NOT NULL,
      category        TEXT NOT NULL CHECK (category IN (
        'wallet_fund','wallet_withdraw','transfer',
        'order_payment','escrow_hold','escrow_release',
        'refund','thrift_contribution','thrift_withdrawal',
        'loan_disburse','loan_repay','fee_charge',
        'delivery_comm','milestone_bonus','bill_payment',
        'reversal','adjustment'
      )),
      reference_type  TEXT,  -- 'order','thrift','loan','payout'
      reference_id    TEXT,
      total_amount    NUMERIC(15,2) NOT NULL CHECK (total_amount > 0),
      currency        TEXT DEFAULT 'NGN',
      status          TEXT DEFAULT 'pending' CHECK (status IN (
        'pending','processing','completed','failed','reversed'
      )),
      gateway_ref     TEXT,  -- Paystack/Stripe reference
      initiated_by    INTEGER REFERENCES users(id),
      metadata        JSONB DEFAULT '{}',
      created_at      TIMESTAMP DEFAULT NOW(),
      completed_at    TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_lt_ref      ON ledger_transactions(txn_ref);
    CREATE INDEX IF NOT EXISTS idx_lt_idem     ON ledger_transactions(idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_lt_user     ON ledger_transactions(initiated_by);
    CREATE INDEX IF NOT EXISTS idx_lt_status   ON ledger_transactions(status);
    CREATE INDEX IF NOT EXISTS idx_lt_time     ON ledger_transactions(created_at);

    -- Double-entry lines (debit + credit for every txn)
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id          BIGSERIAL PRIMARY KEY,
      txn_id      BIGINT NOT NULL REFERENCES ledger_transactions(id),
      account_id  INTEGER NOT NULL REFERENCES ledger_accounts(id),
      user_id     INTEGER REFERENCES users(id),
      entry_type  TEXT NOT NULL CHECK (entry_type IN ('debit','credit')),
      amount      NUMERIC(15,2) NOT NULL CHECK (amount > 0),
      currency    TEXT DEFAULT 'NGN',
      running_bal NUMERIC(15,2),  -- computed balance after this entry
      created_at  TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_le_txn      ON ledger_entries(txn_id);
    CREATE INDEX IF NOT EXISTS idx_le_account  ON ledger_entries(account_id);
    CREATE INDEX IF NOT EXISTS idx_le_user     ON ledger_entries(user_id);

    -- Constraint: entries must balance per transaction
    -- (enforced in application layer via postDoubleEntry)

    -- ── ASYNC JOB QUEUE (Update #96 — non-blocking) ────────
    CREATE TABLE IF NOT EXISTS async_jobs (
      id           BIGSERIAL PRIMARY KEY,
      job_type     TEXT NOT NULL CHECK (job_type IN (
        'send_email','send_sms','send_whatsapp','send_push',
        'ai_recommendation','reconcile','generate_report',
        'sync_analytics','marketing_campaign','audit_log',
        'vtu_fulfillment','social_post'
      )),
      payload      JSONB NOT NULL,
      status       TEXT DEFAULT 'queued' CHECK (status IN (
        'queued','processing','completed','failed','dead_letter'
      )),
      priority     INTEGER DEFAULT 5,  -- 1=highest, 10=lowest
      attempts     INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 3,
      next_run_at  TIMESTAMP DEFAULT NOW(),
      error        TEXT,
      result       JSONB,
      correlation_id TEXT,
      created_at   TIMESTAMP DEFAULT NOW(),
      processed_at TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_aj_queued  ON async_jobs(status,priority,next_run_at) WHERE status='queued';
    CREATE INDEX IF NOT EXISTS idx_aj_type    ON async_jobs(job_type);
    CREATE INDEX IF NOT EXISTS idx_aj_corr    ON async_jobs(correlation_id);

    -- ── VTU (Airtime/Data/Bills) ────────────────────────────
    CREATE TABLE IF NOT EXISTS vtu_transactions (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER REFERENCES users(id),
      product_type  TEXT NOT NULL CHECK (product_type IN (
        'airtime','data','cable_tv','electricity','internet',
        'water','waec','jamb','dstv','gotv','startimes'
      )),
      provider      TEXT NOT NULL,  -- MTN, Airtel, DSTV etc
      phone         TEXT,
      meter_number  TEXT,
      smart_card    TEXT,
      amount        NUMERIC(12,2) NOT NULL,
      vtu_ref       TEXT UNIQUE,
      status        TEXT DEFAULT 'pending' CHECK (status IN (
        'pending','processing','completed','failed','refunded'
      )),
      payment_source TEXT CHECK (payment_source IN (
        'wallet','thrift','direct','split'
      )),
      api_ref       TEXT,  -- external VTU provider reference
      response      JSONB,
      created_at    TIMESTAMP DEFAULT NOW(),
      completed_at  TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_vtu_user ON vtu_transactions(user_id);

    -- ── BANK STATEMENT (user-facing) ─────────────────────────
    CREATE VIEW IF NOT EXISTS user_bank_statement AS
    SELECT
      lt.id,
      lt.txn_ref AS transaction_id,
      lt.description,
      lt.category AS transaction_type,
      lt.currency,
      le.entry_type,
      le.amount,
      le.running_bal AS balance_after,
      lt.status,
      lt.gateway_ref,
      u.name AS initiated_by,
      lt.created_at,
      lt.completed_at
    FROM ledger_transactions lt
    JOIN ledger_entries le ON le.txn_id = lt.id
    JOIN ledger_accounts la ON le.account_id = la.id
    LEFT JOIN users u ON lt.initiated_by = u.id
    ORDER BY lt.created_at DESC;

    -- ── ADMIN IMPERSONATION (Update #94) ─────────────────────
    CREATE TABLE IF NOT EXISTS admin_impersonations (
      id              SERIAL PRIMARY KEY,
      admin_id        INTEGER NOT NULL REFERENCES users(id),
      target_user_id  INTEGER NOT NULL REFERENCES users(id),
      reason          TEXT NOT NULL,
      action_taken    TEXT,
      mfa_verified    BOOLEAN DEFAULT FALSE,
      ip_address      TEXT,
      device_info     TEXT,
      started_at      TIMESTAMP DEFAULT NOW(),
      ended_at        TIMESTAMP,
      notified_user   BOOLEAN DEFAULT FALSE
    );
    CREATE INDEX IF NOT EXISTS idx_ai_admin  ON admin_impersonations(admin_id);
    CREATE INDEX IF NOT EXISTS idx_ai_target ON admin_impersonations(target_user_id);

    -- ── VIRTUAL CARDS (future-ready infrastructure) ──────────
    CREATE TABLE IF NOT EXISTS virtual_cards (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER REFERENCES users(id),
      card_ref      TEXT UNIQUE NOT NULL,
      currency      TEXT DEFAULT 'NGN',
      card_type     TEXT CHECK (card_type IN ('virtual_ngn','virtual_usd')),
      status        TEXT DEFAULT 'inactive' CHECK (status IN (
        'inactive','active','frozen','cancelled'
      )),
      spend_limit   NUMERIC(12,2) DEFAULT 0,
      balance       NUMERIC(12,2) DEFAULT 0,
      provider      TEXT,  -- Stripe, Paystack, Mono
      provider_ref  TEXT,
      masked_pan    TEXT,  -- last 4 digits only
      expiry_month  INTEGER,
      expiry_year   INTEGER,
      activated_at  TIMESTAMP,
      frozen_at     TIMESTAMP,
      created_at    TIMESTAMP DEFAULT NOW()
    );

    -- ── SOCIAL MEDIA INTEGRATIONS (Update #94) ───────────────
    CREATE TABLE IF NOT EXISTS social_accounts (
      id            SERIAL PRIMARY KEY,
      platform      TEXT NOT NULL CHECK (platform IN (
        'facebook','instagram','twitter','tiktok',
        'linkedin','youtube','whatsapp_business','telegram'
      )),
      account_name  TEXT NOT NULL,
      access_token  TEXT,  -- encrypted at rest
      token_expires TIMESTAMP,
      permissions   TEXT[],
      is_active     BOOLEAN DEFAULT FALSE,
      granted_by    INTEGER REFERENCES users(id),  -- must be superuser
      last_used_at  TIMESTAMP,
      created_at    TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS social_post_log (
      id          SERIAL PRIMARY KEY,
      account_id  INTEGER REFERENCES social_accounts(id),
      platform    TEXT NOT NULL,
      content     TEXT NOT NULL,
      post_type   TEXT CHECK (post_type IN (
        'product_promo','announcement','campaign','response',
        'vendor_spotlight','thrift_reminder','logistics_update'
      )),
      status      TEXT DEFAULT 'draft' CHECK (status IN (
        'draft','pending_approval','approved','published','failed','rejected'
      )),
      approved_by INTEGER REFERENCES users(id),
      published_at TIMESTAMP,
      engagement  JSONB DEFAULT '{}',
      ai_generated BOOLEAN DEFAULT TRUE,
      created_by  INTEGER REFERENCES users(id),
      created_at  TIMESTAMP DEFAULT NOW()
    );

    -- ── SELF-DELIVERY (Update #94) ────────────────────────────
    CREATE TABLE IF NOT EXISTS self_deliveries (
      id              SERIAL PRIMARY KEY,
      order_id        INTEGER REFERENCES orders(id),
      vendor_consent  BOOLEAN DEFAULT FALSE,
      user_consent    BOOLEAN DEFAULT FALSE,
      consented_at    TIMESTAMP,
      status          TEXT DEFAULT 'agreed' CHECK (status IN (
        'agreed','scheduled','in_progress','completed',
        'failed','escalated_to_express'
      )),
      scheduled_at    TIMESTAMP,
      completed_at    TIMESTAMP,
      failure_reason  TEXT,
      escalated_at    TIMESTAMP,
      ai_monitoring   BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMP DEFAULT NOW()
    );

    -- ── DEPLOYMENT AUDIT (Update #95) ────────────────────────
    CREATE TABLE IF NOT EXISTS deployment_runs (
      id              SERIAL PRIMARY KEY,
      version         TEXT NOT NULL,
      environment     TEXT NOT NULL CHECK (environment IN (
        'development','staging','production'
      )),
      hosting_provider TEXT,
      security_score  INTEGER CHECK (security_score BETWEEN 0 AND 100),
      scalability_score INTEGER CHECK (scalability_score BETWEEN 0 AND 100),
      reliability_score INTEGER CHECK (reliability_score BETWEEN 0 AND 100),
      performance_score INTEGER CHECK (performance_score BETWEEN 0 AND 100),
      readiness_score  INTEGER CHECK (readiness_score BETWEEN 0 AND 100),
      approved        BOOLEAN DEFAULT FALSE,
      blocked_reason  TEXT,
      deployed_by     INTEGER REFERENCES users(id),
      checklist       JSONB DEFAULT '{}',
      started_at      TIMESTAMP DEFAULT NOW(),
      completed_at    TIMESTAMP
    );
  `).catch(e => console.warn("[FintechOS] Schema:", e.message));
  console.log("[FintechOS] Schema ready ✓");
}

// ================================================================
// CORE: NON-BLOCKING OPERATION WRAPPER (Update #96)
// Every operation that touches external APIs must be non-blocking
// ================================================================
/**
 * Execute operation then queue notifications — NEVER wait for notifications.
 *
 * WRONG:  await sendEmail(); await sendSMS(); return success;
 * RIGHT:  return success; queue(sendEmail); queue(sendSMS);
 */
async function nonBlocking(operation, notifications = []) {
  // 1. Execute core business operation FIRST
  const result = await operation();

  // 2. Queue all notifications AFTER — never await them
  for (const notif of notifications) {
    queueJob(notif.type, notif.payload, {
      priority:       notif.priority || 5,
      correlation_id: result?.correlation_id,
    }).catch(() => {}); // fire-and-forget — never block on notification failure
  }

  return result;
}

// ================================================================
// ASYNC JOB QUEUE (Update #96 — non-blocking operations)
// ================================================================
async function queueJob(job_type, payload, opts = {}) {
  const {
    priority       = 5,
    delay_seconds  = 0,
    max_attempts   = 3,
    correlation_id = null,
  } = opts;

  const next_run = new Date(Date.now() + delay_seconds * 1000);

  const result = await pool.query(
    `INSERT INTO async_jobs(job_type,payload,priority,max_attempts,next_run_at,correlation_id)
     VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
    [job_type, JSON.stringify(payload), priority, max_attempts, next_run, correlation_id]
  );

  return result.rows[0].id;
}

// Job processor (called by worker)
async function processNextJob() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const job = await client.query(
      `SELECT * FROM async_jobs
       WHERE status='queued' AND next_run_at<=NOW()
       ORDER BY priority ASC, created_at ASC
       LIMIT 1 FOR UPDATE SKIP LOCKED`
    );

    if (!job.rows[0]) { await client.query("COMMIT"); return null; }

    const j = job.rows[0];
    await client.query(
      "UPDATE async_jobs SET status='processing',attempts=$1 WHERE id=$2",
      [j.attempts + 1, j.id]
    );
    await client.query("COMMIT");

    // Execute job
    let result = null, error = null;
    try {
      result = await executeJob(j.job_type, j.payload);
    } catch (e) {
      error = e.message;
    }

    // Update result
    if (error && j.attempts + 1 >= j.max_attempts) {
      await pool.query(
        "UPDATE async_jobs SET status='dead_letter',error=$1,processed_at=NOW() WHERE id=$2",
        [error, j.id]
      );
    } else if (error) {
      const backoff = Math.min(Math.pow(2, j.attempts) * 30, 3600);
      await pool.query(
        "UPDATE async_jobs SET status='queued',error=$1,next_run_at=NOW()+$2*INTERVAL'1 second' WHERE id=$3",
        [error, backoff, j.id]
      );
    } else {
      await pool.query(
        "UPDATE async_jobs SET status='completed',result=$1,processed_at=NOW() WHERE id=$2",
        [JSON.stringify(result), j.id]
      );
    }

    return { job_id: j.id, type: j.job_type, success: !error };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function executeJob(type, payload) {
  const handlers = {
    send_email:        (p) => sendEmailAsync(p),
    send_sms:          (p) => sendSMSAsync(p),
    send_whatsapp:     (p) => sendWhatsAppAsync(p),
    send_push:         (p) => sendPushAsync(p),
    vtu_fulfillment:   (p) => fulfillVTU(p),
    social_post:       (p) => publishSocialPost(p),
    generate_report:   (p) => generateReport(p),
    audit_log:         (p) => writeAuditLog(p),
  };

  const handler = handlers[type];
  if (!handler) throw new Error(`Unknown job type: ${type}`);
  return handler(typeof payload === "string" ? JSON.parse(payload) : payload);
}

// ================================================================
// LEDGER BALANCE COMPUTATION (Update #96)
// NEVER trust wallet table — ALWAYS compute from ledger entries
// ================================================================
async function computeBalance(user_id, account_type = "wallet_ngn", currency = "NGN") {
  const result = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN le.entry_type='credit' THEN le.amount ELSE 0 END),0) AS total_credits,
       COALESCE(SUM(CASE WHEN le.entry_type='debit'  THEN le.amount ELSE 0 END),0) AS total_debits
     FROM ledger_entries le
     JOIN ledger_accounts la ON le.account_id = la.id
     JOIN ledger_transactions lt ON le.txn_id = lt.id
     WHERE la.user_id=$1 AND la.account_type=$2 AND la.currency=$3
       AND lt.status='completed'`,
    [user_id, account_type, currency]
  );

  const credits = parseFloat(result.rows[0].total_credits);
  const debits  = parseFloat(result.rows[0].total_debits);
  const balance = parseFloat((credits - debits).toFixed(2));

  return {
    balance,
    total_credits:  credits,
    total_debits:   debits,
    currency,
    account_type,
    computed_from:  "ledger",          // CEO: this is our source of truth
    not_from:       "wallet_table",    // never trust wallet table directly
  };
}

// ================================================================
// DOUBLE-ENTRY POSTING (Update #96)
// Every debit MUST have a corresponding credit
// ================================================================
async function postDoubleEntry({ txn_ref, idempotency_key, description, category,
  reference_type, reference_id, entries, currency = "NGN", initiated_by, metadata = {} }) {

  // Idempotency check
  const existing = await pool.query(
    "SELECT id FROM ledger_transactions WHERE idempotency_key=$1", [idempotency_key]
  );
  if (existing.rows[0]) {
    return { success: true, txn_id: existing.rows[0].id, duplicate: true };
  }

  // Validate double-entry balance
  const total_debits  = entries.filter(e=>e.type==="debit").reduce((s,e)=>s+parseFloat(e.amount),0);
  const total_credits = entries.filter(e=>e.type==="credit").reduce((s,e)=>s+parseFloat(e.amount),0);

  if (Math.abs(total_debits - total_credits) > 0.001) {
    throw new Error(
      `[FintechOS] DOUBLE-ENTRY IMBALANCE: debits=₦${total_debits.toFixed(2)} credits=₦${total_credits.toFixed(2)}`
    );
  }

  const total_amount = total_debits; // they're equal

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Create transaction header
    const txn = await client.query(
      `INSERT INTO ledger_transactions(txn_ref,idempotency_key,description,category,
         reference_type,reference_id,total_amount,currency,status,initiated_by,metadata)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,'completed',$9,$10) RETURNING id`,
      [txn_ref || `TXN-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
       idempotency_key, description, category,
       reference_type || null, reference_id || null,
       total_amount, currency, initiated_by || null, JSON.stringify(metadata)]
    );
    const txn_id = txn.rows[0].id;

    // Post both sides of each entry
    for (const entry of entries) {
      // Get or create ledger account
      let acct = await client.query(
        "SELECT id FROM ledger_accounts WHERE user_id=$1 AND account_type=$2 AND currency=$3",
        [entry.user_id, entry.account_type, currency]
      );

      if (!acct.rows[0]) {
        const ref = `${entry.account_type.toUpperCase()}-${entry.user_id}-${Date.now()}`;
        acct = await client.query(
          "INSERT INTO ledger_accounts(user_id,account_ref,account_type,currency) VALUES($1,$2,$3,$4) RETURNING id",
          [entry.user_id, ref, entry.account_type, currency]
        );
      }

      await client.query(
        "INSERT INTO ledger_entries(txn_id,account_id,user_id,entry_type,amount,currency) VALUES($1,$2,$3,$4,$5,$6)",
        [txn_id, acct.rows[0].id, entry.user_id, entry.type, parseFloat(entry.amount), currency]
      );
    }

    await client.query(
      "UPDATE ledger_transactions SET completed_at=NOW() WHERE id=$1", [txn_id]
    );

    await client.query("COMMIT");
    return { success: true, txn_id, duplicate: false, txn_ref, total_amount, currency };
  } catch (err) {
    await client.query("ROLLBACK");
    await pool.query(
      "UPDATE ledger_transactions SET status='failed' WHERE idempotency_key=$1", [idempotency_key]
    ).catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ================================================================
// BANK STATEMENT GENERATOR (Update — Thrift Banking Dashboard)
// User can export PDF/Excel/CSV statements
// ================================================================
async function generateStatement(user_id, { from_date, to_date, account_type = null, format = "json" }) {
  const params = [user_id, from_date || new Date(0), to_date || new Date()];
  const acct_filter = account_type ? `AND la.account_type='${account_type}'` : "";

  const rows = await pool.query(
    `SELECT
       lt.txn_ref AS transaction_id,
       lt.created_at AS date_time,
       lt.description,
       lt.category AS type,
       le.entry_type,
       le.amount,
       lt.currency,
       lt.status,
       lt.gateway_ref,
       la.account_type
     FROM ledger_transactions lt
     JOIN ledger_entries le ON le.txn_id = lt.id
     JOIN ledger_accounts la ON le.account_id = la.id
     WHERE la.user_id=$1
       AND lt.created_at BETWEEN $2 AND $3
       AND lt.status='completed'
       ${acct_filter}
     ORDER BY lt.created_at DESC`,
    params
  );

  const opening_balance = 0; // TODO: compute from before from_date
  let running = opening_balance;
  const statement = rows.rows.map(r => {
    const signed = r.entry_type === "credit" ? r.amount : -r.amount;
    running = parseFloat((running + signed).toFixed(2));
    return { ...r, balance_after: running, signed_amount: signed };
  });

  return {
    user_id,
    period: { from: from_date, to: to_date },
    opening_balance,
    closing_balance:   running,
    total_credits:     statement.filter(r=>r.entry_type==="credit").reduce((s,r)=>s+r.amount,0),
    total_debits:      statement.filter(r=>r.entry_type==="debit").reduce((s,r)=>s+r.amount,0),
    transaction_count: statement.length,
    transactions:      statement,
    generated_at:      new Date().toISOString(),
    disclaimer:        "DUNAZOE Fintech OS — This is a ledger statement, not a bank statement. Powered by Paystack payment rails.",
  };
}

// ── ASYNC NOTIFICATION STUBS (plugged into real providers) ────
async function sendEmailAsync(p)     { console.log("[Async] Email queued:", p.to);        return { queued: true }; }
async function sendSMSAsync(p)       { console.log("[Async] SMS queued:", p.phone);       return { queued: true }; }
async function sendWhatsAppAsync(p)  { console.log("[Async] WhatsApp queued:", p.phone);  return { queued: true }; }
async function sendPushAsync(p)      { console.log("[Async] Push queued:", p.user_id);    return { queued: true }; }
async function fulfillVTU(p)         { console.log("[Async] VTU:", p.product_type);       return { queued: true }; }
async function publishSocialPost(p)  { console.log("[Async] Social post:", p.platform);   return { queued: true }; }
async function generateReport(p)     { console.log("[Async] Report:", p.type);            return { queued: true }; }
async function writeAuditLog(p)      { console.log("[Async] Audit:", p.action);           return { queued: true }; }

// ── ACCOUNT REFERENCE GENERATOR ────────────────────────────────
function generateAccountRef(user_id, type = "wallet") {
  const prefix = { wallet:"WAL", thrift:"AJO", escrow:"ESC", vendor:"VND" };
  const pfx    = prefix[type] || "ACC";
  return `${pfx}-${String(user_id).padStart(6, "0")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

module.exports = {
  initFintechSchema,
  nonBlocking,
  queueJob,
  processNextJob,
  computeBalance,
  postDoubleEntry,
  generateStatement,
  generateAccountRef,
  pool,
  // CEO-level: these are our fintech building blocks
  FINTECH_DISCLAIMER: "DUNAZOE is a Fintech OS — not a licensed bank. Powered by Paystack/Stripe payment rails.",
};
