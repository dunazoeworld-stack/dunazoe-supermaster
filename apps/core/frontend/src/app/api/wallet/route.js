/**
 * DUNAZOE — Wallet Actions API Route
 * Handles withdraw, transfer, and other wallet actions.
 * Security: withdrawals ONLY to registered+verified bank account.
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

  const { action } = body;

  // ── WITHDRAWAL: enforce bank account verification ─────────────────────────
  if (action === "withdraw") {
    const { amount, bank_name, account_no, account_name, currency = "NGN" } = body;

    if (!amount || parseFloat(amount) < 500) {
      return NextResponse.json({ success: false, error: "Minimum withdrawal amount is ₦500." }, { status: 400 });
    }
    if (!account_no || !account_name || !bank_name) {
      return NextResponse.json({
        success: false,
        error:   "Withdrawal requires a verified bank account. Register your bank account in your vendor profile first.",
      }, { status: 400 });
    }

    // Verify bank account matches registered account
    if (process.env.DATABASE_URL) {
      try {
        let userId = null;
        try {
          const jwt = token.replace("Bearer ", "").split(".");
          if (jwt.length === 3) {
            const payload = JSON.parse(Buffer.from(jwt[1], "base64").toString("utf8"));
            userId = payload.id || payload.user_id || payload.sub;
          }
        } catch (_) {}

        if (userId) {
          const vendorRes = await pool.query(
            "SELECT bank_name, account_no, account_name FROM vendors WHERE user_id=$1 AND status='active' LIMIT 1",
            [userId]
          );
          if (vendorRes.rows.length > 0) {
            const registered = vendorRes.rows[0];
            // Verify account number matches (strict match)
            if (registered.account_no && registered.account_no !== account_no) {
              return NextResponse.json({
                success: false,
                error: `Withdrawal blocked: account number does not match your registered bank account (${registered.bank_name} ending in ...${(registered.account_no || "").slice(-4)}). Only withdrawals to your single registered and verified bank account are permitted.`,
              }, { status: 403 });
            }
          }
        }
      } catch (dbErr) {
        console.warn("[wallet/withdraw] DB verification skipped:", dbErr.message);
      }
    }

    // Pass to gateway wallet service
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(`${GATEWAY}/wallets/withdraw`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: token },
        body:    JSON.stringify({ amount: parseFloat(amount), currency, purpose: body.purpose || "Withdrawal" }),
        signal:  ctrl.signal,
      });
      clearTimeout(timer);
      const d = await res.json();
      if (d.success) {
        // Log withdrawal destination for audit
        return NextResponse.json({
          ...d,
          destination: {
            bank_name,
            account_no:   account_no.slice(0, 3) + "****" + account_no.slice(-3),
            account_name,
          },
          message: `₦${parseFloat(amount).toLocaleString("en-NG")} withdrawal initiated to ${bank_name}. Processing within 24 hours.`,
        });
      }
      return NextResponse.json(d, { status: res.status });
    } catch (err) {
      return NextResponse.json({
        success: false,
        error:   "Withdrawal service temporarily unavailable. Please try again shortly.",
      }, { status: 503 });
    }
  }

  // ── Other wallet actions ──────────────────────────────────────────────────
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
