// ================================================================
// DUNAZOE OS — NOTIFICATION SERVICE
// services/notification-service/index.js
// Port: 4017
//
// Channels:
//   in_app   — stored in notifications table (pulled by client)
//   whatsapp — queued, sent via Termii WhatsApp Business API
//   sms      — queued, sent via Termii/BulkSMSNigeria
//   email    — queued (Phase 9 — not yet implemented)
//
// CTO: All notifications queued first, flushed by background job.
//      Failed sends retry up to 3 times before marking failed.
// ================================================================

require("dotenv").config();

const express   = require("express");
const cors      = require("cors");
const axios     = require("axios");
const { Pool }  = require("pg");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");

const app  = express();
const PORT = process.env.PORT || 4017;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const TERMII_KEY      = process.env.TERMII_API_KEY    || "";
const TERMII_SENDER   = process.env.TERMII_SENDER_ID  || "DUNAZOE";
const TERMII_BASE     = "https://api.ng.termii.com/api";
const MAX_RETRIES     = 3;
const FLUSH_INTERVAL  = 30000; // 30 seconds

// ── HEALTH ────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    service: "notification-service", status: "ok", port: PORT,
    channels: {
      in_app:   "active",
      whatsapp: TERMII_KEY ? "active (Termii)" : "queued only — TERMII_API_KEY not set",
      sms:      TERMII_KEY ? "active (Termii)" : "queued only",
    },
  });
});

// ── SEND NOTIFICATION ─────────────────────────────────────────
/**
 * POST /notifications/send
 * Internal — called by other services
 * Body: { user_id, title, body, type?, channels? }
 * channels: ["in_app", "whatsapp", "sms"] (default: ["in_app"])
 */
app.post("/notifications/send", asyncHandler(async (req, res) => {
  const {
    user_id, title, body,
    type     = "info",
    channels = ["in_app"],
  } = req.body;

  if (!user_id || !title || !body) {
    return res.status(400).json({ success: false, error: "user_id, title, body required" });
  }

  const results = {};

  // ── IN-APP ────────────────────────────────────────────────
  if (channels.includes("in_app")) {
    await pool.query(
      "INSERT INTO notifications(user_id,title,body,type,channel) VALUES($1,$2,$3,$4,'in_app')",
      [user_id, title, body, type]
    );
    results.in_app = "queued";
  }

  // ── WHATSAPP / SMS ────────────────────────────────────────
  if (channels.includes("whatsapp") || channels.includes("sms")) {
    const user = await pool.query(
      "SELECT phone, whatsapp FROM users WHERE id=$1", [user_id]
    );
    if (user.rows[0]) {
      const phone   = user.rows[0].whatsapp || user.rows[0].phone;
      const message = `${title}\n${body}`;

      if (phone) {
        if (channels.includes("whatsapp")) {
          await pool.query(
            "INSERT INTO message_queue(phone,message,channel) VALUES($1,$2,'whatsapp')",
            [phone, message]
          );
          results.whatsapp = "queued";
        }
        if (channels.includes("sms")) {
          const sms_body = `${title}: ${body}`.substring(0, 160);
          await pool.query(
            "INSERT INTO message_queue(phone,message,channel) VALUES($1,$2,'sms')",
            [phone, sms_body]
          );
          results.sms = "queued";
        }
      }
    }
  }

  return res.json({ success: true, results });
}));

// ── SEND BULK NOTIFICATION (marketing campaigns) ──────────────
/**
 * POST /notifications/bulk
 * Auth: Admin only
 * Body: { user_ids[], title, body, type?, channels? }
 */
app.post("/notifications/bulk", requireAuth, requireRole("admin"),
  asyncHandler(async (req, res) => {
    const { user_ids = [], title, body, type = "info", channels = ["in_app"] } = req.body;

    if (!user_ids.length || !title || !body) {
      return res.status(400).json({ success: false, error: "user_ids, title, body required" });
    }
    if (user_ids.length > 10000) {
      return res.status(400).json({ success: false, error: "Max 10,000 users per bulk send" });
    }

    // Batch insert in-app notifications
    if (channels.includes("in_app")) {
      const values = user_ids.map((_, i) =>
        `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`
      ).join(",");
      const params = user_ids.flatMap(uid => [uid, title, body, type]);
      await pool.query(
        `INSERT INTO notifications(user_id,title,body,type) VALUES ${values}`, params
      );
    }

    // Queue WhatsApp/SMS for users with phones
    if (channels.includes("whatsapp") || channels.includes("sms")) {
      const users = await pool.query(
        "SELECT id, phone, whatsapp FROM users WHERE id = ANY($1::int[]) AND phone IS NOT NULL",
        [user_ids]
      );
      const msg_values = [];
      const msg_params = [];
      let   idx        = 1;

      for (const u of users.rows) {
        const phone = u.whatsapp || u.phone;
        if (!phone) continue;
        if (channels.includes("whatsapp")) {
          msg_values.push(`($${idx++},$${idx++},'whatsapp')`);
          msg_params.push(phone, `${title}\n${body}`);
        }
        if (channels.includes("sms")) {
          msg_values.push(`($${idx++},$${idx++},'sms')`);
          msg_params.push(phone, `${title}: ${body}`.substring(0, 160));
        }
      }
      if (msg_values.length) {
        await pool.query(
          `INSERT INTO message_queue(phone,message,channel) VALUES ${msg_values.join(",")}`,
          msg_params
        );
      }
    }

    return res.json({
      success:   true,
      sent_to:   user_ids.length,
      channels,
      message:   `Bulk notification queued for ${user_ids.length} users`,
    });
  })
);

