/**
 * GET /api/payments/health
 * Returns the configuration status of all payment gateways and the wallet ledger.
 * Used by the checkout page to show a clear error before the user attempts to pay.
 */
import { NextResponse } from "next/server";
import pool from "../../../../lib/db.js";

export async function GET() {
  const paystackKey = process.env.PAYSTACK_LSK || "";
  const stripeKey   = process.env.STRIPE_SECRET_KEY || "";

  const paystack = paystackKey.startsWith("sk_") ? "configured" : "missing";
  const stripe   = stripeKey.startsWith("sk_")   ? "configured" : "missing";

  // Live Paystack reachability check (quick ping — 4s timeout)
  let paystackLive = "unknown";
  if (paystack === "configured") {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch("https://api.paystack.co/transaction?perPage=1", {
        headers: { Authorization: `Bearer ${paystackKey}` },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      paystackLive = r.ok ? "connected" : (r.status === 401 ? "invalid_key" : `error_${r.status}`);
    } catch (_) {
      paystackLive = "unreachable";
    }
  } else {
    paystackLive = "not_configured";
  }

  // Check wallet ledger schema using shared pool (matches lib/db.js SSL logic)
  let walletLedger = "unknown";
  try {
    const res = await pool.query(`
      SELECT COUNT(*) AS cnt
      FROM information_schema.table_constraints
      WHERE constraint_type = 'UNIQUE'
        AND table_name       = 'wallet_transactions'
        AND constraint_name  = 'wallet_transactions_reference_key'
    `);
    walletLedger = parseInt(res.rows[0]?.cnt) > 0 ? "valid" : "missing_unique_constraint";
  } catch (_) {
    walletLedger = "db_unreachable";
  }

  // Webhook: check if PAYSTACK_WEBHOOK_SECRET is set (Paystack signs webhooks)
  const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET || "";
  const webhook = webhookSecret.length >= 8 ? "configured" : "missing";

  const healthy = paystack === "configured";
  const anyGateway = healthy || stripe === "configured";

  return NextResponse.json(
    {
      paystack,
      paystack_live: paystackLive,
      stripe,
      webhook,
      wallet_ledger: walletLedger,
      any_gateway:   anyGateway,
      summary: {
        PAYSTACK: paystackLive === "connected" ? "✅ Connected" : paystack === "missing" ? "❌ Key Missing" : `⚠️ ${paystackLive}`,
        STRIPE:   stripe === "configured" ? "✅ Configured" : "❌ Key Missing",
        WEBHOOK:  webhook === "configured" ? "✅ Active" : "⚠️ Secret Not Set",
      },
    },
    { status: healthy ? 200 : 503 }
  );
}
