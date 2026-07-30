/**
 * DUNAZOE — Health Check API
 * GET /api/health — quick liveness probe (no auth required)
 */
import { NextResponse } from "next/server";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";

export async function GET() {
  let gatewayStatus = "unknown";
  let gatewayMs     = null;

  try {
    const t0  = Date.now();
    const res = await fetch(`${GATEWAY}/health`, { signal: AbortSignal.timeout(3000) });
    gatewayMs = Date.now() - t0;
    gatewayStatus = res.ok ? "ok" : "degraded";
  } catch (_) {
    gatewayStatus = "offline";
  }

  return NextResponse.json({
    status:    "ok",
    service:   "dunazoe-frontend",
    version:   "1.0.0-rc1",
    gateway:   { status: gatewayStatus, latency_ms: gatewayMs },
    timestamp: new Date().toISOString(),
  });
}
