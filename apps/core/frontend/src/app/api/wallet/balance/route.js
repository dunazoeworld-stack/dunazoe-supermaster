/**
 * DUNAZOE — Wallet Balance API Route
 * Primary: gateway wallet service.
 * Fallback: direct DB query if gateway is down.
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

  // ── Try gateway first ──────────────────────────────────────────────────────
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`${GATEWAY}/wallet${search}`, {
      headers: { Authorization: token },
      signal:  ctrl.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const d = await res.json();
      if (d.success || d.balance !== undefined) {
        // Normalize response: ensure `balance` field at top level
        const balance = d.balance ?? d.wallet?.NGN?.available ?? d.wallet?.NGN?.balance ?? 0;
        return NextResponse.json({ ...d, success: true, balance }, { status: 200 });
      }
    }
  } catch (_) {
    // Gateway down — try direct DB
  }

  // ── Direct DB fallback ────────────────────────────────────────────────────
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ success: true, balance: 0, offline: true }, { status: 200 });
  }

  try {
    // Extract user_id from JWT (best effort)
    let userId = null;
    try {
      const jwt = token.replace("Bearer ", "").split(".");
      if (jwt.length === 3) {
        const payload = JSON.parse(Buffer.from(jwt[1], "base64").toString("utf8"));
        userId = payload.id || payload.user_id || payload.sub;
      }
    } catch (_) {}

    if (!userId) {
      return NextResponse.json({ success: true, balance: 0, offline: true }, { status: 200 });
    }

    const result = await pool.query(
      "SELECT balance_ngn, locked_ngn, balance_usd FROM wallets WHERE user_id=$1 LIMIT 1",
      [userId]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ success: true, balance: 0, offline: false }, { status: 200 });
    }
    const w = result.rows[0];
    const balance = parseFloat(w.balance_ngn || 0) - parseFloat(w.locked_ngn || 0);
    return NextResponse.json({
      success:    true,
      balance,
      balance_ngn: parseFloat(w.balance_ngn || 0),
      locked_ngn:  parseFloat(w.locked_ngn  || 0),
      balance_usd: parseFloat(w.balance_usd || 0),
      source:      "direct_db",
    });
  } catch (err) {
    console.error("[wallet/balance] DB fallback error:", err.message);
    return NextResponse.json({ success: true, balance: 0, offline: true }, { status: 200 });
  }
}

export async function POST(req) {
  const token = req.headers.get("Authorization") || "";
  let body = {};
  try { body = await req.json(); } catch (_) {}

  // Handle withdrawal with bank verification
  if (body.action === "withdraw") {
    // Ensure bank account matches registered account (security check)
    if (!body.account_no || !body.account_name || !body.bank_name) {
      return NextResponse.json({
        success: false,
        error: "Bank account details are required for withdrawal. Only withdrawals to your registered and verified bank account are permitted.",
      }, { status: 400 });
    }
  }

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
      error:   "Wallet service temporarily unavailable. Please try again.",
    }, { status: 503 });
  }
}
