// ================================================================
// DUNAZOE OS — FEATURE ACTIVATION ENGINE
// services/activation-engine/index.js
// Port: 4033
//
// CTO ARCHITECTURE DECISION:
//   Features exist from day ONE — they are never "added later".
//   Only ACTIVATION is controlled later based on real metrics.
//
// FEATURE STATES:
//   OFF        — disabled for all users
//   BETA       — enabled for internal test users only
//   LIMITED    — enabled for first N users/vendors
//   ON         — fully enabled for all users
//   SCALE_ONLY — only activates after traffic threshold
//   ADMIN_ONLY — visible to admin/CTO panel only
//
// ACTIVATION TRIGGERS:
//   user_count | vendor_count | orders | revenue |
//   traffic | cpu | memory | error_rate | manual_approval
//
// AUTO-EVALUATION:
//   Cron runs every 15 min → checks all OFF/BETA features →
//   promotes any that meet their metric thresholds automatically.
// ================================================================

require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const cron     = require("node-cron");
const { Pool } = require("pg");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");
const { logger, requestLogger } = require("../../shared/logger");

const app  = express();
const PORT = process.env.PORT || 4033;
app.use(cors()); app.use(express.json()); app.use(requestLogger);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// ── FEATURE REGISTRY (source of truth) ───────────────────────
// All features that exist in DUNAZOE — activation controlled here.
const FEATURE_REGISTRY = [
  {
    name:           "payments",
    label:          "Payments (Paystack + Stripe)",
    default_state:  "ON",
    category:       "core",
    description:    "Payment processing, webhooks, escrow funding",
    auto_triggers:  [],
    always_on:      true,
  },
  {
    name:           "kyc",
    label:          "KYC Verification",
    default_state:  "ON",
    category:       "core",
    description:    "Identity verification for vendors and high-value users",
    auto_triggers:  [],
    always_on:      true,
  },
  {
    name:           "cybersecurity_ai",
    label:          "Cybersecurity AI",
    default_state:  "ON",
    category:       "security",
    description:    "Fraud detection, impossible travel, device tracking",
    auto_triggers:  [],
    always_on:      true,
  },
  {
    name:           "notification_ai",
    label:          "Notification AI",
    default_state:  "ON",
    category:       "core",
    description:    "Email, SMS, WhatsApp notifications via Termii",
    auto_triggers:  [],
    always_on:      true,
  },
  {
    name:           "wallet",
    label:          "DUNAZOE Wallet",
    default_state:  "OFF",
    category:       "fintech",
    description:    "User wallets — fund, withdraw, transfer",
    auto_triggers:  [{ metric: "user_count", threshold: 100, promote_to: "ON" }],
    killswitch:     "disable_wallet",
  },
  {
    name:           "thrift",
    label:          "Ajo Thrift / Savings",
    default_state:  "OFF",
    category:       "fintech",
    description:    "Group savings (Ajo) — held pending loan ledger fix",
    auto_triggers:  [
      { metric: "successful_orders", threshold: 20, promote_to: "BETA" },
    ],
    manual_approval_required: true,
    block_reason:   "Loan ledger double-entry bug must be fixed before activation",
    killswitch:     "disable_thrift",
  },
  {
    name:           "express_delivery",
    label:          "DUNAZOE Express Delivery",
    default_state:  "OFF",
    category:       "logistics",
    description:    "Hybrid delivery network + courier aggregation (Shipbubble/GIG/DHL)",
    auto_triggers:  [{ metric: "intercity_orders", threshold: 1, promote_to: "ON" }],
    killswitch:     "disable_delivery",
  },
  {
    name:           "chat",
    label:          "Vendor-Buyer Chat",
    default_state:  "OFF",
    category:       "social",
    description:    "Real-time messaging between buyers and vendors",
    auto_triggers:  [{ metric: "vendor_count", threshold: 50, promote_to: "BETA" }],
  },
  {
    name:           "marketing_ai",
    label:          "Marketing AI",
    default_state:  "OFF",
    category:       "ai",
    description:    "AI-generated product descriptions, campaigns, social posts",
    auto_triggers:  [{ metric: "user_count", threshold: 1000, promote_to: "ON" }],
  },
  {
    name:           "vendor_analytics",
    label:          "Vendor Analytics Dashboard",
    default_state:  "OFF",
    category:       "analytics",
    description:    "Sales charts, revenue reports, product performance for vendors",
    auto_triggers:  [{ metric: "vendor_count", threshold: 10, promote_to: "BETA" }],
  },
  {
    name:           "social_media_ai",
    label:          "Social Media AI",
    default_state:  "OFF",
    category:       "ai",
    description:    "Auto-post products to Instagram, Twitter, Facebook",
    auto_triggers:  [{ metric: "user_count", threshold: 500, promote_to: "LIMITED" }],
  },
  {
    name:           "loans",
    label:          "Micro-loans",
    default_state:  "OFF",
    category:       "fintech",
    description:    "Short-term loans against Ajo savings balance",
    auto_triggers:  [],
    manual_approval_required: true,
    block_reason:   "Requires CBN micro-lending compliance review before activation",
  },
  {
    name:           "admin_impersonation",
    label:          "Admin User Impersonation",
    default_state:  "ADMIN_ONLY",
    category:       "admin",
    description:    "CTO/admin can impersonate any user for support",
    auto_triggers:  [],
    always_on:      true,
  },
  {
    name:           "shareholder_system",
    label:          "Shareholder System",
    default_state:  "OFF",
    category:       "fintech",
    description:    "Equity tracking, dividends, cap table management",
    auto_triggers:  [],
    manual_approval_required: true,
    block_reason:   "No spec yet — pending legal review",
  },
];

