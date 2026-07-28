/**
 * POST /api/payments/initialize
 * Initialises payment for an order.
 * NGN → Paystack (primary), falls back to direct Paystack if gateway down.
 * USD → Stripe (international).
 */
import { NextResponse } from "next/server";
import { Pool } from "pg";

const PAYSTACK_BASE = "https://api.paystack.co";
const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL,
  ssl: (process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || "").includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : false,
});

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

  if (!amount || !email) {
    return NextResponse.json(
      { success: false, error: "amount and email are required." },
      { status: 400 }
    );
  }

  // ── USD / Stripe ─────────────────────────────────────────────────────────
  if (currency.toUpperCase() === "USD") {
    if (!STRIPE_SECRET) {
      return NextResponse.json(
        { success: false, error: "Stripe not configured for USD payments." },
        { status: 503 }
      );
    }
    try {
      // Try gateway first
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${GATEWAY}/payments/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id, currency: "USD" }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const d = await res.json();
      if (d.payment_url) return NextResponse.json(d);
    } catch (_) {}

    // Direct Stripe session
    try {
      const stripe = (await import("stripe")).default(STRIPE_SECRET);
      const amountCents = Math.round(parseFloat(amount) * 100);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dunazoe.com";
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: { name: `DUNAZOE Order${order_id ? ` #${order_id}` : ""}` },
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${appUrl}/payment/verify?ref=STRIPE-${session?.id || Date.now()}&order=${order_id}`,
        cancel_url:  `${appUrl}/cart`,
        customer_email: email,
        metadata: { order_id: String(order_id || ""), platform: "DUNAZOE" },
      });
      return NextResponse.json({
        success: true,
        provider: "stripe",
        payment_url: session.url,
        session_id: session.id,
        currency: "USD",
      });
    } catch (err) {
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
  const reference   = `DZ-${order_id || "CART"}-${Date.now()}`;
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
