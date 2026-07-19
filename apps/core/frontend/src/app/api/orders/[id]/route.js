import { NextResponse } from "next/server";
const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";

export async function GET(req, { params }) {
  const token = req.headers.get("Authorization") || "";
  const { id } = params;
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${GATEWAY}/orders/${id}`, {
      headers: { Authorization: token }, signal: ctrl.signal,
    });
    clearTimeout(timer);
    const d = await res.json();
    return NextResponse.json(d, { status: res.status });
  } catch (_) {
    return NextResponse.json({ success: false, error: "Order not found or service offline", offline: true }, { status: 404 });
  }
}

export async function PATCH(req, { params }) {
  const token = req.headers.get("Authorization") || "";
  const { id } = params;
  let body = {};
  try { body = await req.json(); } catch (_) {}
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(`${GATEWAY}/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const d = await res.json();
    return NextResponse.json(d, { status: res.status });
  } catch (_) {
    return NextResponse.json({ success: false, error: "Service offline" }, { status: 503 });
  }
}
