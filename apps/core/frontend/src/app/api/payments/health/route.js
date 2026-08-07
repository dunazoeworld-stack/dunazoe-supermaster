/**
 * GET /api/payments/health
 * Returns the configuration status of all payment gateways and the wallet ledger.
 * Used by the checkout page to show a clear error before the user attempts to pay.
 *
 * Key-type detection:
 *   PAYSTACK_LSK should be the SECRET key (sk_live_/sk_test_)
 *   pk_live_/pk_test_ = public key — can initialize front-end popup but cannot
 *     call server-side Paystack APIs or verify webhook signatures.
 *   STRIPE_SECRET_KEY should start with sk_live_/sk_test_/rk_live_/rk_test_
 */
import { NextResponse } from "next/server";
import pool from "../../../../lib/db.js";

function classifyPaystackKey(key) {
  if (!key)                     return "missing";
  if (key.startsWith("sk_live_")) return "secret_live";
  if (key.startsWith("sk_test_")) return "secret_test";
  if (key.startsWith("pk_live_")) return "public_live";   // wrong key type
  if (key.startsWith("pk_test_")) return "public_test";   // wrong key type
  return "invalid";
}

function classifyStripeKey(key) {
  if (!key) return "missing";
  if (key.startsWith("sk_live_") || key.startsWith("sk_test_")) return "secret";
  if (key.startsWith("rk_live_") || key.startsWith("rk_test_")) return "restricted";
  return "invalid";
}

export async function GET() {
  const paystackRaw   = process.env.PAYSTACK_LSK || "";
  const stripeRaw     = process.env.STRIPE_SECRET_KEY || "";
  const webhookRaw    = process.env.PAYSTACK_WEBHOOK_SECRET || "";
  const stripeWHRaw   = process.env.STRIPE_WEBHOOK_SECRET || "";

  const paystackType  = classifyPaystackKey(paystackRaw);
  const stripeType    = classifyStripeKey(stripeRaw);
  const webhookType   = classifyPaystackKey(webhookRaw || paystackRaw); // fallback to LSK

  // Paystack is "configured" only with a SECRET key — public key can't call server APIs
  const paystackOk    = paystackType === "secret_live" || paystackType === "secret_test";
  const stripeOk      = stripeType === "secret" || stripeType === "restricted";

  // Live Paystack reachability (only attempt with actual secret key)
  let paystackLive = "not_configured";
  if (paystackOk) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch("https://api.paystack.co/transaction?perPage=1", {
        headers: { Authorization: `Bearer ${paystackRaw}` },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      paystackLive = r.ok ? "connected" : (r.status === 401 ? "invalid_key" : `error_${r.status}`);
    } catch (_) {
      paystackLive = "unreachable";
    }
  } else if (paystackType.startsWith("public_")) {
    paystackLive = "public_key_only";
  }

  // Wallet ledger schema check
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

  // Webhook: needs SECRET key for HMAC-SHA512. Public key will fail signature verification.
  const webhookSigningOk = (webhookType === "secret_live" || webhookType === "secret_test");
  const webhookStatus    = webhookSigningOk ? "configured"
                         : (webhookType.startsWith("public_")) ? "public_key_cannot_sign"
                         : "missing";

  const anyGateway = paystackOk || stripeOk;

  // Human-readable summaries with actionable advice
  const paystackSummary =
    paystackLive === "connected"          ? "✅ Connected"
    : paystackLive === "public_key_only"  ? "⚠️  Public key set — need Secret Key (sk_live_…)"
    : paystackType === "invalid"          ? "❌ Invalid key format"
    : paystackType === "missing"          ? "❌ PAYSTACK_LSK not set"
    : `⚠️ ${paystackLive}`;

  const stripeSummary =
    stripeOk                              ? "✅ Configured"
    : stripeType === "invalid"            ? "❌ Invalid key — STRIPE_SECRET_KEY must start with sk_"
    : "❌ Not configured";

  const webhookSummary =
    webhookStatus === "configured"               ? "✅ Active"
    : webhookStatus === "public_key_cannot_sign" ? "⚠️  Public key set — webhook HMAC will fail (need sk_live_…)"
    : "⚠️  Not configured";

  return NextResponse.json(
    {
      paystack:       paystackOk ? "configured" : paystackType,
      paystack_live:  paystackLive,
      stripe:         stripeOk ? "configured" : stripeType,
      stripe_webhook: stripeWHRaw.startsWith("whsec_") ? "configured" : (stripeWHRaw ? "invalid" : "missing"),
      webhook:        webhookStatus,
      wallet_ledger:  walletLedger,
      any_gateway:    anyGateway,
      key_guidance: {
        paystack: paystackOk ? null : "PAYSTACK_LSK must be your Paystack SECRET key starting with sk_live_ or sk_test_",
        stripe:   stripeOk   ? null : "STRIPE_SECRET_KEY must start with sk_live_ or sk_test_ (from Stripe Dashboard → API Keys)",
      },
      summary: {
        PAYSTACK: paystackSummary,
        STRIPE:   stripeSummary,
        WEBHOOK:  webhookSummary,
      },
    },
    { status: anyGateway ? 200 : 503 }
  );
}
