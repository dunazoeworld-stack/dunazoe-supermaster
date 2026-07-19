import { NextResponse } from "next/server";
const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";

export async function GET(req) {
  const token  = req.headers.get("Authorization") || "";
  const search = new URL(req.url).search;
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${GATEWAY}/vendor/stats${search}`, {
      headers: { Authorization: token }, signal: ctrl.signal,
    });
    clearTimeout(timer);
    const d = await res.json();
    return NextResponse.json(d, { status: res.status });
  } catch (_) {
    return NextResponse.json({ success: true, stats: { total_products: 0, total_orders: 0, total_revenue: 0, rating: 0 }, offline: true });
  }
}