// ── GET MY NOTIFICATIONS ──────────────────────────────────────
app.get("/notifications", requireAuth, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unread_only } = req.query;
  const offset = (parseInt(page)-1)*parseInt(limit);

  let q    = "SELECT * FROM notifications WHERE user_id=$1";
  const v  = [req.user.id];
  if (unread_only === "true") { q += " AND is_read=FALSE"; }
  q += " ORDER BY created_at DESC LIMIT $2 OFFSET $3";
  v.push(parseInt(limit), offset);

  const rows  = await pool.query(q, v);
  const unread= await pool.query(
    "SELECT COUNT(*) c FROM notifications WHERE user_id=$1 AND is_read=FALSE",
    [req.user.id]
  );

  return res.json({
    success:        true,
    notifications:  rows.rows,
    unread_count:   parseInt(unread.rows[0].c),
    page:           parseInt(page),
  });
}));

// ── MARK READ ─────────────────────────────────────────────────
app.post("/notifications/read", requireAuth, asyncHandler(async (req, res) => {
  const { notification_ids = [], all = false } = req.body;

  if (all) {
    await pool.query(
      "UPDATE notifications SET is_read=TRUE WHERE user_id=$1", [req.user.id]
    );
    return res.json({ success: true, message: "All notifications marked as read" });
  }
  if (notification_ids.length) {
    await pool.query(
      "UPDATE notifications SET is_read=TRUE WHERE id=ANY($1::int[]) AND user_id=$2",
      [notification_ids, req.user.id]
    );
  }
  return res.json({ success: true, updated: notification_ids.length });
}));

// ── FLUSH MESSAGE QUEUE (background job) ──────────────────────
/**
 * POST /notifications/flush
 * Internal only — called by watchdog or cron
 * Sends queued WhatsApp/SMS messages via Termii
 */
app.post("/notifications/flush", asyncHandler(async (req, res) => {
  const internal = req.headers["x-internal-key"];
  if (internal !== process.env.INTERNAL_SECRET) {
    return res.status(401).json({ success: false, error: "Unauthorised" });
  }

  const pending = await pool.query(
    "SELECT * FROM message_queue WHERE status='queued' AND attempts<$1 ORDER BY created_at LIMIT 50",
    [MAX_RETRIES]
  );

  let sent = 0; let failed = 0;

  for (const msg of pending.rows) {
    try {
      if (TERMII_KEY) {
        if (msg.channel === "sms") {
          await _send_sms(msg.phone, msg.message);
        } else if (msg.channel === "whatsapp") {
          await _send_whatsapp(msg.phone, msg.message);
        }
      }
      await pool.query(
        "UPDATE message_queue SET status='sent', sent_at=NOW() WHERE id=$1", [msg.id]
      );
      sent++;
    } catch (e) {
      await pool.query(
        "UPDATE message_queue SET attempts=attempts+1, status=CASE WHEN attempts+1>=$1 THEN 'failed' ELSE 'queued' END WHERE id=$2",
        [MAX_RETRIES, msg.id]
      );
      failed++;
    }
  }

  return res.json({ success: true, sent, failed, total: pending.rows.length });
}));

// ── QUEUE STATS (Admin) ───────────────────────────────────────
app.get("/notifications/queue/stats", requireAuth, requireRole("admin"),
  asyncHandler(async (req, res) => {
    const stats = await pool.query(`
      SELECT channel,
        COUNT(*) FILTER (WHERE status='queued')  queued,
        COUNT(*) FILTER (WHERE status='sent')    sent,
        COUNT(*) FILTER (WHERE status='failed')  failed
      FROM message_queue GROUP BY channel
    `);
    const notif_total = await pool.query("SELECT COUNT(*) c FROM notifications");
    return res.json({
      success:      true,
      message_queue: stats.rows,
      in_app_total:  parseInt(notif_total.rows[0].c),
    });
  })
);

// ── SEND VIA TERMII ───────────────────────────────────────────
async function _send_sms(phone, message) {
  const cleaned = phone.replace(/\D/g, "");
  const intl    = cleaned.startsWith("0") ? `234${cleaned.slice(1)}` : cleaned;

  await axios.post(`${TERMII_BASE}/sms/send`, {
    to:         intl,
    from:       TERMII_SENDER,
    sms:        message.substring(0, 160),
    type:       "plain",
    api_key:    TERMII_KEY,
    channel:    "generic",
  });
}

async function _send_whatsapp(phone, message) {
  const cleaned = phone.replace(/\D/g, "");
  const intl    = cleaned.startsWith("0") ? `234${cleaned.slice(1)}` : cleaned;

  await axios.post(`${TERMII_BASE}/sms/send`, {
    to:         intl,
    from:       TERMII_SENDER,
    sms:        message,
    type:       "plain",
    api_key:    TERMII_KEY,
    channel:    "whatsapp",
  });
}

// ── AUTO-FLUSH EVERY 30 SECONDS ───────────────────────────────
if (process.env.NODE_ENV !== "test") {
  setInterval(async () => {
    if (!TERMII_KEY) return; // skip if not configured
    try {
      await axios.post(`http://localhost:${PORT}/notifications/flush`, {},
        { headers: { "x-internal-key": process.env.INTERNAL_SECRET || "" } }
      );
    } catch (_) {}
  }, FLUSH_INTERVAL);
}

app.use(errorHandler);
app.listen(PORT, () => console.log(`✅ Notification Service running on port ${PORT}`));
module.exports = app;
