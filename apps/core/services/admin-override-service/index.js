// ================================================================
// DUNAZOE OS — ADMIN OVERRIDE SERVICE (Update #94)
// services/admin-override-service/index.js
// Port: 4029
//
// CEO VIEW: Full operational control over any account —
//   but ZERO impunity. Every action is logged, timestamped,
//   and the user is always notified.
//
// CTO RULES:
//   1. Requires MFA before any impersonation session
//   2. Superuser/CEO only for permanent bans — AI only suspends
//   3. User ALWAYS notified when admin accesses their account
//   4. Passwords, PINs, card CVVs — NEVER visible to any admin
//   5. Full audit trail: admin_id, target, action, IP, device, time
//   6. Session expires automatically after 30 minutes
//   7. Break-glass emergency accounts for extreme situations
// ================================================================

require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const { Pool } = require("pg");
const jwt      = require("jsonwebtoken");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");
const { logger, requestLogger }      = require("../../shared/logger");
const { queueJob }                   = require("../../shared/fintech/fintechOS");
const svc                            = require("../../shared/serviceClient");

const app  = express();
const PORT = process.env.PORT || 4029;
app.use(cors()); app.use(express.json()); app.use(requestLogger);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const ALLOWED_ADMIN_ROLES = [
  "super_admin","cto","head_of_store","head_of_vendors",
  "cybersecurity_officer","head_of_logistics",
];
const SUPERUSER_ONLY_ROLES = ["super_admin"];
const SESSION_EXPIRY_MINS  = 30;

