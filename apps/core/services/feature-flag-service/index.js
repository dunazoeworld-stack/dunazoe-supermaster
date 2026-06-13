// DUNAZOE OS — FEATURE FLAG SERVICE (Port 4019)
require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const { Pool } = require("pg");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");
const { logger, requestLogger }      = require("../../shared/logger");

const app  = express();
const PORT = process.env.PORT || 4019;
app.use(cors()); app.use(express.json()); app.use(requestLogger);

const pool = new Pool({ connectionString:process.env.DATABASE_URL, ssl:process.env.NODE_ENV==="production"?{rejectUnauthorized:false}:false });
const cache = new Map();
const CACHE_TTL = 10000;

// ================================================================
// UPDATE #96 (LAUNCH GOVERNANCE) — BETA MODE CONFIGURATION
//
// CTO DECISION: Beta launches with a MAX of 10 active services.
// Everything else stays built, tested, and dormant behind flags
// until: real transactions + reconciliation + operational proof.
// ================================================================

// Services that may run during BETA (max 10)
const BETA_ACTIVE_SERVICES = [
  "gateway","auth","user","vendor","product",
  "inventory","order","payment","wallet","notification",
];

// Services disabled by default — built, dormant, flag-gated
const BETA_DISABLED_SERVICES = [
  "thrift","loan","logistics","ai","security-ai","deployment-ai",
  "reconciliation","social-media","virtual-card","self-delivery",
  "payments-ai","reliability","admin-override","kyc","dispute",
  "commission","trust","escrow","fraud","upload","realtime","search","feature-flag",
];

// Kill switches — independent of beta mode, can be flipped any time
const KILL_SWITCHES = [
  "disable_payments","disable_wallet","disable_thrift",
  "disable_delivery","disable_notifications","disable_login",
];

