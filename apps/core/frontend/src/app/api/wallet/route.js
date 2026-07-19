/**
 * DUNAZOE — Wallet Balance API Route
 * Proxies to the gateway wallet service.
 */
import { NextResponse } from "next/server";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";

export async function GET(req) {
  const token  = req.headers.get("Authorization") || "";
  const search = new URL(req.url).search;
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${GATEWAY}/wallet${search}`, {
      headers: { Authorization: token },
      signal:  ctrl.signal,
    });
    clearTimeout(timer);
    const d = await res.json();
    return NextResponse.json(d, { status: res.status });
  } catch (_) {
    return NextResponse.json({ success: true, balance: 0, offline: true }, { status: 200 });
  }
}

export async function POST(req) {
  const token = req.headers.get("Authorization") || "";
  let body = {};
  try { body = await req.json(); } catch (_) {}

  const search = new URL(req.url).search;
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(`${GATEWAY}/wallet${search}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body:    JSON.stringify(body),
      signal:  ctrl.signal,
    });
    clearTimeout(timer);
    const d = await res.json();
    return NextResponse.json(d, { status: res.status });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error:   "Wallet service temporarily unavailable.",
    }, { status: 503 });
  }
}