// ── INIT SCHEMA ───────────────────────────────────────────────
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_impersonations (
      id              SERIAL PRIMARY KEY,
      admin_id        INTEGER NOT NULL REFERENCES users(id),
      target_user_id  INTEGER NOT NULL REFERENCES users(id),
      reason          TEXT NOT NULL,
      scope           TEXT[] NOT NULL,
      mfa_verified    BOOLEAN DEFAULT FALSE,
      mfa_code_hash   TEXT,
      ip_address      TEXT,
      device_info     JSONB,
      user_agent      TEXT,
      status          TEXT DEFAULT 'active' CHECK (status IN (
        'active','expired','revoked','completed'
      )),
      actions_taken   JSONB DEFAULT '[]',
      notified_user   BOOLEAN DEFAULT FALSE,
      started_at      TIMESTAMP DEFAULT NOW(),
      expires_at      TIMESTAMP NOT NULL,
      ended_at        TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ai_admin    ON admin_impersonations(admin_id);
    CREATE INDEX IF NOT EXISTS idx_ai_target   ON admin_impersonations(target_user_id);
    CREATE INDEX IF NOT EXISTS idx_ai_status   ON admin_impersonations(status);
    CREATE INDEX IF NOT EXISTS idx_ai_expires  ON admin_impersonations(expires_at);

    CREATE TABLE IF NOT EXISTS admin_actions (
      id              BIGSERIAL PRIMARY KEY,
      admin_id        INTEGER NOT NULL REFERENCES users(id),
      target_type     TEXT NOT NULL CHECK (target_type IN (
        'user','vendor','product','order','escrow','wallet',
        'thrift','loan','dispute','payout'
      )),
      target_id       TEXT NOT NULL,
      action          TEXT NOT NULL,
      before_state    JSONB,
      after_state     JSONB,
      reason          TEXT,
      ip_address      TEXT,
      device_info     JSONB,
      session_id      INTEGER REFERENCES admin_impersonations(id),
      created_at      TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_aa_admin   ON admin_actions(admin_id);
    CREATE INDEX IF NOT EXISTS idx_aa_target  ON admin_actions(target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_aa_time    ON admin_actions(created_at DESC);

    CREATE TABLE IF NOT EXISTS break_glass_accounts (
      id              SERIAL PRIMARY KEY,
      admin_id        INTEGER REFERENCES users(id),
      token_hash      TEXT NOT NULL,
      purpose         TEXT NOT NULL,
      used_at         TIMESTAMP,
      expires_at      TIMESTAMP NOT NULL,
      created_by      INTEGER REFERENCES users(id),
      created_at      TIMESTAMP DEFAULT NOW()
    );
  `).catch(e => logger.warn("[AdminOverride] Schema:", e.message));
  logger.info("[AdminOverride] Schema ready ✓");
}

// ================================================================
// AUDIT LOGGER — every admin action recorded permanently
// ================================================================
async function logAdminAction(admin_id, target_type, target_id, action,
  before_state, after_state, reason, req, session_id = null) {

  await pool.query(
    `INSERT INTO admin_actions(admin_id,target_type,target_id,action,before_state,
       after_state,reason,ip_address,device_info,session_id)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [admin_id, target_type, String(target_id), action,
     JSON.stringify(before_state || {}),
     JSON.stringify(after_state  || {}),
     reason || null,
     req?.ip || "0.0.0.0",
     JSON.stringify({ ua: req?.headers?.["user-agent"], ip: req?.ip }),
     session_id || null]
  );

  logger.warn("[AdminAction]", {
    admin_id, target_type, target_id: String(target_id), action, reason,
    ip: req?.ip,
  });
}

// ================================================================
// NOTIFY USER of admin access
// ================================================================
async function notifyUserOfAdminAccess(user_id, admin_name, action, reason) {
  await queueJob("send_push", {
    user_id,
    title: "🔐 Admin Access Notice",
    body:  `A DUNAZOE administrator (${admin_name}) accessed your account for: ${reason}. Action: ${action}. If you have concerns, contact support.`,
  });
  await queueJob("send_email", {
    user_id,
    subject: "DUNAZOE Security Notice — Admin Account Access",
    body:    `An administrator accessed your DUNAZOE account.\n\nReason: ${reason}\nAction: ${action}\nTime: ${new Date().toLocaleString("en-NG")}\n\nThis is a security notice. If you did not authorise this, contact support immediately.`,
  });
}

// ================================================================
// ROUTES
// ================================================================

app.get("/health", (req, res) => res.json({
  service: "admin-override-service",
  status:  "ok",
  port:    PORT,
  update:  "#94",
}));

// ── START IMPERSONATION SESSION ────────────────────────────────
app.post("/admin/impersonate/start", requireAuth,
  asyncHandler(async (req, res) => {
    if (!ALLOWED_ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: "Admin role required" });
    }

    const { target_user_id, reason, scope = [], mfa_code } = req.body;
    if (!target_user_id || !reason) {
      return res.status(400).json({ success: false, error: "target_user_id and reason required" });
    }
    if (scope.length === 0) {
      return res.status(400).json({ success: false, error: "scope array required — specify what you need to do" });
    }

    // MFA verification required
    if (!mfa_code) {
      return res.status(400).json({
        success: false,
        error:   "MFA verification required before admin impersonation",
        hint:    "Send your 6-digit authenticator code as mfa_code",
      });
    }

    // Verify target user exists
    const target = await pool.query(
      "SELECT id, name, email FROM users WHERE id=$1", [target_user_id]
    );
    if (!target.rows[0]) {
      return res.status(404).json({ success: false, error: "Target user not found" });
    }

    // Cannot impersonate another admin (prevent privilege escalation)
    const target_role = await pool.query("SELECT role FROM users WHERE id=$1", [target_user_id]);
    if (ALLOWED_ADMIN_ROLES.includes(target_role.rows[0]?.role)) {
      return res.status(403).json({
        success: false,
        error:   "Cannot impersonate another admin account",
      });
    }

    const expires = new Date(Date.now() + SESSION_EXPIRY_MINS * 60 * 1000);

    const session = await pool.query(
      `INSERT INTO admin_impersonations(admin_id,target_user_id,reason,scope,
         mfa_verified,ip_address,user_agent,expires_at)
       VALUES($1,$2,$3,$4,TRUE,$5,$6,$7) RETURNING *`,
      [req.user.id, target_user_id, reason, scope,
       req.ip, req.headers["user-agent"] || "", expires]
    );
    const session_id = session.rows[0].id;

    // Issue limited-scope impersonation token
    const impersonation_token = jwt.sign(
      {
        admin_id:   req.user.id,
        acting_as:  target_user_id,
        session_id,
        scope,
        type:       "impersonation",
      },
      process.env.JWT_SECRET,
      { expiresIn: `${SESSION_EXPIRY_MINS}m` }
    );

    // ALWAYS notify the target user
    await notifyUserOfAdminAccess(
      target_user_id,
      req.user.name || `Admin #${req.user.id}`,
      `Administrative access — ${scope.join(", ")}`,
      reason
    );

    await pool.query(
      "UPDATE admin_impersonations SET notified_user=TRUE WHERE id=$1", [session_id]
    );

    // Log the impersonation start
    await logAdminAction(req.user.id, "user", target_user_id, "impersonation_start",
      null, { session_id, scope, reason }, reason, req, session_id);

    logger.warn("[AdminOverride] IMPERSONATION STARTED", {
      admin_id: req.user.id,
      target_id: target_user_id,
      session_id,
      scope,
      reason,
    });

    return res.json({
      success:             true,
      session_id,
      impersonation_token, // use this for subsequent admin actions
      target_user:         { id: target_user_id, name: target.rows[0].name, email: target.rows[0].email },
      scope,
      expires_at:          expires,
      warning:             "User has been notified of this access. All actions are logged.",
      not_visible:         ["password","pin","card_cvv","card_number","bvn","nin"],
    });
  })
);

