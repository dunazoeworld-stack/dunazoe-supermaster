// ================================================================
// DUNAZOE OS — RELIABILITY AI SERVICE (Update #93)
// services/reliability-service/index.js
// Port: 4025
//
// CEO VIEW: This service is the immune system of DUNAZOE.
//   It watches everything, predicts failures before they happen,
//   and automatically degrades gracefully when they do.
//
// CTO IMPLEMENTATION (Update #93):
//   93.1  — Multi-AZ health aggregation
//   93.2  — Full observability (latency p50/p95/p99)
//   93.3  — AI Incident Commander
//   93.4  — Nigeria network resilience monitoring
//   93.5  — Cost governance AI
//   93.6  — Graceful degradation controller
//   93.7  — Chaos engineering trigger endpoints
//   93.8  — Finance-grade webhook double-verification
//   93.16 — AI traffic surge protection
//   93.17 — Continuous reliability monitoring
// ================================================================

require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const { Pool } = require("pg");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");
const { logger, requestLogger }      = require("../../shared/logger");
const {
  initReliabilitySchema,
  getActiveFallback,
  checkServiceHealth,
  verifyWebhookWithProvider,
  validateNonce,
  analyzeCosts,
  detectTrafficSurge,
  injectChaos,
  aggregateHealthChecks,
  checkSSLCertificate,
} = require("../../shared/reliability/reliabilityEngine");

const app  = express();
const PORT = process.env.PORT || 4025;
app.use(cors()); app.use(express.json()); app.use(requestLogger);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// ── HEALTH ────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({
  service: "reliability-service",
  status:  "ok",
  port:    PORT,
  version: "93.17",
}));

// ================================================================
// SECTION A — PLATFORM HEALTH (93.1, 93.2)
// ================================================================

// Full health check across all services
app.get("/reliability/health", requireAuth,
  asyncHandler(async (req, res) => {
    const health = await aggregateHealthChecks();
    return res.json({ success: true, ...health });
  })
);

// Service-level latency metrics (p50/p95/p99)
app.get("/reliability/latency", requireAuth,
  requireRole("admin","cto","super_admin","cybersecurity_officer"),
  asyncHandler(async (req, res) => {
    const { window_mins = 60 } = req.query;
    const stats = await pool.query(
      `SELECT service,
         PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms) p50,
         PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) p95,
         PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) p99,
         COUNT(*)                                                   samples,
         AVG(CASE WHEN status='down' THEN 1 ELSE 0 END)*100       error_pct
       FROM service_health_log
       WHERE checked_at > NOW() - INTERVAL '${parseInt(window_mins)} minutes'
       GROUP BY service
       ORDER BY p95 DESC NULLS LAST`
    );

    const sla_breaches = stats.rows.filter(r => parseFloat(r.p95) > 500);

    return res.json({
      success:     true,
      window_mins: parseInt(window_mins),
      services:    stats.rows,
      sla_breaches,
      sla_target:  "p95 < 500ms",
      checked_at:  new Date().toISOString(),
    });
  })
);

// ================================================================
// SECTION B — GRACEFUL DEGRADATION CONTROLLER (93.6)
// ================================================================

// Get current degradation status
app.get("/reliability/degradation", requireAuth,
  asyncHandler(async (req, res) => {
    const events = await pool.query(
      `SELECT * FROM degradation_events
       WHERE resolved_at IS NULL
       ORDER BY activated_at DESC LIMIT 20`
    );

    return res.json({
      success:            true,
      active_degradations:events.rows,
      count:              events.rows.length,
      platform_status:    events.rows.length === 0 ? "FULLY_OPERATIONAL" : "DEGRADED",
    });
  })
);

// Trigger graceful fallback for a service
app.post("/reliability/degrade/:service", requireAuth,
  requireRole("admin","cto","super_admin"),
  asyncHandler(async (req, res) => {
    const { service } = req.params;
    const fallback    = await getActiveFallback(service);

    if (!fallback) {
      return res.status(503).json({
        success: false,
        error:   `No fallback available for ${service}`,
        advice:  "Manual intervention required",
      });
    }

    return res.json({
      success:  true,
      service,
      fallback,
      message:  `${service} degraded to ${fallback} — monitoring recovery`,
    });
  })
);

