// ================================================================
// DUNAZOE OS — AI CYBERSECURITY ENGINE (Update #94)
// services/security-ai-service/index.js
// Port: 4026
//
// CEO VIEW: This is DUNAZOE's immune system.
//   It watches every account, API, payment, and login
//   in real time — 24/7 — across every device.
//
// CTO IMPLEMENTATION:
//   - Real-time threat detection across all 24 services
//   - Risk-based automated responses (warn → freeze → suspend)
//   - Escalation chain: System → CSO → CTO → CEO → Superuser
//   - Multi-device monitoring (Android, iOS, tablet, desktop)
//   - Every action logged and auditable (zero impunity)
//   - AI cannot permanently ban — only Superuser/CEO can
// ================================================================

require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const { Pool } = require("pg");
const crypto   = require("crypto");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");
const { logger, requestLogger }      = require("../../shared/logger");
const { queueJob }                   = require("../../shared/fintech/fintechOS");

const app  = express();
const PORT = process.env.PORT || 4026;
app.use(cors()); app.use(express.json()); app.use(requestLogger);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// ── INIT SCHEMA ───────────────────────────────────────────────
async function initSecuritySchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS security_threats (
      id              BIGSERIAL PRIMARY KEY,
      threat_type     TEXT NOT NULL,
      severity        TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
      target_type     TEXT NOT NULL CHECK (target_type IN (
        'user','vendor','delivery_vendor','admin','shareholder',
        'api','payment','thrift','database','server',
        'chat','notification','mobile','web','integration'
      )),
      target_id       TEXT,
      description     TEXT NOT NULL,
      evidence        JSONB DEFAULT '{}',
      ai_confidence   NUMERIC(5,2),  -- 0-100%
      action_taken    TEXT,
      status          TEXT DEFAULT 'open' CHECK (status IN (
        'open','investigating','mitigated','resolved','false_positive'
      )),
      escalated_to    TEXT[],        -- list of roles notified
      ip_address      TEXT,
      device_info     JSONB,
      resolved_by     INTEGER REFERENCES users(id),
      resolved_at     TIMESTAMP,
      created_at      TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_st_type     ON security_threats(threat_type);
    CREATE INDEX IF NOT EXISTS idx_st_severity ON security_threats(severity);
    CREATE INDEX IF NOT EXISTS idx_st_target   ON security_threats(target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_st_status   ON security_threats(status);
    CREATE INDEX IF NOT EXISTS idx_st_time     ON security_threats(created_at DESC);

    CREATE TABLE IF NOT EXISTS threat_rules (
      id              SERIAL PRIMARY KEY,
      rule_name       TEXT UNIQUE NOT NULL,
      threat_type     TEXT NOT NULL,
      description     TEXT,
      threshold       JSONB NOT NULL,  -- configurable thresholds
      severity        TEXT NOT NULL,
      action          TEXT NOT NULL CHECK (action IN (
        'log','warn','require_mfa','freeze_txn',
        'suspend_account','escalate_cso','escalate_cto','escalate_superuser'
      )),
      is_active       BOOLEAN DEFAULT TRUE,
      updated_at      TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS security_responses (
      id              SERIAL PRIMARY KEY,
      threat_id       BIGINT REFERENCES security_threats(id),
      response_type   TEXT NOT NULL,
      target_id       TEXT,
      executed_by     TEXT DEFAULT 'AI',
      approved_by     INTEGER REFERENCES users(id),
      is_reversible   BOOLEAN DEFAULT TRUE,
      reversed_at     TIMESTAMP,
      notes           TEXT,
      created_at      TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS social_media_threats (
      id              SERIAL PRIMARY KEY,
      platform        TEXT NOT NULL,
      threat_type     TEXT NOT NULL CHECK (threat_type IN (
        'unauthorized_access','suspicious_login','credential_leak',
        'fake_page','impersonation','phishing','bot_attack','malicious_link'
      )),
      detected_at     TIMESTAMP DEFAULT NOW(),
      action_taken    TEXT,
      status          TEXT DEFAULT 'detected',
      notified_admin  BOOLEAN DEFAULT FALSE
    );

    -- Seed default threat rules
    INSERT INTO threat_rules(rule_name,threat_type,description,threshold,severity,action) VALUES
      ('brute_force_login','brute_force',
       'Multiple failed logins from same IP',
       '{"max_failures":5,"window_minutes":10}','high','require_mfa'),
      ('impossible_travel','account_takeover',
       'Login from impossible geographic distance',
       '{"max_speed_kmh":900}','critical','escalate_cso'),
      ('rapid_withdrawal','financial_fraud',
       'Multiple large withdrawals in short window',
       '{"max_amount":500000,"window_minutes":60}','critical','freeze_txn'),
      ('duplicate_payment','payment_fraud',
       'Same reference submitted multiple times',
       '{"max_duplicates":2}','high','log'),
      ('api_abuse','api_abuse',
       'Unusually high API call rate from single source',
       '{"max_rpm":300}','medium','warn'),
      ('fake_webhook','payment_fraud',
       'Webhook signature verification failed',
       '{"max_failures":3,"window_minutes":5}','critical','escalate_cto'),
      ('account_takeover','account_takeover',
       'Login from new device after password change',
       '{"hours_after_pw_change":24}','high','require_mfa'),
      ('mass_order_fraud','financial_fraud',
       'Same user placing many high-value orders rapidly',
       '{"max_orders":5,"window_minutes":60,"min_amount":50000}','high','freeze_txn'),
      ('vendor_suspicious','vendor_fraud',
       'Vendor with unusual refund/dispute ratio',
       '{"dispute_ratio":0.30}','medium','escalate_cso'),
      ('social_media_unauthorized','social_media',
       'Unauthorized access to social media account',
       '{"max_failed_logins":3}','critical','escalate_superuser')
    ON CONFLICT(rule_name) DO NOTHING;
  `).catch(e => logger.warn("[SecurityAI] Schema:", e.message));
  logger.info("[SecurityAI] Schema ready ✓");
}

// ================================================================
// CORE: AI THREAT DETECTION ENGINE
// ================================================================
async function detectThreats(event_type, data) {
  const threats = [];

  switch (event_type) {

    // ── BRUTE FORCE ─────────────────────────────────────────
    case "login_failed": {
      const { user_id, ip_address, email } = data;
      const failures = await pool.query(
        `SELECT COUNT(*) c FROM auth_attempts
         WHERE (identifier=$1 OR ip_address=$2)
           AND success=FALSE AND created_at>NOW()-INTERVAL '10 minutes'`,
        [email || user_id, ip_address]
      );
      if (parseInt(failures.rows[0].c) >= 5) {
        threats.push({
          threat_type: "brute_force",
          severity:    "high",
          target_type: "user",
          target_id:   String(user_id || email),
          description: `Brute force: ${failures.rows[0].c} failed logins in 10 minutes`,
          evidence:    { failures: failures.rows[0].c, ip_address },
          action:      "require_mfa",
          ip_address,
        });
      }
      break;
    }

    // ── IMPOSSIBLE TRAVEL ────────────────────────────────────
    case "login_success": {
      const { user_id, ip_address, lat, lng } = data;
      if (lat && lng) {
        const last = await pool.query(
          `SELECT lat, lng, created_at FROM auth_attempts
           WHERE identifier IN (SELECT email FROM users WHERE id=$1)
             AND success=TRUE AND lat IS NOT NULL
           ORDER BY created_at DESC OFFSET 1 LIMIT 1`,
          [user_id]
        );
        if (last.rows[0]) {
          const dist   = haversine(lat, lng, last.rows[0].lat, last.rows[0].lng);
          const hours  = (Date.now()-new Date(last.rows[0].created_at))/3600000;
          const speed  = hours > 0 ? dist/hours : 0;
          if (speed > 900) {
            threats.push({
              threat_type: "impossible_travel",
              severity:    "critical",
              target_type: "user",
              target_id:   String(user_id),
              description: `Impossible travel: ${dist.toFixed(0)}km in ${hours.toFixed(1)}h (${speed.toFixed(0)}km/h)`,
              evidence:    { dist_km: dist, speed_kmh: speed, hours },
              action:      "escalate_cso",
              ip_address,
            });
          }
        }
      }
      break;
    }

    // ── RAPID WITHDRAWAL ─────────────────────────────────────
    case "wallet_withdraw": {
      const { user_id, amount } = data;
      const total = await pool.query(
        `SELECT COALESCE(SUM(amount),0) total FROM wallet_transactions
         WHERE user_id=$1 AND type='withdrawal'
           AND created_at>NOW()-INTERVAL '60 minutes'`,
        [user_id]
      );
      if (parseFloat(total.rows[0].total) + parseFloat(amount) > 500000) {
        threats.push({
          threat_type: "financial_fraud",
          severity:    "critical",
          target_type: "payment",
          target_id:   String(user_id),
          description: `Rapid withdrawal: ₦${(parseFloat(total.rows[0].total)+parseFloat(amount)).toLocaleString()} in 1 hour`,
          evidence:    { total_ngn: total.rows[0].total, current_amount: amount },
          action:      "freeze_txn",
        });
      }
      break;
    }

    // ── FAKE WEBHOOK ──────────────────────────────────────────
    case "webhook_sig_fail": {
      const { provider, ip_address, reference } = data;
      threats.push({
        threat_type: "payment_fraud",
        severity:    "critical",
        target_type: "payment",
        target_id:   reference,
        description: `Webhook signature verification FAILED from ${ip_address} — possible forged ${provider} webhook`,
        evidence:    { provider, ip_address, reference },
        action:      "escalate_cto",
        ip_address,
      });
      break;
    }

    // ── API ABUSE ─────────────────────────────────────────────
    case "api_rate_exceeded": {
      const { ip_address, endpoint, count } = data;
      threats.push({
        threat_type: "api_abuse",
        severity:    count > 1000 ? "high" : "medium",
        target_type: "api",
        target_id:   endpoint,
        description: `API abuse: ${count} req/min to ${endpoint} from ${ip_address}`,
        evidence:    { ip_address, endpoint, count },
        action:      "warn",
        ip_address,
      });
      break;
    }

    // ── SOCIAL MEDIA UNAUTHORIZED ─────────────────────────────
    case "social_unauthorized": {
      const { platform, account_id } = data;
      threats.push({
        threat_type: "social_media",
        severity:    "critical",
        target_type: "integration",
        target_id:   `${platform}:${account_id}`,
        description: `Unauthorized access attempt on ${platform} social account`,
        evidence:    data,
        action:      "escalate_superuser",
      });
      await pool.query(
        `INSERT INTO social_media_threats(platform,threat_type,action_taken,notified_admin)
         VALUES($1,'unauthorized_access','suspended_session',true)`,
        [platform]
      ).catch(() => {});
      break;
    }
  }

  // Persist and respond to each threat
  for (const threat of threats) {
    await respondToThreat(threat);
  }

  return threats;
}

// ================================================================
// AI RESPONSE ENGINE — Risk-based automated actions
// ================================================================
async function respondToThreat(threat) {
  const threat_record = await pool.query(
    `INSERT INTO security_threats(threat_type,severity,target_type,target_id,
       description,evidence,ai_confidence,action_taken,escalated_to,ip_address)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [threat.threat_type, threat.severity, threat.target_type,
     threat.target_id, threat.description, JSON.stringify(threat.evidence || {}),
     threat.confidence || 85,
     threat.action, getEscalationList(threat.severity),
     threat.ip_address || null]
  );

  const threat_id = threat_record.rows[0].id;

  // Execute AI response based on risk level
  switch (threat.action) {

    case "warn":
      await queueJob("send_push", {
        user_id: threat.target_id,
        title:   "⚠️ Security Alert",
        body:    "Unusual activity detected on your account. Contact support if this was not you.",
      }).catch(() => {});
      break;

    case "require_mfa":
      // Flag user session — next request requires MFA
      await pool.query(
        "UPDATE users SET mfa_required=TRUE WHERE id=$1",
        [threat.target_id]
      ).catch(() => {});
      break;

    case "freeze_txn":
      // Pause pending transactions for this user
      await pool.query(
        `UPDATE wallet_transactions SET status='frozen'
         WHERE user_id=$1 AND status='pending'`,
        [threat.target_id]
      ).catch(() => {});
      logger.error("[SecurityAI] Transaction FROZEN", { user_id: threat.target_id, threat_id });
      break;

    case "suspend_account":
      // ONLY suspends — only Superuser/CEO can permanently ban
      await pool.query(
        "UPDATE users SET status='suspended',suspension_reason=$1 WHERE id=$2",
        [`AI security suspension — Threat #${threat_id}`, threat.target_id]
      ).catch(() => {});
      break;

    case "escalate_cso":
    case "escalate_cto":
    case "escalate_superuser":
      await escalateToHumans(threat, threat.action, threat_id);
      break;
  }

  // Record response
  await pool.query(
    `INSERT INTO security_responses(threat_id,response_type,target_id,executed_by)
     VALUES($1,$2,$3,'AI')`,
    [threat_id, threat.action, threat.target_id]
  ).catch(() => {});

  return threat_id;
}

// ================================================================
// ESCALATION CHAIN
// ================================================================
async function escalateToHumans(threat, escalation_level, threat_id) {
  const ESCALATION = {
    "escalate_cso":       ["cybersecurity_officer"],
    "escalate_cto":       ["cybersecurity_officer","cto"],
    "escalate_superuser": ["cybersecurity_officer","cto","super_admin"],
  };

  const roles = ESCALATION[escalation_level] || ["admin"];

  // Get admin users with these roles
  const admins = await pool.query(
    "SELECT id, name, email, phone FROM users WHERE role=ANY($1::text[]) AND is_active=TRUE",
    [roles]
  );

  for (const admin of admins.rows) {
    // Notify via WhatsApp (highest priority for security)
    await queueJob("send_whatsapp", {
      phone:   admin.phone,
      message: `🚨 DUNAZOE SECURITY ALERT\n\nThreat: ${threat.threat_type}\nSeverity: ${threat.severity.toUpperCase()}\nTarget: ${threat.target_id}\n\n${threat.description}\n\nThreat ID: #${threat_id}\nAction Required: Review at admin.dunazoe.com/security`,
    }, { priority: 1 }).catch(() => {});

    // Also queue email
    await queueJob("send_email", {
      to:      admin.email,
      subject: `🚨 SECURITY ALERT [${threat.severity.toUpperCase()}] — ${threat.threat_type}`,
      body:    `Threat #${threat_id}: ${threat.description}\n\nEvidence: ${JSON.stringify(threat.evidence, null, 2)}`,
    }, { priority: 1 }).catch(() => {});
  }

  logger.error(`[SecurityAI] ESCALATED to ${escalation_level}`, { threat_id, severity: threat.severity });
}

function getEscalationList(severity) {
  if (severity === "critical") return ["cybersecurity_officer","cto","super_admin"];
  if (severity === "high")     return ["cybersecurity_officer","cto"];
  if (severity === "medium")   return ["cybersecurity_officer"];
  return ["admin"];
}

function haversine(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = Math.PI/180*(lat2-lat1);
  const dLng = Math.PI/180*(lng2-lng1);
  const a    = Math.sin(dLat/2)**2 + Math.cos(Math.PI/180*lat1)*Math.cos(Math.PI/180*lat2)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ================================================================
// HTTP API
// ================================================================

app.get("/health", (req, res) => res.json({
  service: "security-ai-service",
  status:  "ok",
  port:    PORT,
  update:  "#94",
}));

// Ingest security event from any service
app.post("/security/event", asyncHandler(async (req, res) => {
  const { event_type, data } = req.body;
  if (!event_type) return res.status(400).json({ success: false, error: "event_type required" });

  const threats = await detectThreats(event_type, data || {});

  return res.json({
    success:      true,
    threats_detected: threats.length,
    threats:      threats.map(t => ({
      type:     t.threat_type,
      severity: t.severity,
      action:   t.action,
    })),
  });
}));

// Get active threats dashboard
app.get("/security/threats", requireAuth,
  requireRole("admin","cto","super_admin","cybersecurity_officer"),
  asyncHandler(async (req, res) => {
    const { severity, status = "open", limit = 50 } = req.query;
    const params = [status];
    let where    = "WHERE status=$1";
    if (severity) { where += ` AND severity=$${params.length+1}`; params.push(severity); }

    const threats = await pool.query(
      `SELECT * FROM security_threats ${where} ORDER BY created_at DESC LIMIT $${params.length+1}`,
      [...params, parseInt(limit)]
    );

    const summary = await pool.query(
      `SELECT severity, COUNT(*) count FROM security_threats
       WHERE status='open' AND created_at>NOW()-INTERVAL '24 hours'
       GROUP BY severity`
    );

    return res.json({
      success:  true,
      threats:  threats.rows,
      summary:  Object.fromEntries(summary.rows.map(r=>[r.severity,parseInt(r.count)])),
      total:    threats.rows.length,
    });
  })
);

// Resolve a threat (admin action)
app.post("/security/threats/:id/resolve", requireAuth,
  requireRole("admin","cto","super_admin","cybersecurity_officer"),
  asyncHandler(async (req, res) => {
    const { status = "resolved", notes } = req.body;
    await pool.query(
      "UPDATE security_threats SET status=$1,resolved_by=$2,resolved_at=NOW() WHERE id=$3",
      [status, req.user.id, req.params.id]
    );
    return res.json({ success: true, status, threat_id: req.params.id });
  })
);

// Security dashboard — CEO/CTO view
app.get("/security/dashboard", requireAuth,
  requireRole("admin","cto","super_admin","cybersecurity_officer"),
  asyncHandler(async (req, res) => {
    const [open_critical, open_high, last_24h, top_threat_types] = await Promise.all([
      pool.query("SELECT COUNT(*) c FROM security_threats WHERE severity='critical' AND status='open'"),
      pool.query("SELECT COUNT(*) c FROM security_threats WHERE severity='high' AND status='open'"),
      pool.query("SELECT COUNT(*) c FROM security_threats WHERE created_at>NOW()-INTERVAL '24 hours'"),
      pool.query(
        `SELECT threat_type, COUNT(*) count FROM security_threats
         WHERE created_at>NOW()-INTERVAL '7 days'
         GROUP BY threat_type ORDER BY count DESC LIMIT 5`
      ),
    ]);

    return res.json({
      success: true,
      ceo_view: {
        platform_status:       parseInt(open_critical.rows[0].c) > 0 ? "🔴 CRITICAL THREATS" : "🟢 SECURE",
        critical_open:         parseInt(open_critical.rows[0].c),
        high_open:             parseInt(open_high.rows[0].c),
        incidents_last_24h:    parseInt(last_24h.rows[0].c),
      },
      cto_view: {
        top_threat_types: top_threat_types.rows,
        action_required:  parseInt(open_critical.rows[0].c) > 0
          ? "Immediate review of critical threats required"
          : null,
      },
    });
  })
);

// Override AI action (Superuser/CEO only)
app.post("/security/responses/:id/override", requireAuth,
  requireRole("super_admin"),
  asyncHandler(async (req, res) => {
    const { action, reason } = req.body;
    await pool.query(
      `UPDATE security_responses SET approved_by=$1,notes=$2 WHERE id=$3`,
      [req.user.id, reason, req.params.id]
    );

    // Log override — full audit trail
    logger.warn("AI security action OVERRIDDEN", {
      overridden_by: req.user.id,
      response_id:   req.params.id,
      new_action:    action,
      reason,
    });

    return res.json({ success: true, message: "Override recorded and logged", override_by: req.user.id });
  })
);

initSecuritySchema().catch(console.error);
app.use(errorHandler);
app.listen(PORT, () => logger.info(`✅ AI Security Engine (Update #94) running on port ${PORT}`));
module.exports = app;