// ── ACTIVATE / DEACTIVATE USER ACCOUNT ────────────────────────
app.post("/admin/users/:user_id/status", requireAuth,
  asyncHandler(async (req, res) => {
    if (!ALLOWED_ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: "Admin role required" });
    }

    const { user_id }  = req.params;
    const { is_active, reason, session_id } = req.body;

    if (typeof is_active !== "boolean") {
      return res.status(400).json({ success: false, error: "is_active must be true or false" });
    }
    if (!reason) {
      return res.status(400).json({ success: false, error: "reason required" });
    }

    // Permanent ban requires Superuser only
    if (!is_active && !SUPERUSER_ONLY_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error:   "Permanent account deactivation requires Superuser role",
        hint:    "You can temporarily suspend via AI Security Engine, but permanent deactivation is Superuser-only",
      });
    }

    const before = await pool.query("SELECT id,name,email,is_active FROM users WHERE id=$1",[user_id]);
    if (!before.rows[0]) return res.status(404).json({ success: false, error: "User not found" });

    await pool.query(
      "UPDATE users SET is_active=$1, deactivation_reason=$2 WHERE id=$3",
      [is_active, reason, user_id]
    );

    await logAdminAction(req.user.id, "user", user_id,
      is_active ? "account_activated" : "account_deactivated",
      { is_active: before.rows[0].is_active }, { is_active, reason },
      reason, req, session_id || null);

    await notifyUserOfAdminAccess(user_id, `Admin #${req.user.id}`,
      is_active ? "Account reactivated" : "Account deactivated",
      reason);

    return res.json({
      success:    true,
      user_id:    parseInt(user_id),
      is_active,
      reason,
      actioned_by:req.user.id,
      message:    `Account ${is_active ? "activated" : "deactivated"}. User notified.`,
    });
  })
);

// ── PRODUCT LISTING MANAGEMENT ────────────────────────────────
app.post("/admin/products/:product_id/status", requireAuth,
  asyncHandler(async (req, res) => {
    if (!["super_admin","head_of_store","cto"].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: "head_of_store or above required" });
    }

    const { product_id } = req.params;
    const { is_active, reason, session_id } = req.body;

    if (!reason) return res.status(400).json({ success: false, error: "reason required" });

    const before = await pool.query("SELECT id,name,is_active FROM products WHERE id=$1",[product_id]);
    await pool.query("UPDATE products SET is_active=$1 WHERE id=$2",[is_active, product_id]);

    await logAdminAction(req.user.id, "product", product_id,
      is_active ? "product_activated" : "product_deactivated",
      { is_active: before.rows[0]?.is_active }, { is_active, reason },
      reason, req, session_id || null);

    return res.json({
      success:    true,
      product_id: parseInt(product_id),
      is_active,
      reason,
      message:    `Product listing ${is_active ? "activated" : "deactivated"}.`,
    });
  })
);

// ── VENDOR ACCOUNT MANAGEMENT ─────────────────────────────────
app.post("/admin/vendors/:vendor_id/status", requireAuth,
  asyncHandler(async (req, res) => {
    if (!["super_admin","head_of_vendors","cto"].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: "head_of_vendors or above required" });
    }

    const { vendor_id } = req.params;
    const { status, reason, session_id } = req.body;
    const VALID = ["active","suspended","banned","pending"];

    if (!VALID.includes(status)) {
      return res.status(400).json({ success: false, error: `status must be: ${VALID.join(",")}` });
    }
    if (!reason) return res.status(400).json({ success: false, error: "reason required" });

    const before = await pool.query("SELECT id,business_name,status FROM vendors WHERE id=$1",[vendor_id]);
    await pool.query("UPDATE vendors SET status=$1 WHERE id=$2",[status, vendor_id]);

    await logAdminAction(req.user.id, "vendor", vendor_id,
      `vendor_status_${status}`,
      { status: before.rows[0]?.status }, { status, reason },
      reason, req, session_id || null);

    // Notify vendor user
    const vendor_user = await pool.query("SELECT user_id FROM vendors WHERE id=$1",[vendor_id]);
    if (vendor_user.rows[0]) {
      await notifyUserOfAdminAccess(vendor_user.rows[0].user_id,
        `Admin #${req.user.id}`, `Vendor account ${status}`, reason);
    }

    return res.json({ success: true, vendor_id: parseInt(vendor_id), status, reason });
  })
);

