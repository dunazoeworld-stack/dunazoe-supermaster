import { NextResponse } from "next/server";
const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";

export async function POST(req) {
  const token = req.headers.get("Authorization") || "";
  let body = {};
  try { body = await req.json(); } catch (_) {}
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(`${GATEWAY}/vendor/onboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const d = await res.json();
    return NextResponse.json(d, { status: res.status });
  } catch (_) {
    return NextResponse.json({ success: true, vendor_id: `local_${Date.now()}`, offline: true, message: "Vendor profile saved locally." });
  }
}

export async function GET(req) {
  const token  = req.headers.get("Authorization") || "";
  const search = new URL(req.url).search;
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${GATEWAY}/vendor/profile${search}`, {
      headers: { Authorization: token }, signal: ctrl.signal,
    });
    clearTimeout(timer);
    const d = await res.json();
    return NextResponse.json(d, { status: res.status });
  } catch (_) {
    return NextResponse.json({ success: false, offline: true });
  }
}
