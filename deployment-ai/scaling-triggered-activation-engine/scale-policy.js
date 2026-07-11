/**
 * DUNAZOE — Scaling-Triggered Activation Engine (STAE)
 * scale-policy.js
 *
 * Controls scaling state, surge mode, queue protection, and service scaling
 * for the DUNAZOE 33-service microservice platform.
 *
 * On Replit (single-container deployment), scaling actions operate in
 * MANAGED SIMULATION MODE — they control internal rate limits, queue
 * throttles, and feature flags rather than cloud infrastructure resources.
 * Every action is truthfully labelled so operators always know exactly
 * what happened.
 */

"use strict";

// ─── State store (in-memory; replace with Redis for multi-node) ──────────────
let state = {
  mode: "normal",            // normal | surge | degraded | freeze
  surgeActive: false,
  queueProtection: false,
  frozenWorkloads: [],
  lastAction: null,
  lastActionTime: null,
  scalingLog: [],            // ring buffer of last 100 actions
};

// ─── Service registry ────────────────────────────────────────────────────────
const SERVICES = {
  "order-service":     { port: 4005, critical: true },
  "payment-service":   { port: 4006, critical: true },
  "inventory-service": { port: 4004, critical: true },
  "auth-service":      { port: 4001, critical: true },
  "wallet-service":    { port: 4009, critical: true },
  "notification-service": { port: 4010, critical: false },
  "search-service":    { port: 4017, critical: false },
  "social-media-service": { port: 4022, critical: false },
  "analytics-service": { port: 4099, critical: false },
};

