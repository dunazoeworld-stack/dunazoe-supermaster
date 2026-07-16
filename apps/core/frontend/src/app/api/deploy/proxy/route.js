/**
 * DUNAZOE — /api/deploy/proxy
 * Generic reverse-proxy to deployment-ai-service (port 4027).
 * Usage: POST /api/deploy/proxy?path=/deployment/audit
 *        GET  /api/deploy/proxy?path=/deployment/status
 */
import { NextResponse } from "next/server";

const DEPLOY_SERVICE = process.env.DEPLOY_SERVICE_URL || "http://localhost:4027";

export const dynamic = "force-dynamic";

async function proxyRequest(request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path") || "/deployment/status";

  // Whitelist allowed paths
  const ALLOWED = [
    "/deployment/status",
    "/deployment/audit",
    "/deployment/monitor",
    "/deployment/rollback",
    "/deployment/github",
    "/deployment/self/backup",
    "/deployment/github/push/pull",
    "/health",
  ];
  if (!ALLOWED.some(a => path.startsWith(a))) {
    return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
  }

  const upstream = `${DEPLOY_SERVICE}${path}`;
  const headers  = { "Content-Type": "application/json" };

  // Forward Authorization header if present
  const auth = request.headers.get("authorization");
  if (auth) headers["Authorization"] = auth;

  try {
    let body;
    if (request.method !== "GET") {
      try { body = await request.text(); } catch (_) {}
    }

    const resp = await fetch(upstream, {
      method:  request.method,
      headers,
      body:    body || undefined,
      signal:  AbortSignal.timeout(15000),
    });

    const data = await resp.json().catch(() => ({ error: "Non-JSON response from service" }));
    return NextResponse.json(data, { status: resp.status });
  } catch (err) {
    // Service offline — return a useful mock so the phone app doesn't crash
    if (path === "/deployment/status") {
      return NextResponse.json({
        ok: false, offline: true,
        message: "Deployment-AI service is offline (port 4027). Start it to enable remote control.",
        platform: { status: "unknown", services: 34, version: "2.0.0" },
      }, { status: 200 });
    }
    return NextResponse.json({ ok: false, error: err.message, offline: true }, { status: 503 });
  }
}

export async function GET(request)    { return proxyRequest(request); }
export async function POST(request)   { return proxyRequest(request); }
export async function DELETE(request) { return proxyRequest(request); }
