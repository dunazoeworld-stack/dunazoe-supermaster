/**
 * POST /api/payments/initialize
 * Initialises payment for an order.
 * NGN → Paystack (primary), falls back to direct Paystack if gateway down.
 * USD → Stripe (international).
 */
import { NextResponse } from "next/server";
import crypto from "crypto";
import pool from "../../../../lib/db.js";
import { convertNGNtoUSD } from "../../../../lib/currency.js";

const PAYSTACK_BASE = "https://api.paystack.co";
const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";

export async function POST(request) {
  const PAYSTACK_SECRET = process.env.PAYSTACK_LSK || process.env.PAYSTACK_SECRET_KEY || "";
  const STRIPE_SECRET   = process.env.STRIPE_SECRET_KEY || "";

  let body = {};
  try { body = await request.json(); } catch (_) {}

  const {
    amount,
    email,
    order_id,
    currency = "NGN",
    cart_items = [],
    customer_name = "",
    callback_url,
  } = body;
  const requestedCurrency = String(currency || "NGN").toUpperCase();
  const sourceCurrency = String(body.source_currency || (requestedCurrency === "USD" ? "NGN" : "NGN")).toUpperCase();
  const idempotencyHeader = request.headers.get("Idempotency-Key") || "";
  const idempotencyKey = idempotencyHeader || (order_id
    ? `dunazoe-order-${order_id}-${requestedCurrency}-${String(amount)}`
    : "");
  const idempotencyHash = idempotencyKey
    ? crypto.createHash("sha256").update(idempotencyKey).digest("hex")
    : "";

  if (!amount || !email) {
    return NextResponse.json(
      { success: false, error: "amount and email are required." },
      { status: 400 }
    );
  }

  // ── USD / Stripe ─────────────────────────────────────────────────────────
  if (requestedCurrency === "USD") {
    if (!STRIPE_SECRET) {
      return NextResponse.json(
        { success: false, error: "Stripe not configured for USD payments." },
        { status: 503 }
      );
    }

    if (!["NGN", "USD"].includes(sourceCurrency)) {
      return NextResponse.json({ success: false, error: "Unsupported source currency for Stripe." }, { status: 400 });
    }

    // Convert before any gateway call so every provider receives an explicit USD amount.
    let amountUsd = parseFloat(amount);
    let rateUsed = 1;
    let ngnAmount = null;
    let rateSource = "explicit_usd";
    if (sourceCurrency === "NGN") {
      const conversion = await convertNGNtoUSD(parseFloat(amount));
      if (!Number.isFinite(conversion.usd) || !Number.isFinite(conversion.rate) || conversion.rate <= 0) {
        return NextResponse.json({ success: false, error: "A valid exchange rate is unavailable. Please try again." }, { status: 503 });
      }
      amountUsd = conversion.usd;
      rateUsed = conversion.rate;
      ngnAmount = parseFloat(amount);
      rateSource = conversion.source;
    }
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return NextResponse.json({ success: false, error: "Payment amount must be positive." }, { status: 400 });
    }

    // Try gateway first (in case payment-service handles Stripe)
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(`${GATEWAY}/payments/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id, currency: "USD", source_currency: sourceCurrency, email,
          amount: amountUsd, amount_source: ngnAmount || amount,
          exchange_rate: ngnAmount ? rateUsed : null, exchange_rate_source: rateSource,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const d = await res.json();
      if (d.payment_url) return NextResponse.json({ ...d, provider: "stripe" });
    } catch (_) {}

    // Save conversion record to DB (non-blocking).
    if (ngnAmount) {
      pool.query(
        `INSERT INTO payment_conversions (ngn_amount, usd_amount, rate_used, order_ref, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT DO NOTHING`,
        [ngnAmount, amountUsd, rateUsed, order_id || null]
      ).catch(() => {});
    }

    // Direct Stripe Checkout Session via REST API (no npm SDK required)
    try {
      const amountCents = Math.round(amountUsd * 100);
      const appUrl      = process.env.NEXT_PUBLIC_APP_URL || "https://dunazoe.com";
      const successRef  = `STRIPE-${order_id || Date.now()}`;

      const body = new URLSearchParams();
      body.append("payment_method_types[]",                           "card");
      body.append("line_items[0][price_data][currency]",              "usd");
      body.append("line_items[0][price_data][unit_amount]",           String(amountCents));
      body.append("line_items[0][price_data][product_data][name]",    `DUNAZOE Order${order_id ? ` #${order_id}` : ""}`);
      body.append("line_items[0][quantity]",                          "1");
      body.append("mode",                                             "payment");
      body.append("success_url",                                      `${appUrl}/payment/verify?ref=${successRef}&order=${order_id}`);
      body.append("cancel_url",                                       `${appUrl}/cart`);
      if (email) body.append("customer_email",                        email);
      if (order_id) body.append("metadata[order_id]",                 String(order_id));
      body.append("metadata[platform]",                               "DUNAZOE");
      body.append("metadata[currency]",                               "USD");
      body.append("metadata[source_currency]",                        sourceCurrency);
      body.append("metadata[exchange_rate]",                          String(rateUsed));
      body.append("metadata[exchange_rate_source]",                   rateSource);

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method:  "POST",
        headers: {
          Authorization:  `Basic ${Buffer.from(STRIPE_SECRET + ":").toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
          ...(idempotencyHash ? { "Idempotency-Key": idempotencyHash } : {}),
        },
        body: body.toString(),
      });

      const session = await stripeRes.json();

      if (!stripeRes.ok || session.error) {
        const msg = session.error?.message || `Stripe error ${stripeRes.status}`;
        console.error("[Payments/Stripe] API error:", msg);
        return NextResponse.json({ success: false, error: msg }, { status: 502 });
      }

      console.log(`[Payments/Stripe] ✅ Session ${session.id} for ${email} — $${amountUsd.toFixed(2)}${ngnAmount ? ` (₦${ngnAmount} @ ${rateUsed})` : ""}`);
      return NextResponse.json({
        success:      true,
        provider:     "stripe",
        payment_url:  session.url,
        session_id:   session.id,
        currency:     "USD",
        amount_usd:   amountUsd,
        amount_ngn:   ngnAmount || null,
        rate_used:    ngnAmount ? rateUsed : null,
        rate_source:  rateSource,
      });
    } catch (err) {
      console.error("[Payments/Stripe] Fatal:", err.message);
      return NextResponse.json({ success: false, error: err.message }, { status: 502 });
    }
  }

  // ── NGN / Paystack ───────────────────────────────────────────────────────
  if (!PAYSTACK_SECRET) {
    return NextResponse.json(
      { success: false, error: "Payment gateway not configured." },
      { status: 503 }
    );
  }

  const amountKobo  = Math.round(parseFloat(amount) * 100);
  const reference   = idempotencyHash
    ? `DZ-${idempotencyHash.slice(0, 24)}`
    : `DZ-${order_id || "CART"}-${Date.now()}`;
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "";
  const callbackUrl = callback_url || `${appUrl}/payment/verify?ref=${reference}`;

  try {
    const psRes = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount:       amountKobo,
        reference,
        callback_url: callbackUrl,
        metadata: {
          order_id:      order_id || reference,
          customer_name,
          cart_items:    cart_items.slice(0, 5),
          platform:      "DUNAZOE",
          custom_fields: [
            { display_name: "Platform",  variable_name: "platform",  value: "DUNAZOE" },
            { display_name: "Order Ref", variable_name: "order_ref", value: reference },
          ],
        },
        channels: ["card", "bank", "ussd", "bank_transfer", "mobile_money"],
        currency: "NGN",
      }),
    });

    const psData = await psRes.json();

    if (!psRes.ok || !psData.status) {
      const msg = psData.message || `Paystack error ${psRes.status}`;
      console.error("[Payments/Initialize] Paystack rejected:", msg);
      return NextResponse.json({ success: false, error: msg }, { status: 502 });
    }

    const { authorization_url, access_code, reference: psRef } = psData.data;

    // Persist the reference in DB if possible (non-blocking)
    if (order_id && process.env.DATABASE_URL) {
      pool.query(
        "UPDATE orders SET paystack_ref=$1, status='reserved', updated_at=NOW() WHERE id=$2",
        [psRef, order_id]
      ).catch(e => console.warn("[Payments] DB update skipped:", e.message));
    }

    return NextResponse.json({
      success:      true,
      provider:     "paystack",
      payment_url:  authorization_url,
      access_code,
      reference:    psRef,
      amount_ngn:   parseFloat(amount),
      amount_kobo:  amountKobo,
    });

  } catch (err) {
    console.error("[Payments/Initialize] Fatal:", err.message);
    return NextResponse.json(
      { success: false, error: "Payment initialization failed. Please try again." },
      { status: 500 }
    );
  }
}
