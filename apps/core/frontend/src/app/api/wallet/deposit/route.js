/**
 * DUNAZOE — Wallet Deposit API Route
 * Primary: proxies to gateway wallet service.
 * Fallback: direct Paystack payment initiation if gateway is down.
 */
import { NextResponse } from "next/server";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";
const PAYSTACK_BASE = "https://api.paystack.co";

export async function POST(req) {
  const token = req.headers.get("Authorization") || "";
  let body = {};
  try { body = await req.json(); } catch (_) {}

  const { amount, provider = "paystack", currency = "NGN" } = body;

  // ── Try gateway first — note: wallet service uses /wallets/* ────────────
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    // Gateway proxies /wallets → wallet-service; wallet-service doesn't initiate
    // Paystack — it just credits balance. Skip gateway for deposit initiation.
    clearTimeout(timer);
  } catch (_) {}

  // ── Direct Paystack fallback (NGN) ───────────────────────────────────────
  if (provider !== "stripe" && currency === "NGN") {
    const PAYSTACK_SECRET = process.env.PAYSTACK_LSK || process.env.PAYSTACK_SECRET_KEY || "";
    if (!PAYSTACK_SECRET) {
      return NextResponse.json({
        success: false,
        error: "Payment gateway is not configured. Please contact support.",
      }, { status: 503 });
    }

    if (!amount || parseFloat(amount) < 100) {
      return NextResponse.json({ success: false, error: "Minimum deposit is ₦100." }, { status: 400 });
    }

    // Extract email from JWT (best effort)
    let email = "wallet@dunazoe.com";
    try {
      const jwt = (token.replace("Bearer ", "")).split(".");
      if (jwt.length === 3) {
        const payload = JSON.parse(Buffer.from(jwt[1], "base64").toString("utf8"));
        if (payload.email) email = payload.email;
      }
    } catch (_) {}

    const amountKobo = Math.round(parseFloat(amount) * 100);
    const reference  = `DZ-WALLET-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "https://dunazoe.com";

    try {
      const psRes = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amountKobo,
          reference,
          callback_url: `${appUrl}/wallet?deposit_ref=${reference}`,
          metadata: {
            type: "wallet_deposit",
            amount_ngn: parseFloat(amount),
            platform: "DUNAZOE",
            custom_fields: [
              { display_name: "Type",    variable_name: "type",    value: "Wallet Deposit" },
              { display_name: "Platform", variable_name: "platform", value: "DUNAZOE" },
            ],
          },
          channels: ["card", "bank", "ussd", "bank_transfer", "mobile_money"],
          currency: "NGN",
        }),
      });
      const psData = await psRes.json();
      if (!psRes.ok || !psData.status) {
        return NextResponse.json({
          success: false,
          error: psData.message || "Payment initialization failed. Please try again.",
        }, { status: 502 });
      }
      return NextResponse.json({
        success:      true,
        payment_url:  psData.data.authorization_url,
        reference:    psData.data.reference,
        access_code:  psData.data.access_code,
        amount_ngn:   parseFloat(amount),
        provider:     "paystack",
      });
    } catch (err) {
      return NextResponse.json({
        success: false,
        error:   "Payment service temporarily unavailable. Please try again in a moment.",
      }, { status: 503 });
    }
  }

  // ── Stripe fallback (USD/international) ─────────────────────────────────
  if (provider === "stripe") {
    const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || "";
    if (!STRIPE_SECRET) {
      return NextResponse.json({
        success: false,
        error:   "Stripe is not configured for international deposits. Please use Paystack.",
      }, { status: 503 });
    }
    // Stripe deposit would go here — for now return clear message
    return NextResponse.json({
      success: false,
      error:   "Stripe wallet deposits are coming soon. Please use Paystack for NGN deposits.",
    }, { status: 503 });
  }

  return NextResponse.json({
    success: false,
    error:   "Payment gateway is temporarily unavailable. Please try again shortly.",
  }, { status: 503 });
}