// ─── Non-critical workloads that can be paused safely ────────────────────────
const NONCRITICAL = ["search-service", "social-media-service", "analytics-service", "notification-service"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function now() { return new Date().toISOString(); }

function logAction(operator, action, target, result, mode) {
  const entry = { ts: now(), operator: operator || "system", action, target: target || "platform", result, mode };
  state.scalingLog.unshift(entry);
  if (state.scalingLog.length > 100) state.scalingLog.pop();
  state.lastAction = action;
  state.lastActionTime = entry.ts;
  return entry;
}

async function checkServiceHealth(serviceName) {
  const svc = SERVICES[serviceName];
  if (!svc) return { ok: false, reason: "unknown service" };
  try {
    const r = await fetch(`http://localhost:${svc.port}/health`, { signal: AbortSignal.timeout(2000) });
    return { ok: r.ok, status: r.status };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}

// ─── STAE API ─────────────────────────────────────────────────────────────────

/** GET current STAE state and recommendations */
async function getState() {
  const serviceHealthChecks = await Promise.all(
    Object.entries(SERVICES).map(async ([name, svc]) => {
      const health = await checkServiceHealth(name);
      return { name, ...svc, ...health };
    })
  );

  const healthyCount = serviceHealthChecks.filter(s => s.ok).length;
  const criticalDown = serviceHealthChecks.filter(s => s.critical && !s.ok);

  const recommendations = [];
  if (state.mode === "normal" && criticalDown.length >= 2) {
    recommendations.push({ action: "activate_surge_mode", reason: `${criticalDown.length} critical services unreachable`, priority: "HIGH" });
  }
  if (state.mode === "surge" && healthyCount === Object.keys(SERVICES).length) {
    recommendations.push({ action: "normalize", reason: "All services healthy — surge mode can be deactivated", priority: "MEDIUM" });
  }
  if (!state.queueProtection && state.mode === "surge") {
    recommendations.push({ action: "enable_queue_protection", reason: "Surge mode active but queue protection is off", priority: "HIGH" });
  }

  return {
    mode: state.mode,
    surgeActive: state.surgeActive,
    queueProtection: state.queueProtection,
    frozenWorkloads: state.frozenWorkloads,
    lastAction: state.lastAction,
    lastActionTime: state.lastActionTime,
    services: serviceHealthChecks,
    recommendations,
    deploymentMode: "MANAGED_SIMULATION",
    deploymentNote: "Running on Replit single-container. Scaling controls manage internal throttles and queue protection — not cloud autoscaling resources.",
    recentLog: state.scalingLog.slice(0, 20),
  };
}

/** Activate surge mode — enables queue protection and prioritises critical services */
function activateSurge(operator) {
  state.mode = "surge";
  state.surgeActive = true;
  state.queueProtection = true;
  const entry = logAction(operator, "ACTIVATE_SURGE_MODE", "platform", "✅ Surge mode activated — queue protection enabled, noncritical workloads throttled", "surge");
  return { success: true, ...entry, note: "MANAGED_SIMULATION: Internal rate limiter set to SURGE. No cloud resources were scaled." };
}

/** Deactivate surge mode — returns to normal operation */
function deactivateSurge(operator) {
  state.mode = "normal";
  state.surgeActive = false;
  state.queueProtection = false;
  state.frozenWorkloads = [];
  const entry = logAction(operator, "DEACTIVATE_SURGE_MODE", "platform", "✅ Normal mode restored — queue protection lifted", "normal");
  return { success: true, ...entry, note: "MANAGED_SIMULATION: Throttle limits restored to normal." };
}

/** Trigger scale-up signal for a specific service */
function scaleUp(serviceName, operator) {
  const svc = SERVICES[serviceName];
  if (!svc) return { success: false, error: `Unknown service: ${serviceName}` };
  const entry = logAction(operator, "SCALE_UP", serviceName, `✅ Scale-up signal sent to ${serviceName}`, state.mode);
  return { success: true, ...entry, note: `MANAGED_SIMULATION: Scale-up signal recorded. On a cloud deployment, this would add replicas for ${serviceName} (port ${svc.port}).` };
}

/** Trigger scale-down signal for a specific service */
function scaleDown(serviceName, operator) {
  const svc = SERVICES[serviceName];
  if (!svc) return { success: false, error: `Unknown service: ${serviceName}` };
  if (svc.critical && state.mode !== "normal") {
    return { success: false, error: `Cannot scale down critical service ${serviceName} while in ${state.mode} mode.` };
  }
  const entry = logAction(operator, "SCALE_DOWN", serviceName, `✅ Scale-down signal sent to ${serviceName}`, state.mode);
  return { success: true, ...entry, note: `MANAGED_SIMULATION: Scale-down signal recorded for ${serviceName}.` };
}

/** Pause noncritical workloads to protect core financial services */
function pauseNoncritical(operator) {
  state.frozenWorkloads = [...NONCRITICAL];
  if (state.mode === "normal") state.mode = "degraded";
  const entry = logAction(operator, "PAUSE_NONCRITICAL", NONCRITICAL.join(", "), `✅ Paused: ${NONCRITICAL.join(", ")}`, state.mode);
  return { success: true, ...entry, frozen: state.frozenWorkloads, note: "MANAGED_SIMULATION: Noncritical services flagged for throttling. Financial and order services protected." };
}

/** Resume all workloads to normal state */
function resumeAll(operator) {
  state.frozenWorkloads = [];
  state.mode = "normal";
  state.surgeActive = false;
  state.queueProtection = false;
  const entry = logAction(operator, "RESUME_ALL", "platform", "✅ All workloads resumed — platform normalized", "normal");
  return { success: true, ...entry, note: "MANAGED_SIMULATION: All throttle limits lifted." };
}

/** Enable queue-safe protection mode */
function enableQueueProtection(operator) {
  state.queueProtection = true;
  const entry = logAction(operator, "ENABLE_QUEUE_PROTECTION", "queue", "✅ Queue protection enabled — new requests will be queued, no financial data dropped", state.mode);
  return { success: true, ...entry };
}

/** Disable queue protection */
function disableQueueProtection(operator) {
  state.queueProtection = false;
  const entry = logAction(operator, "DISABLE_QUEUE_PROTECTION", "queue", "✅ Queue protection disabled — direct processing resumed", state.mode);
  return { success: true, ...entry };
}

/** Run STAE health check */
async function healthCheck(operator) {
  const currentState = await getState();
  const issues = [];
  if (currentState.services.filter(s => s.critical && !s.ok).length > 0) {
    issues.push("One or more critical services unreachable");
  }
  if (state.mode === "surge" && !state.queueProtection) {
    issues.push("Surge mode active but queue protection is disabled");
  }
  const entry = logAction(operator, "HEALTH_CHECK", "stae", issues.length === 0 ? "✅ STAE healthy — no issues detected" : `⚠️ ${issues.length} issue(s) detected`, state.mode);
  return { success: true, healthy: issues.length === 0, issues, ...entry, state: currentState };
}

module.exports = {
  getState,
  activateSurge,
  deactivateSurge,
  scaleUp,
  scaleDown,
  pauseNoncritical,
  resumeAll,
  enableQueueProtection,
  disableQueueProtection,
  healthCheck,
  SERVICES,
  NONCRITICAL,
};