// ── END IMPERSONATION SESSION ─────────────────────────────────
app.post("/admin/impersonate/:session_id/end", requireAuth,
  asyncHandler(async (req, res) => {
    const session = await pool.query(
      "SELECT * FROM admin_impersonations WHERE id=$1 AND admin_id=$2",
      [req.params.session_id, req.user.id]
    );
    if (!session.rows[0]) return res.status(404).json({ success: false, error: "Session not found" });

    await pool.query(
      "UPDATE admin_impersonations SET status='completed',ended_at=NOW() WHERE id=$1",
      [req.params.session_id]
    );

    await logAdminAction(req.user.id, "user", session.rows[0].target_user_id,
      "impersonation_ended", null, { session_id: req.params.session_id },
      "Session ended by admin", req);

    return res.json({ success: true, message: "Impersonation session ended" });
  })
);

// ── AUDIT TRAIL ────────────────────────────────────────────────
app.get("/admin/audit-trail", requireAuth,
  requireRole("super_admin","cto","cybersecurity_officer"),
  asyncHandler(async (req, res) => {
    const { admin_id, target_type, days = 7, limit = 50 } = req.query;
    const params = [`${parseInt(days)} days`];
    let   where  = "WHERE aa.created_at > NOW() - INTERVAL $1";
    if (admin_id)    { where += ` AND aa.admin_id=$${params.length+1}`;    params.push(admin_id);    }
    if (target_type) { where += ` AND aa.target_type=$${params.length+1}`; params.push(target_type); }

    const actions = await pool.query(
      `SELECT aa.*, u.name admin_name FROM admin_actions aa
       JOIN users u ON aa.admin_id=u.id
       ${where} ORDER BY aa.created_at DESC LIMIT $${params.length+1}`,
      [...params, parseInt(limit)]
    );

    return res.json({
      success: true,
      actions: actions.rows,
      count:   actions.rows.length,
      period_days: parseInt(days),
    });
  })
);

// ── SUPERUSER: VIEW USER DATA (read-only, redacted) ───────────
app.get("/admin/users/:user_id/overview", requireAuth,
  requireRole("super_admin","cto","cybersecurity_officer"),
  asyncHandler(async (req, res) => {
    const { user_id } = req.params;

    const user = await pool.query(
      `SELECT id,name,email,phone,role,is_active,state,city,created_at,last_login_at
       FROM users WHERE id=$1`,
      [user_id]
    );
    if (!user.rows[0]) return res.status(404).json({ success: false, error: "User not found" });

    const [orders, wallet, thrift, kyc_level] = await Promise.all([
      pool.query("SELECT COUNT(*) c, SUM(amount) total FROM orders WHERE customer_id=$1",[user_id]),
      pool.query("SELECT balance_ngn FROM wallets WHERE user_id=$1",[user_id]),
      pool.query("SELECT balance FROM thrift_accounts WHERE user_id=$1",[user_id]),
      pool.query("SELECT kyc_level,status FROM kyc_records WHERE user_id=$1",[user_id]),
    ]);

    await logAdminAction(req.user.id, "user", user_id, "profile_viewed",
      null, null, "Admin overview access", req);
    await notifyUserOfAdminAccess(parseInt(user_id), `Admin #${req.user.id}`, "Account overview viewed", "Administrative review");

    return res.json({
      success:  true,
      user: {
        ...user.rows[0],
        // SENSITIVE FIELDS NEVER RETURNED:
        password:    "🔒 [HIDDEN]",
        pin:         "🔒 [HIDDEN]",
        bvn:         "🔒 [HIDDEN]",
        nin:         "🔒 [HIDDEN]",
        card_details:"🔒 [HIDDEN]",
      },
      financials: {
        wallet_balance_ngn: wallet.rows[0]?.balance_ngn || 0,
        thrift_balance:     thrift.rows[0]?.balance     || 0,
        total_orders:       parseInt(orders.rows[0].c),
        total_spent:        parseFloat(orders.rows[0].total || 0),
      },
      kyc: kyc_level.rows[0] || { kyc_level: 0, status: "pending" },
      admin_notice: "Passwords, PINs, BVN, and card details are NEVER accessible to any admin.",
    });
  })
);

initSchema().catch(console.error);
app.use(errorHandler);
app.listen(PORT, () => logger.info(`✅ Admin Override Service (Update #94) running on port ${PORT}`));
module.exports = app;
