/**
 * DUNAZOE — Wallet Deposit API Route
 * Proxies to the gateway wallet service.
 */
import { NextResponse } from "next/server";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";

export async function POST(req) {
  const token = req.headers.get("Authorization") || "";
  let body = {};
  try { body = await req.json(); } catch (_) {}

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(`${GATEWAY}/wallet/deposit`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body:    JSON.stringify(body),
      signal:  ctrl.signal,
    });
    clearTimeout(timer);
    const d = await res.json();
    return NextResponse.json(d, { status: res.status });
  } catch (err) {
    console.error("[wallet/deposit] Gateway error:", err.message);
    return NextResponse.json({
      success: false,
      error:   "Payment gateway is temporarily unavailable. Please try again shortly.",
      gateway_down: true,
    }, { status: 503 });
  }
}