// ── DB SCHEMA INIT ────────────────────────────────────────────
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feature_activations (
      id             SERIAL PRIMARY KEY,
      feature_name   TEXT UNIQUE NOT NULL,
      state          TEXT NOT NULL DEFAULT 'OFF',
      promoted_by    TEXT,
      promotion_type TEXT DEFAULT 'manual',
      trigger_metric TEXT,
      trigger_value  NUMERIC,
      notes          TEXT,
      activated_at   TIMESTAMP,
      updated_at     TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activation_events (
      id             SERIAL PRIMARY KEY,
      feature_name   TEXT NOT NULL,
      from_state     TEXT,
      to_state       TEXT,
      triggered_by   TEXT,
      trigger_metric TEXT,
      trigger_value  NUMERIC,
      notes          TEXT,
      created_at     TIMESTAMP DEFAULT NOW()
    );
  `);

  // Seed registry defaults if not present
  for (const f of FEATURE_REGISTRY) {
    await pool.query(`
      INSERT INTO feature_activations (feature_name, state, promoted_by, promotion_type, notes)
      VALUES ($1, $2, 'system', 'seed', $3)
      ON CONFLICT (feature_name) DO NOTHING
    `, [f.name, f.default_state, f.description]);
  }
  logger.info("Activation Engine schema ready");
}

// ── METRIC SNAPSHOT ───────────────────────────────────────────
async function getMetrics() {
  const [users, vendors, orders, successful, intercity] = await Promise.all([
    pool.query("SELECT COUNT(*) c FROM users WHERE role='customer'").catch(() => ({ rows: [{ c: 0 }] })),
    pool.query("SELECT COUNT(*) c FROM vendors WHERE status='approved'").catch(() => ({ rows: [{ c: 0 }] })),
    pool.query("SELECT COUNT(*) c FROM orders").catch(() => ({ rows: [{ c: 0 }] })),
    pool.query("SELECT COUNT(*) c FROM orders WHERE status='delivered'").catch(() => ({ rows: [{ c: 0 }] })),
    pool.query("SELECT COUNT(*) c FROM delivery_assignments WHERE assignment_type='intercity'").catch(() => ({ rows: [{ c: 0 }] })),
  ]);

  return {
    user_count:        parseInt(users.rows[0].c),
    vendor_count:      parseInt(vendors.rows[0].c),
    total_orders:      parseInt(orders.rows[0].c),
    successful_orders: parseInt(successful.rows[0].c),
    intercity_orders:  parseInt(intercity.rows[0].c),
  };
}

// ── AUTO-EVALUATION ENGINE ────────────────────────────────────
async function evaluateAllTriggers() {
  const metrics       = await getMetrics();
  const activations   = await pool.query("SELECT feature_name, state FROM feature_activations");
  const currentStates = Object.fromEntries(activations.rows.map(r => [r.feature_name, r.state]));
  const promoted      = [];

  for (const feature of FEATURE_REGISTRY) {
    if (feature.always_on || feature.manual_approval_required) continue;
    if (!feature.auto_triggers?.length) continue;

    const currentState = currentStates[feature.name];
    if (["ON", "SCALE_ONLY"].includes(currentState)) continue;

    for (const trigger of feature.auto_triggers) {
      const metricValue = metrics[trigger.metric] ?? 0;
      if (metricValue >= trigger.threshold) {
        const fromState = currentState;
        await pool.query(
          `UPDATE feature_activations SET state=$1, promotion_type='auto', trigger_metric=$2, trigger_value=$3, activated_at=NOW(), updated_at=NOW() WHERE feature_name=$4`,
          [trigger.promote_to, trigger.metric, metricValue, feature.name]
        );
        await pool.query(
          `INSERT INTO activation_events(feature_name,from_state,to_state,triggered_by,trigger_metric,trigger_value)
           VALUES($1,$2,$3,'auto-engine',$4,$5)`,
          [feature.name, fromState, trigger.promote_to, trigger.metric, metricValue]
        );
        promoted.push({ feature: feature.name, from: fromState, to: trigger.promote_to, metric: trigger.metric, value: metricValue });
        logger.info(`✅ Feature auto-promoted: ${feature.name} → ${trigger.promote_to} (${trigger.metric}=${metricValue})`);
        break;
      }
    }
  }
  return { metrics, promoted };
}

// ── HEALTH ────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({
  service: "activation-engine",
  status:  "ok",
  port:    PORT,
  features: FEATURE_REGISTRY.length,
}));

// ── LIST ALL FEATURES ─────────────────────────────────────────
app.get("/activation/features", asyncHandler(async (req, res) => {
  const rows = await pool.query("SELECT * FROM feature_activations ORDER BY feature_name");
  const stateMap = Object.fromEntries(rows.rows.map(r => [r.feature_name, r]));

  const features = FEATURE_REGISTRY.map(f => ({
    name:                     f.name,
    label:                    f.label,
    category:                 f.category,
    description:              f.description,
    state:                    stateMap[f.name]?.state ?? f.default_state,
    activated_at:             stateMap[f.name]?.activated_at ?? null,
    manual_approval_required: f.manual_approval_required ?? false,
    block_reason:             f.block_reason ?? null,
    auto_triggers:            f.auto_triggers ?? [],
    killswitch:               f.killswitch ?? null,
    is_enabled:               ["ON","BETA","SCALE_ONLY","ADMIN_ONLY"].includes(stateMap[f.name]?.state ?? f.default_state),
  }));

  const summary = {
    total:       features.length,
    on:          features.filter(f => f.state === "ON").length,
    beta:        features.filter(f => f.state === "BETA").length,
    off:         features.filter(f => f.state === "OFF").length,
    admin_only:  features.filter(f => f.state === "ADMIN_ONLY").length,
  };

  return res.json({ success: true, summary, features });
}));

// ── GET SINGLE FEATURE ────────────────────────────────────────
app.get("/activation/features/:name", asyncHandler(async (req, res) => {
  const { name } = req.params;
  const def = FEATURE_REGISTRY.find(f => f.name === name);
  if (!def) return res.status(404).json({ success: false, error: `Feature '${name}' not found` });

  const row = await pool.query("SELECT * FROM feature_activations WHERE feature_name=$1", [name]);
  const events = await pool.query("SELECT * FROM activation_events WHERE feature_name=$1 ORDER BY created_at DESC LIMIT 10", [name]);

  return res.json({
    success:    true,
    feature:    { ...def, ...(row.rows[0] || {}), history: events.rows },
  });
}));

// ── EVALUATE TRIGGERS (auto-promote features) ─────────────────
app.post("/activation/evaluate", requireAuth,
  requireRole("admin", "super_admin", "cto"),
  asyncHandler(async (req, res) => {
    const result = await evaluateAllTriggers();
    return res.json({
      success:  true,
      message:  result.promoted.length > 0 ? `${result.promoted.length} feature(s) auto-promoted` : "No features ready for promotion",
      promoted: result.promoted,
      metrics:  result.metrics,
    });
  })
);

// ── MANUALLY ACTIVATE FEATURE ─────────────────────────────────
app.post("/activation/features/:name/activate", requireAuth,
  requireRole("admin", "super_admin", "cto"),
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    const { state, notes } = req.body;

    const VALID_STATES = ["OFF", "BETA", "LIMITED", "ON", "SCALE_ONLY", "ADMIN_ONLY"];
    if (!VALID_STATES.includes(state)) {
      return res.status(400).json({ success: false, error: `Invalid state. Must be one of: ${VALID_STATES.join(", ")}` });
    }

    const def = FEATURE_REGISTRY.find(f => f.name === name);
    if (!def) return res.status(404).json({ success: false, error: `Feature '${name}' not found` });

    const current = await pool.query("SELECT state FROM feature_activations WHERE feature_name=$1", [name]);
    const fromState = current.rows[0]?.state ?? def.default_state;

    await pool.query(
      `UPDATE feature_activations SET state=$1, promoted_by=$2, promotion_type='manual', notes=$3, activated_at=CASE WHEN $1!='OFF' THEN NOW() ELSE activated_at END, updated_at=NOW() WHERE feature_name=$4`,
      [state, `admin:${req.user.id}`, notes || null, name]
    );
    await pool.query(
      `INSERT INTO activation_events(feature_name,from_state,to_state,triggered_by,notes) VALUES($1,$2,$3,$4,$5)`,
      [name, fromState, state, `admin:${req.user.id}`, notes || null]
    );

    logger.info(`Feature manually set: ${name} ${fromState} → ${state} by admin ${req.user.id}`);
    return res.json({ success: true, feature: name, from: fromState, to: state, message: `Feature '${name}' is now ${state}` });
  })
);

// ── METRICS SNAPSHOT ─────────────────────────────────────────
app.get("/activation/metrics", requireAuth,
  asyncHandler(async (req, res) => {
    const metrics = await getMetrics();
    const pending = FEATURE_REGISTRY.filter(f => {
      if (f.always_on || f.manual_approval_required || !f.auto_triggers?.length) return false;
      return true;
    }).map(f => {
      const trigger = f.auto_triggers[0];
      return {
        feature:   f.name,
        trigger:   trigger.metric,
        threshold: trigger.threshold,
        current:   metrics[trigger.metric] ?? 0,
        pct:       Math.round(((metrics[trigger.metric] ?? 0) / trigger.threshold) * 100),
        promotes_to: trigger.promote_to,
      };
    });
    return res.json({ success: true, metrics, pending_activations: pending });
  })
);

// ── ACTIVATION HISTORY ────────────────────────────────────────
app.get("/activation/history", requireAuth,
  asyncHandler(async (req, res) => {
    const events = await pool.query(
      "SELECT * FROM activation_events ORDER BY created_at DESC LIMIT 50"
    );
    return res.json({ success: true, events: events.rows });
  })
);

// ── CRON: AUTO-EVALUATE EVERY 15 MINUTES ─────────────────────
cron.schedule("*/15 * * * *", async () => {
  try {
    const { promoted } = await evaluateAllTriggers();
    if (promoted.length > 0) {
      logger.info(`[Activation Cron] Auto-promoted ${promoted.length} features`, { promoted });
    }
  } catch (err) {
    logger.error("[Activation Cron] Evaluation error", { error: err.message });
  }
});

initSchema().catch(console.error);
app.use(errorHandler);
app.listen(PORT, () => logger.info(`✅ Activation Engine running on port ${PORT} — ${FEATURE_REGISTRY.length} features tracked`));
module.exports = app;
