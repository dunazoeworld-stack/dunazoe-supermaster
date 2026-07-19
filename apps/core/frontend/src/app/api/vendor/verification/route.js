import { NextResponse } from "next/server";
const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";

export async function GET(req) {
  const token = req.headers.get("Authorization") || "";
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`${GATEWAY}/vendor/verification`, {
      headers: { Authorization: token }, signal: ctrl.signal,
    });
    clearTimeout(timer);
    const d = await res.json();
    return NextResponse.json(d, { status: res.status });
  } catch (_) {
    return NextResponse.json({ kyc_verified: false, delivery_vendor_approved: false, delivery_vendor_requested: false, offline: true });
  }
}
