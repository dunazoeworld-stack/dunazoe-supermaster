// DUNAZOE OS — AI PAYMENTS MANAGER (Update #94)
// services/payments-ai-service/index.js
// Port: 4031
// Superuser-controlled AI payment governance
require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const { Pool } = require("pg");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");
const { logger, requestLogger }      = require("../../shared/logger");

const app  = express();
const PORT = process.env.PORT || 4031;
app.use(cors()); app.use(express.json()); app.use(requestLogger);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

app.get("/health", (req,res) => res.json({ service:"payments-ai-service",status:"ok",port:PORT,update:"#94" }));

// Payment anomaly detection
app.get("/payments-ai/anomalies", requireAuth, requireRole("super_admin","cto"), asyncHandler(async (req,res) => {
  const { hours=24 } = req.query;
  const anomalies = [];

  // Detect duplicate payouts
  const dupes = await pool.query(`
    SELECT reference, COUNT(*) c, SUM(amount) total
    FROM payout_ledger
    WHERE created_at > NOW() - INTERVAL '${parseInt(hours)} hours'
    GROUP BY reference HAVING COUNT(*) > 1`
  ).catch(()=>({rows:[]}));

  for (const d of dupes.rows) {
    anomalies.push({ type:"duplicate_payout", reference:d.reference, count:d.c, total:d.total, severity:"critical" });
  }

  // Detect unusual escrow releases
  const large_releases = await pool.query(`
    SELECT id, order_id, amount FROM escrow
    WHERE status='released' AND amount > 500000
    AND updated_at > NOW() - INTERVAL '${parseInt(hours)} hours'`
  ).catch(()=>({rows:[]}));

  for (const r of large_releases.rows) {
    anomalies.push({ type:"large_escrow_release", escrow_id:r.id, amount:r.amount, severity:"high" });
  }

  return res.json({
    success: true,
    period_hours: parseInt(hours),
    anomalies_count: anomalies.length,
    anomalies,
    ai_status: process.env.PAYMENTS_AI_ACTIVE === "true" ? "ACTIVE" : "INACTIVE",
    superuser_note: "Only Superuser can activate/deactivate AI Payments Manager",
  });
}));

// Superuser activation control
app.post("/payments-ai/activate", requireAuth, requireRole("super_admin"), asyncHandler(async(req,res) => {
  const { active, reason } = req.body;
  process.env.PAYMENTS_AI_ACTIVE = active ? "true" : "false";
  logger.warn("[PaymentsAI] Status changed", { active, by: req.user.id, reason });
  return res.json({ success:true, active, message:`AI Payments Manager ${active?"ACTIVATED":"DEACTIVATED"} by Superuser` });
}));

// Payment monitoring dashboard
app.get("/payments-ai/dashboard", requireAuth, requireRole("super_admin","cto"), asyncHandler(async(req,res) => {
  const [total_today, pending_payouts, failed_webhooks, escrow_held] = await Promise.all([
    pool.query("SELECT COALESCE(SUM(amount),0) total FROM orders WHERE status='paid' AND created_at>NOW()-INTERVAL '24 hours'"),
    pool.query("SELECT COUNT(*) c, COALESCE(SUM(amount),0) total FROM payout_ledger WHERE status='pending'"),
    pool.query("SELECT COUNT(*) c FROM webhook_verifications WHERE is_verified=FALSE AND created_at>NOW()-INTERVAL '24 hours'").catch(()=>({rows:[{c:0}]})),
    pool.query("SELECT COUNT(*) c, COALESCE(SUM(amount),0) total FROM escrow WHERE status='held'"),
  ]);

  return res.json({
    success: true,
    ai_active: process.env.PAYMENTS_AI_ACTIVE === "true",
    dashboard: {
      revenue_today_ngn: parseFloat(total_today.rows[0].total),
      pending_payouts: { count: parseInt(pending_payouts.rows[0].c), amount_ngn: parseFloat(pending_payouts.rows[0].total) },
      failed_webhooks_24h: parseInt(failed_webhooks.rows[0].c),
      escrow_held: { count: parseInt(escrow_held.rows[0].c), amount_ngn: parseFloat(escrow_held.rows[0].total) },
    },
    superuser_controls: ["activate","deactivate","override_decision","approve_exceptional_payout"],
  });
}));

app.use(errorHandler);
app.listen(PORT, () => logger.info(`✅ AI Payments Manager (Update #94) running on port ${PORT}`));
module.exports = app;