// Mark service recovered
app.post("/reliability/recover/:service", requireAuth,
  requireRole("admin","cto","super_admin"),
  asyncHandler(async (req, res) => {
    await pool.query(
      "UPDATE degradation_events SET resolved_at=NOW() WHERE service=$1 AND resolved_at IS NULL",
      [req.params.service]
    );
    return res.json({ success: true, service: req.params.service, status: "RECOVERED" });
  })
);

// ================================================================
// SECTION C — WEBHOOK DOUBLE-VERIFICATION (93.8, 93.9)
// ================================================================

// Verify webhook before crediting — NEVER trust payload alone
app.post("/reliability/verify-webhook", requireAuth,
  asyncHandler(async (req, res) => {
    const { provider, reference, webhook_data } = req.body;

    if (!provider || !reference) {
      return res.status(400).json({
        success: false,
        error:   "provider and reference required",
      });
    }

    const result = await verifyWebhookWithProvider(provider, reference, webhook_data || {});

    if (result.replayed) {
      return res.json({
        success:  true,
        verified: result.verified,
        replayed: true,
        message:  "Idempotent: webhook already processed",
      });
    }

    if (!result.verified) {
      logger.error("WEBHOOK VERIFICATION FAILED", { provider, reference, result });
      return res.json({
        success:  true,
        verified: false,
        reason:   "Provider verification returned non-success status",
        result,
      });
    }

    return res.json({
      success:          true,
      verified:         true,
      verified_amount:  result.verified_amount,
      verified_status:  result.verified_status,
      provider,
      reference,
    });
  })
);

// ================================================================
// SECTION D — ANTI-REPLAY NONCE VALIDATION (93.10)
// ================================================================

app.post("/reliability/validate-nonce", asyncHandler(async (req, res) => {
  const { nonce, service } = req.body;
  if (!nonce || !service) {
    return res.status(400).json({ success: false, error: "nonce and service required" });
  }

  const result = await validateNonce(nonce, service);
  return res.json({ success: true, ...result });
}));

// ================================================================
// SECTION E — COST GOVERNANCE AI (93.5)
// ================================================================

app.get("/reliability/costs", requireAuth,
  requireRole("admin","cto","super_admin"),
  asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;
    const report = await analyzeCosts(parseInt(days));

    return res.json({
      success: true,
      report,
      ceo_summary: {
        total_spend_ngn: report.costs.estimated_total,
        total_spend_usd: report.costs.estimated_usd,
        payment_volume:  report.volume.payment_vol_ngn,
        infrastructure_as_pct_of_volume:
          report.volume.payment_vol_ngn > 0
            ? ((report.costs.estimated_total / report.volume.payment_vol_ngn) * 100).toFixed(2) + "%"
            : "N/A",
        top_recommendation: report.recommendations[0] || "No cost optimisations needed",
      },
    });
  })
);

// ================================================================
// SECTION F — TRAFFIC SURGE DETECTION (93.16)
// ================================================================

app.get("/reliability/traffic-surge", requireAuth,
  asyncHandler(async (req, res) => {
    const { window_mins = 5 } = req.query;
    const result = await detectTrafficSurge(parseInt(window_mins));

    if (result.surge_detected) {
      logger.warn("TRAFFIC SURGE DETECTED", result);
    }

    return res.json({ success: true, ...result });
  })
);

// ================================================================
// SECTION G — AI INCIDENT COMMANDER (93.3)
// ================================================================

