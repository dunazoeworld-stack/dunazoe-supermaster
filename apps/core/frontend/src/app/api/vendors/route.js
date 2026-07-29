/**
 * DUNAZOE — Vendors API Route
 * GET /api/vendors — list vendors (proxies gateway, falls back to local store)
 */
import { NextResponse } from "next/server";
import { Pool } from "pg";

const GATEWAY    = process.env.GATEWAY_URL || "http://localhost:3000";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.DATABASE_URL || "").includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : false,
});

export async function GET(request) {
  const search = new URL(request.url).search;
  const token  = request.headers.get("Authorization") || "";

  // Try gateway
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res   = await fetch(`${GATEWAY}/vendors${search}`, {
      headers: { Authorization: token },
      signal:  ctrl.signal,
    });
    clearTimeout(timer);
    const d = await res.json();
    if (d.vendors || d.success) return NextResponse.json(d, { status: res.status });
  } catch (_) {}

  // DB fallback
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ success: true, vendors: [], offline: true });
  }
  try {
    const params = new URLSearchParams(search);
    const status = params.get("status") || "active";
    const limit  = Math.min(parseInt(params.get("limit") || "24"), 100);
    const q      = (params.get("q") || "").toLowerCase().trim();

    let query = "SELECT id, business_name, city, state, rating, verified_auto, logo_url, type FROM vendors WHERE status=$1";
    const values = [status];
    if (q) {
      query += ` AND LOWER(business_name) LIKE $${values.length + 1}`;
      values.push(`%${q}%`);
    }
    query += ` ORDER BY rating DESC NULLS LAST LIMIT $${values.length + 1}`;
    values.push(limit);

    const result = await pool.query(query, values);
    return NextResponse.json({
      success: true,
      vendors: result.rows,
      total:   result.rowCount,
      source:  "direct_db",
    });
  } catch (err) {
    return NextResponse.json({ success: true, vendors: [], offline: true });
  }
}
