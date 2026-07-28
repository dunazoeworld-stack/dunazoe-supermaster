/**
 * DUNAZOE — Wallet Transactions API Route
 * Proxies to gateway wallet service.
 */
import { NextResponse } from "next/server";
import { Pool } from "pg";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export async function GET(req) {
  const token  = req.headers.get("Authorization") || "";
  const search = new URL(req.url).search;

  // Try gateway
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${GATEWAY}/wallet/transactions${search}`, {
      headers: { Authorization: token },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const d = await res.json();
    if (d.transactions || d.success) return NextResponse.json(d, { status: res.status });
  } catch (_) {}

  // DB fallback
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ success: true, transactions: [], offline: true });
  }
  try {
    let userId = null;
    try {
      const jwt = token.replace("Bearer ", "").split(".");
      if (jwt.length === 3) {
        const payload = JSON.parse(Buffer.from(jwt[1], "base64").toString("utf8"));
        userId = payload.id || payload.user_id || payload.sub;
      }
    } catch (_) {}

    if (!userId) return NextResponse.json({ success: true, transactions: [], offline: true });

    const params = new URLSearchParams(search);
    const limit  = parseInt(params.get("limit") || "20");
    const result = await pool.query(
      "SELECT * FROM wallet_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2",
      [userId, limit]
    );
    return NextResponse.json({ success: true, transactions: result.rows, source: "direct_db" });
  } catch (err) {
    return NextResponse.json({ success: true, transactions: [], offline: true });
  }
}
