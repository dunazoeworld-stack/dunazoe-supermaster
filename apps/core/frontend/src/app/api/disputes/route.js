/**
 * DUNAZOE — Disputes API proxy
 * GET  /api/disputes        — list user disputes
 * POST /api/disputes        — raise new dispute
 * PUT  /api/disputes/:id    — update / respond
 */
import { NextResponse } from "next/server";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";

async function proxy(req) {
  const token = req.headers.get("Authorization") || "";
  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();

  const opts = { method: req.method, headers: { Authorization: token } };
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    opts.headers["Content-Type"] = "application/json";
    try { opts.body = JSON.stringify(await req.json()); } catch (_) {}
  }

  try {
    const ctrl  = new AbortController();
    setTimeout(() => ctrl.abort(), 10000);
    const url   = `${GATEWAY}/disputes${qs ? "?" + qs : ""}`;
    const res   = await fetch(url, { ...opts, signal: ctrl.signal });
    const data  = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Disputes service temporarily unavailable.", disputes: [] },
      { status: 503 }
    );
  }
}

export const GET  = proxy;
export const POST = proxy;
export const PUT  = proxy;