app.post("/reliability/incident-commander", requireAuth,
  requireRole("admin","cto","super_admin","cybersecurity_officer"),
  asyncHandler(async (req, res) => {
    const { incident_type, affected_service, metrics } = req.body;

    // Classify severity
    let severity = "low";
    const CRITICAL_SERVICES  = ["payment","wallet","escrow","order","auth"];
    const HIGH_SERVICES       = ["thrift","logistics","fraud","kyc"];

    if (CRITICAL_SERVICES.includes(affected_service))  severity = "critical";
    else if (HIGH_SERVICES.includes(affected_service)) severity = "high";

    // AI recommendations based on incident type
    const recommendations = [];
    const rollback_options = [];

    if (incident_type === "high_error_rate") {
      recommendations.push("1. Check service logs: tail -f logs/${affected_service}.log");
      recommendations.push("2. Verify database connection pool");
      recommendations.push("3. Check Redis connectivity");
      recommendations.push("4. Consider rolling restart");
      rollback_options.push("docker-compose restart " + affected_service);
    }

    if (incident_type === "high_latency") {
      recommendations.push("1. Check DB slow query log");
      recommendations.push("2. Check Redis cache hit rate");
      recommendations.push("3. Enable circuit breaker");
      recommendations.push("4. Scale horizontally if CPU > 80%");
    }

    if (incident_type === "payment_failure") {
      recommendations.push("1. Check Paystack status: status.paystack.com");
      recommendations.push("2. Verify PAYSTACK_SECRET_KEY is valid");
      recommendations.push("3. Check webhook_log for processing errors");
      recommendations.push("4. Run reconciliation to catch missed payments");
      recommendations.push("5. Enable Stripe as fallback if Paystack down");
    }

    if (incident_type === "fraud_spike") {
      recommendations.push("1. Check IP blocklist — add attacker IPs");
      recommendations.push("2. Increase fraud thresholds temporarily");
      recommendations.push("3. Enable maintenance mode if systemic");
      recommendations.push("4. Notify cybersecurity officer immediately");
    }

    // Determine if CTO approval needed
    const cto_approval_required = severity === "critical" ||
                                   incident_type === "rollback" ||
                                   incident_type === "maintenance_mode";

    return res.json({
      success: true,
      incident: { type: incident_type, service: affected_service, severity },
      ai_assessment: {
        severity,
        estimated_user_impact:   severity === "critical" ? "HIGH" : severity === "high" ? "MEDIUM" : "LOW",
        estimated_revenue_impact:CRITICAL_SERVICES.includes(affected_service) ? "SIGNIFICANT" : "MINIMAL",
        cto_approval_required,
      },
      recommendations,
      rollback_options,
      runbook: `https://docs.dunazoe.com/runbooks/${incident_type}`,
      generated_at: new Date().toISOString(),
    });
  })
);

// ================================================================
// SECTION H — CHAOS ENGINEERING (93.7)
// ================================================================

app.post("/reliability/chaos", requireAuth,
  requireRole("cto","super_admin"),
  asyncHandler(async (req, res) => {
    const { target, chaos_type, duration_secs = 30 } = req.body;

    if (process.env.NODE_ENV === "production" && !req.body.confirm_production) {
      return res.status(400).json({
        success: false,
        error:   "Chaos engineering is disabled in production without explicit confirmation",
        hint:    "Add confirm_production: true to enable (NOT RECOMMENDED)",
      });
    }

    const result = await injectChaos(target, chaos_type, duration_secs);
    return res.json({ success: true, ...result });
  })
);

// ================================================================
// SECTION I — SSL CERTIFICATE MONITORING (93.13)
// ================================================================

app.get("/reliability/ssl", requireAuth,
  requireRole("admin","cto","cybersecurity_officer"),
  asyncHandler(async (req, res) => {
    const domains = [
      "dunazoe.com",
      "api.dunazoe.com",
      "app.dunazoe.com",
    ];

    const results = await Promise.all(domains.map(d => checkSSLCertificate(d)));
    const critical = results.filter(r => r.critical);
    const warnings  = results.filter(r => r.warning && !r.critical);

    return res.json({
      success:  true,
      domains:  results,
      critical: critical.length,
      warnings: warnings.length,
      all_valid: critical.length === 0,
      action_required: critical.length > 0
        ? `URGENT: Renew SSL for: ${critical.map(r=>r.hostname).join(", ")}`
        : null,
    });
  })
);

// ================================================================
// SECTION J — PLATFORM STATUS DASHBOARD (CEO/CTO VIEW)
// ================================================================

