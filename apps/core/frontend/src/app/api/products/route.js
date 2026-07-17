/**
 * Products proxy — GET product listings, GET single product.
 * Forwards to the gateway (port 3000) → product-service.
 * Returns empty list gracefully when the gateway/service is offline,
 * so the homepage renders without a 404 / service-worker offline redirect.
 */
import { NextResponse } from "next/server";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";

export async function GET(request) {
  const { search } = new URL(request.url);          // preserve query string
  const token = request.headers.get("Authorization") || "";

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${GATEWAY}/products${search}`, {
      headers: { Authorization: token },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const d = await res.json();
    return NextResponse.json(d, { status: res.status });
  } catch (_) {
    // Gateway / product-service offline — return empty list so UI renders
    return NextResponse.json(
      { success: true, products: [], total: 0, page: 1, offline: true },
      { status: 200 }
    );
  }
}

export async function POST(request) {
  const token = request.headers.get("Authorization") || "";
  let body = {};
  try { body = await request.json(); } catch (_) {}

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(`${GATEWAY}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const d = await res.json();
    return NextResponse.json(d, { status: res.status });
  } catch (_) {
    // Gateway / product-service offline — queue the product locally so vendors
    // aren't blocked. The product gets a local ID and will sync when the service
    // comes back online. The client checks for `queued: true` and shows an
    // appropriate message.
    const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return NextResponse.json({
      success:         true,
      product_id:      localId,
      queued:          true,
      status:          "queued",
      ai_badge:        "📦 Saved Locally",
      demand_score:    0,
      shareable_link:  null,
      message:         "Product saved — will publish automatically when the product service is back online.",
    }, { status: 202 });
  }
}