// Fintech language rule — forbidden UI terms until banking approvals exist
const FORBIDDEN_FINTECH_TERMS = ["bank","deposit","savings account","savings_account"];
const ALLOWED_FINTECH_TERMS   = ["wallet","contribution","balance","transfer","top up","top_up"];

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feature_flags (
      name TEXT PRIMARY KEY, enabled BOOLEAN NOT NULL DEFAULT TRUE,
      description TEXT, updated_by INTEGER, updated_at TIMESTAMP DEFAULT NOW()
    );
    INSERT INTO feature_flags(name,enabled,description) VALUES
      ('thrift_enabled',false,'Ajo savings - DISABLED for beta Update96'),
      ('loan_enabled',false,'Loan applications - DISABLED for beta Update96'),
      ('delivery_enabled',false,'Agent delivery - DISABLED for beta Update96'),
      ('copytrader_enabled',false,'Copy trading - DISABLED for beta'),
      ('ai_pricing_enabled',false,'AI auto-price - DISABLED for beta'),
      ('ai_loan_gate_enabled',false,'Trust score gates loans - DISABLED for beta'),
      ('dispute_enabled',false,'Dispute filing - DISABLED for beta'),
      ('realtime_enabled',false,'Socket.IO - DISABLED for beta'),
      ('sms_enabled',true,'SMS via Termii - active for confirmations'),
      ('whatsapp_enabled',true,'WhatsApp via Termii - active fallback channel'),
      ('search_v2_enabled',false,'Elasticsearch - DISABLED for beta'),
      ('maintenance_mode',false,'Block all traffic'),
      ('milestone_bonus_enabled',false,'Milestone bonuses - DISABLED for beta'),
      ('file_upload_enabled',true,'Cloudinary - active for product images'),
      ('new_user_loan_enabled',false,'Micro-loans for new users - DISABLED'),
      ('self_delivery_enabled',false,'P2P self delivery - DISABLED for beta'),
      ('social_media_ai_enabled',false,'Social media AI - DISABLED for beta'),
      ('deployment_ai_enabled',true,'Deployment AI gating - KEEP ACTIVE'),
      ('payments_ai_enabled',false,'AI Payments Manager - DISABLED for beta'),
      ('escrow_enabled',true,'Escrow - KEEP ACTIVE for payment safety'),
      ('fraud_enabled',true,'Fraud checks - KEEP ACTIVE for payment safety'),
      ('virtual_card_enabled',false,'Virtual cards - DISABLED until banking approvals'),
      ('reconciliation_automation_enabled',false,'Automated reconciliation - manual only in beta'),
      ('kyc_enabled',false,'KYC service - DISABLED for beta'),
      ('trust_score_enabled',false,'Trust scoring - DISABLED for beta'),
      ('commission_enabled',false,'Vendor commission engine - DISABLED for beta'),
      ('beta_mode',true,'Master beta-mode switch - Update96 Launch Governance')
    ON CONFLICT(name) DO NOTHING;

    CREATE TABLE IF NOT EXISTS system_killswitch (
      name TEXT PRIMARY KEY,
      active BOOLEAN NOT NULL DEFAULT FALSE,
      reason TEXT,
      activated_by INTEGER,
      activated_at TIMESTAMP,
      deactivated_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW()
    );
    INSERT INTO system_killswitch(name,active) VALUES
      ('disable_payments',false),('disable_wallet',false),('disable_thrift',false),
      ('disable_delivery',false),('disable_notifications',false),('disable_login',false)
    ON CONFLICT(name) DO NOTHING;

    CREATE TABLE IF NOT EXISTS launch_gate_status (
      criterion TEXT PRIMARY KEY,
      target NUMERIC,
      current_value NUMERIC DEFAULT 0,
      met BOOLEAN DEFAULT FALSE,
      checked_at TIMESTAMP DEFAULT NOW()
    );
    INSERT INTO launch_gate_status(criterion,target) VALUES
      ('active_vendors',1),('listed_products',10),
      ('successful_payments',5),('successful_deliveries',5),
      ('clean_reconciliation',1),('rollback_tested',1),
      ('staging_uptime_pct',99),('support_channel_active',1)
    ON CONFLICT(criterion) DO NOTHING;

    CREATE TABLE IF NOT EXISTS wallet_snapshots (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      balance_ngn NUMERIC(15,2) NOT NULL,
      ledger_checksum TEXT NOT NULL,
      snapshot_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wallet_snap_user ON wallet_snapshots(user_id, snapshot_at DESC);
  `).catch(e => logger.warn("Flag schema:", e.message));
}

app.get("/health", (req,res) => res.json({service:"feature-flag-service",status:"ok",port:PORT}));

app.get("/flags", requireAuth, asyncHandler(async(req,res) => {
  const rows = await pool.query("SELECT * FROM feature_flags ORDER BY name");
  res.json({success:true,flags:rows.rows});
}));

app.get("/flags/:name", asyncHandler(async(req,res) => {
  const {name} = req.params;
  const hit = cache.get(name);
  if (hit && Date.now()-hit.ts<CACHE_TTL) return res.json({success:true,name,enabled:hit.enabled,cached:true});
  const row = await pool.query("SELECT * FROM feature_flags WHERE name=$1",[name]);
  if (!row.rows[0]) return res.json({success:true,name,enabled:true,known:false});
  cache.set(name,{enabled:row.rows[0].enabled,ts:Date.now()});
  res.json({success:true,name,enabled:row.rows[0].enabled,description:row.rows[0].description});
}));

app.post("/flags/:name/toggle", requireAuth, requireRole("admin","cto","super_admin"), asyncHandler(async(req,res) => {
  const {name} = req.params;
  const {enabled} = req.body;
  if (typeof enabled!=="boolean") return res.status(400).json({success:false,error:"enabled must be boolean"});
  if (name==="maintenance_mode"&&enabled&&req.body.confirm_maintenance!=="I_UNDERSTAND_THIS_BLOCKS_ALL_TRAFFIC") {
    return res.status(400).json({success:false,error:"Send confirm_maintenance: 'I_UNDERSTAND_THIS_BLOCKS_ALL_TRAFFIC'"});
  }
  await pool.query("INSERT INTO feature_flags(name,enabled,updated_by,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(name) DO UPDATE SET enabled=$2,updated_by=$3,updated_at=NOW()",[name,enabled,req.user?.id||null]);
  cache.delete(name);
  res.json({success:true,name,enabled,message:`'${name}' is now ${enabled?"ENABLED ✅":"DISABLED ❌"}`,live_in:"~10s"});
}));

app.post("/flags/bulk", asyncHandler(async(req,res) => {
  const {names=[]} = req.body;
  if (!names.length) return res.status(400).json({success:false,error:"names array required"});
  const rows = await pool.query("SELECT name,enabled FROM feature_flags WHERE name=ANY($1::text[])",[names]);
  const result = {};
  names.forEach(n => result[n]=true);
  rows.rows.forEach(r => { result[r.name]=r.enabled; cache.set(r.name,{enabled:r.enabled,ts:Date.now()}); });
  res.json({success:true,flags:result});
}));

// ================================================================
// KILL SWITCH SYSTEM (Update #96 §3)
// One broken module must never shut down the whole platform.
// ================================================================
app.get("/killswitch", asyncHandler(async(req,res) => {
  const rows = await pool.query("SELECT * FROM system_killswitch ORDER BY name");
  const result = {};
  rows.rows.forEach(r => { result[r.name] = r.active; cache.set(`kill:${r.name}`,{enabled:r.active,ts:Date.now()}); });
  res.json({success:true,killswitches:result});
}));

app.get("/killswitch/:name", asyncHandler(async(req,res) => {
  const {name} = req.params;
  if (!KILL_SWITCHES.includes(name)) {
    return res.status(404).json({success:false,error:`Unknown killswitch. Valid: ${KILL_SWITCHES.join(", ")}`});
  }
  const hit = cache.get(`kill:${name}`);
  if (hit && Date.now()-hit.ts<CACHE_TTL) return res.json({success:true,name,active:hit.enabled,cached:true});
  const row = await pool.query("SELECT * FROM system_killswitch WHERE name=$1",[name]);
  const active = row.rows[0]?.active || false;
  cache.set(`kill:${name}`,{enabled:active,ts:Date.now()});
  res.json({success:true,name,active,reason:row.rows[0]?.reason||null});
}));

app.post("/killswitch/:name/activate", requireAuth, requireRole("admin","cto","super_admin"),
  asyncHandler(async(req,res) => {
    const {name} = req.params;
    const {reason} = req.body;
    if (!KILL_SWITCHES.includes(name)) {
      return res.status(404).json({success:false,error:`Unknown killswitch. Valid: ${KILL_SWITCHES.join(", ")}`});
    }
    if (!reason) return res.status(400).json({success:false,error:"reason is required to activate a killswitch"});

    await pool.query(
      `INSERT INTO system_killswitch(name,active,reason,activated_by,activated_at,updated_at)
       VALUES($1,true,$2,$3,NOW(),NOW())
       ON CONFLICT(name) DO UPDATE SET active=true,reason=$2,activated_by=$3,activated_at=NOW(),deactivated_at=NULL,updated_at=NOW()`,
      [name, reason, req.user?.id||null]
    );
    cache.delete(`kill:${name}`);
    logger.warn(`🔴 KILLSWITCH ACTIVATED: ${name}`, {reason, by:req.user?.id});
    res.json({success:true,name,active:true,reason,message:`'${name}' is now ACTIVE 🔴 — affected operations will be blocked platform-wide`});
  })
);

app.post("/killswitch/:name/deactivate", requireAuth, requireRole("admin","cto","super_admin"),
  asyncHandler(async(req,res) => {
    const {name} = req.params;
    if (!KILL_SWITCHES.includes(name)) {
      return res.status(404).json({success:false,error:`Unknown killswitch. Valid: ${KILL_SWITCHES.join(", ")}`});
    }
    await pool.query(
      "UPDATE system_killswitch SET active=false,deactivated_at=NOW(),updated_at=NOW() WHERE name=$1",
      [name]
    );
    cache.delete(`kill:${name}`);
    logger.info(`🟢 Killswitch deactivated: ${name}`, {by:req.user?.id});
    res.json({success:true,name,active:false,message:`'${name}' is now INACTIVE 🟢 — normal operation restored`});
  })
);

// ================================================================
// BETA MODE STATUS (Update #96 §1 — Foundation-First Architecture)
// ================================================================
app.get("/beta/status", asyncHandler(async(req,res) => {
  const beta_row = await pool.query("SELECT enabled FROM feature_flags WHERE name='beta_mode'");
  const beta_mode = beta_row.rows[0]?.enabled ?? true;

  const flags = await pool.query("SELECT name,enabled FROM feature_flags");
  const enabled_features = flags.rows.filter(f=>f.enabled).map(f=>f.name);

  res.json({
    success: true,
    beta_mode,
    active_services: BETA_ACTIVE_SERVICES,
    active_count: BETA_ACTIVE_SERVICES.length,
    max_allowed: 10,
    disabled_services: BETA_DISABLED_SERVICES,
    enabled_feature_flags: enabled_features,
    message: beta_mode
      ? `BETA MODE: ${BETA_ACTIVE_SERVICES.length}/10 services active. Remaining ${BETA_DISABLED_SERVICES.length} modules built and dormant.`
      : "FULL PRODUCTION MODE: all modules available subject to individual feature flags.",
  });
}));

// ================================================================
// LAUNCH GATE CHECKLIST (Update #96 §12)
// Launch only when all 8 criteria are met.
// ================================================================
app.get("/launch-gate", requireAuth, requireRole("admin","cto","super_admin"),
  asyncHandler(async(req,res) => {
    const rows = await pool.query("SELECT * FROM launch_gate_status ORDER BY criterion");
    const all_met = rows.rows.every(r => r.met);
    res.json({
      success: true,
      ready_to_launch: all_met,
      criteria: rows.rows,
      message: all_met
        ? "✅ All launch gate criteria met. Cleared for scale-up beyond beta."
        : `❌ ${rows.rows.filter(r=>!r.met).length}/${rows.rows.length} criteria not yet met.`,
    });
  })
);

app.post("/launch-gate/:criterion", requireAuth, requireRole("admin","cto","super_admin"),
  asyncHandler(async(req,res) => {
    const {criterion} = req.params;
    const {current_value} = req.body;
    if (typeof current_value !== "number") {
      return res.status(400).json({success:false,error:"current_value (number) is required"});
    }
    const target_row = await pool.query("SELECT target FROM launch_gate_status WHERE criterion=$1",[criterion]);
    if (!target_row.rows[0]) return res.status(404).json({success:false,error:"Unknown criterion"});

    const met = current_value >= parseFloat(target_row.rows[0].target);
    await pool.query(
      "UPDATE launch_gate_status SET current_value=$1,met=$2,checked_at=NOW() WHERE criterion=$3",
      [current_value, met, criterion]
    );
    res.json({success:true,criterion,current_value,target:target_row.rows[0].target,met});
  })
);

// ================================================================
// FINTECH LANGUAGE LINTER (Update #96 §6)
// Catches forbidden "Bank/Deposit/Savings Account" UI strings.
// ================================================================
app.post("/lint/fintech-language", requireAuth, asyncHandler(async(req,res) => {
  const {text} = req.body;
  if (typeof text !== "string") return res.status(400).json({success:false,error:"text (string) required"});

  const lower = text.toLowerCase();
  const violations = FORBIDDEN_FINTECH_TERMS.filter(term => lower.includes(term));

  res.json({
    success: true,
    clean: violations.length === 0,
    violations,
    allowed_terms: ALLOWED_FINTECH_TERMS,
    message: violations.length
      ? `❌ Forbidden fintech terms found: ${violations.join(", ")}. Use: ${ALLOWED_FINTECH_TERMS.slice(0,4).join(", ")}`
      : "✅ Text complies with Update #96 fintech language rule.",
  });
}));


app.use(errorHandler);
app.listen(PORT, () => logger.info(`✅ Feature Flag Service running on port ${PORT}`));
module.exports = app;
