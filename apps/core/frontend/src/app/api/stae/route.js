/**
 * DUNAZOE — STAE (Scaling-Triggered Activation Engine) API
 * /api/stae — operator-only endpoint
 *
 * Requires valid JWT with role admin | super_admin | coordinator
 */
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  console.error("[stae] FATAL: JWT_SECRET / SESSION_SECRET not set.");
}

// ─── In-memory STAE state (persists across requests in single-container mode) ─
let STAE = {
  mode: "normal",
  surgeActive: false,
  queueProtection: false,
  frozenWorkloads: [],
  lastAction: null,
  lastActionTime: null,
  log: [],
};

const SERVICES = [
  { name: "order-service",       port: 4005, critical: true  },
  { name: "payment-service",     port: 4006, critical: true  },
  { name: "inventory-service",   port: 4004, critical: true  },
  { name: "auth-service",        port: 4001, critical: true  },
  { name: "wallet-service",      port: 4009, critical: true  },
  { name: "notification-service",port: 4010, critical: false },
  { name: "search-service",      port: 4017, critical: false },
  { name: "social-media-service",port: 4022, critical: false },
];
const NONCRITICAL = SERVICES.filter(s => !s.critical).map(s => s.name);

function nowISO() { return new Date().toISOString(); }

function logAction(operator, action, target, result) {
  const entry = { ts: nowISO(), operator: operator || "unknown", action, target, result, mode: STAE.mode };
  STAE.log.unshift(entry);
  if (STAE.log.length > 50) STAE.log.pop();
  STAE.lastAction = action;
  STAE.lastActionTime = entry.ts;
  return entry;
}

function verifyOperator(req) {
  if (!JWT_SECRET) return null;
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!["admin", "super_admin", "coordinator"].includes(decoded.role)) return null;
    return decoded;
  } catch { return null; }
}

async function checkHealth(port) {
  try {
    const r = await fetch(`http://localhost:${port}/health`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch { return false; }
}

// ─── GET — state + health ──────────────────────────────────────────────────
export async function GET(req) {
  const user = verifyOperator(req);
  if (!user) return NextResponse.json({ success: false, error: "Operator access required." }, { status: 401 });

  const serviceHealth = await Promise.all(
    SERVICES.map(async s => ({ ...s, healthy: await checkHealth(s.port) }))
  );
  const criticalDown = serviceHealth.filter(s => s.critical && !s.healthy);
  const recommendations = [];
  if (criticalDown.length >= 2 && STAE.mode === "normal") {
    recommendations.push({ action: "activate_surge_mode", reason: `${criticalDown.length} critical services unreachable`, priority: "HIGH" });
  }
  if (STAE.mode === "surge" && serviceHealth.every(s => s.healthy)) {
    recommendations.push({ action: "normalize", reason: "All services healthy — surge mode can be safely deactivated", priority: "MEDIUM" });
  }

  return NextResponse.json({
    success: true,
    state: STAE,
    services: serviceHealth,
    recommendations,
    deploymentMode: "MANAGED_SIMULATION",
    deploymentNote: "Running on Replit single-container. Scaling controls manage internal throttles — not cloud autoscaling resources.",
    recentLog: STAE.log.slice(0, 20),
  });
}

// ─── POST — trigger actions ────────────────────────────────────────────────
export async function POST(req) {
  const user = verifyOperator(req);
  if (!user) return NextResponse.json({ success: false, error: "Operator access required." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action, target } = body;
  const operator = user.email || user.id || "operator";

  let entry;

  switch (action) {
    case "health_check": {
      const serviceHealth = await Promise.all(SERVICES.map(async s => ({ ...s, healthy: await checkHealth(s.port) })));
      const issues = serviceHealth.filter(s => s.critical && !s.healthy).map(s => `${s.name} unreachable`);
      entry = logAction(operator, "HEALTH_CHECK", "stae", issues.length === 0 ? "✅ STAE healthy" : `⚠️ ${issues.join("; ")}`);
      return NextResponse.json({ success: true, healthy: issues.length === 0, issues, ...entry });
    }

    case "activate_surge": {
      STAE.mode = "surge";
      STAE.surgeActive = true;
      STAE.queueProtection = true;
      entry = logAction(operator, "ACTIVATE_SURGE_MODE", "platform", "✅ Surge mode ON — queue protection enabled, noncritical workloads throttled");
      return NextResponse.json({ success: true, ...entry, note: "MANAGED_SIMULATION: Internal rate limiter set to SURGE mode." });
    }

    case "deactivate_surge": {
      STAE.mode = "normal";
      STAE.surgeActive = false;
      STAE.queueProtection = false;
      STAE.frozenWorkloads = [];
      entry = logAction(operator, "DEACTIVATE_SURGE_MODE", "platform", "✅ Normal mode restored");
      return NextResponse.json({ success: true, ...entry, note: "MANAGED_SIMULATION: Throttle limits restored to normal." });
    }

    case "scale_up": {
      const svc = SERVICES.find(s => s.name === target);
      if (!svc) return NextResponse.json({ success: false, error: `Unknown service: ${target}` }, { status: 400 });
      entry = logAction(operator, "SCALE_UP", target, `✅ Scale-up signal sent to ${target}`);
      return NextResponse.json({ success: true, ...entry, note: `MANAGED_SIMULATION: Scale-up recorded for ${target}. On cloud, this would add replicas.` });
    }

    case "scale_down": {
      const svc = SERVICES.find(s => s.name === target);
      if (!svc) return NextResponse.json({ success: false, error: `Unknown service: ${target}` }, { status: 400 });
      if (svc.critical && STAE.mode !== "normal") {
        return NextResponse.json({ success: false, error: `Cannot scale down critical service ${target} in ${STAE.mode} mode.` }, { status: 400 });
      }
      entry = logAction(operator, "SCALE_DOWN", target, `✅ Scale-down signal sent to ${target}`);
      return NextResponse.json({ success: true, ...entry, note: `MANAGED_SIMULATION: Scale-down recorded for ${target}.` });
    }

    case "activate_surge_mode": return NextResponse.json(await handleAction("activate_surge", operator));

    case "pause_noncritical": {
      STAE.frozenWorkloads = [...NONCRITICAL];
      if (STAE.mode === "normal") STAE.mode = "degraded";
      entry = logAction(operator, "PAUSE_NONCRITICAL", NONCRITICAL.join(", "), `✅ Paused: ${NONCRITICAL.join(", ")}`);
      return NextResponse.json({ success: true, ...entry, frozen: STAE.frozenWorkloads, note: "MANAGED_SIMULATION: Noncritical services flagged for throttling." });
    }

    case "resume_all": {
      STAE.frozenWorkloads = [];
      STAE.mode = "normal";
      STAE.surgeActive = false;
      STAE.queueProtection = false;
      entry = logAction(operator, "RESUME_ALL", "platform", "✅ All workloads resumed — platform normalized");
      return NextResponse.json({ success: true, ...entry, note: "MANAGED_SIMULATION: All throttle limits lifted." });
    }

    case "enable_queue_protection": {
      STAE.queueProtection = true;
      entry = logAction(operator, "ENABLE_QUEUE_PROTECTION", "queue", "✅ Queue protection enabled");
      return NextResponse.json({ success: true, ...entry });
    }

    case "disable_queue_protection": {
      STAE.queueProtection = false;
      entry = logAction(operator, "DISABLE_QUEUE_PROTECTION", "queue", "✅ Queue protection disabled");
      return NextResponse.json({ success: true, ...entry });
    }

    default:
      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  }
}
