/**
 * DUNAZOE — Single dispute proxy
 * GET/PUT/POST /api/disputes/:id
 */
import { NextResponse } from "next/server";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";

async function proxy(req, { params }) {
  const id    = (await params).id;
  const token = req.headers.get("Authorization") || "";
  const opts  = { method: req.method, headers: { Authorization: token } };

  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    opts.headers["Content-Type"] = "application/json";
    try { opts.body = JSON.stringify(await req.json()); } catch (_) {}
  }

  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 10000);
    const res  = await fetch(`${GATEWAY}/disputes/${id}`, { ...opts, signal: ctrl.signal });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (_) {
    return NextResponse.json({ success: false, error: "Disputes service unavailable." }, { status: 503 });
  }
}

export const GET  = proxy;
export const POST = proxy;
export const PUT  = proxy;