app.get("/reliability/status-dashboard", requireAuth,
  asyncHandler(async (req, res) => {
    const [health, surge, degradation, recent_incidents] = await Promise.all([
      aggregateHealthChecks(),
      detectTrafficSurge(15),
      pool.query("SELECT COUNT(*) c FROM degradation_events WHERE resolved_at IS NULL"),
      pool.query(
        `SELECT event_type, severity, COUNT(*) count
         FROM security_events
         WHERE created_at > NOW() - INTERVAL '24 hours'
         AND severity IN ('critical','high')
         GROUP BY event_type, severity ORDER BY count DESC LIMIT 5`
      ),
    ]);

    const platform_status =
      health.overall === "critical" ? "🔴 CRITICAL" :
      health.overall === "degraded" ? "🟡 DEGRADED" : "🟢 OPERATIONAL";

    return res.json({
      success: true,
      platform_status,
      ceo_view: {
        headline:         platform_status,
        services_healthy: `${health.healthy}/${health.total}`,
        availability:     `${health.availability_pct}%`,
        active_degradations: parseInt(degradation.rows[0].c),
        traffic_status:   surge.surge_detected ? "🔴 SURGE DETECTED" : "🟢 Normal",
        security_incidents_24h: recent_incidents.rows.length,
      },
      cto_view: {
        services:         health.services,
        degradations:     degradation.rows[0].c,
        traffic_ratio:    surge.ratio,
        surge_recommendation: surge.recommendation,
        security_events:  recent_incidents.rows,
      },
      checked_at: new Date().toISOString(),
    });
  })
);

// ================================================================
// SECTION K — DEPENDENCY SECURITY SCANNER (93.14)
// ================================================================

app.get("/reliability/dependencies", requireAuth,
  requireRole("cto","super_admin","cybersecurity_officer"),
  asyncHandler(async (req, res) => {
    const fs   = require("fs");
    const path = require("path");

    const services = [
      "auth","user","vendor","product","inventory","order","escrow",
      "fraud","wallet","thrift","trust","loan","commission","ai",
      "payment","dispute","notification","logistics","feature-flag",
      "upload","realtime","search","kyc","reconciliation",
    ];

    const report = [];

    for (const svc of services) {
      const pkg_path = path.join(process.cwd(), "services", `${svc}-service`, "package.json");
      if (!fs.existsSync(pkg_path)) continue;

      const pkg  = JSON.parse(fs.readFileSync(pkg_path, "utf-8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Flag known vulnerable patterns (simplified — in prod use Snyk/npm audit)
      const flagged = Object.entries(deps).filter(([name]) =>
        name.includes("event-stream") || // historical supply chain attack
        name.includes("flatmap-stream")
      );

      report.push({
        service:     svc,
        dep_count:   Object.keys(deps).length,
        flagged:     flagged.length,
        flagged_pkgs:flagged.map(([n,v]) => `${n}@${v}`),
      });
    }

    const total_flagged = report.reduce((s,r) => s + r.flagged, 0);

    return res.json({
      success:       true,
      total_services:report.length,
      total_flagged,
      report,
      recommendation: total_flagged > 0
        ? "Run `npm audit fix` in flagged services"
        : "No known supply-chain risks detected",
      generated_at:  new Date().toISOString(),
    });
  })
);

// ── BACKGROUND MONITOR (runs every 2 minutes) ─────────────────
async function backgroundMonitor() {
  try {
    const health = await aggregateHealthChecks();
    const surge  = await detectTrafficSurge(5);

    if (health.overall === "critical") {
      logger.error("PLATFORM CRITICAL", {
        healthy:health.healthy, total:health.total,
        down: Object.entries(health.services)
               .filter(([,v])=>v.status==="down").map(([k])=>k),
      });
    }

    if (surge.surge_detected) {
      logger.warn("TRAFFIC SURGE", surge);
    }
  } catch (e) {
    logger.error("Background monitor error:", e.message);
  }
}

initReliabilitySchema()
  .then(() => {
    setInterval(backgroundMonitor, 120000); // every 2 minutes
    logger.info("Background reliability monitor started ✓");
  })
  .catch(console.error);

app.use(errorHandler);
app.listen(PORT, () => {
  logger.info(`✅ Reliability Service (Update #93) running on port ${PORT}`);
  logger.info("   Monitoring: health, costs, traffic, security, chaos, SSL");
});
module.exports = app;
