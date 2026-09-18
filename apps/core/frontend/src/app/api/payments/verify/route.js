/**
 * GET  /api/payments/verify?reference=DZ-xxx
 * POST /api/payments/verify  { reference }
 *
 * Verifies a Paystack transaction reference and marks the order as paid.
 * Called after Paystack redirects the customer back to /payment/verify.
 */
import { NextResponse } from "next/server";
import { Pool } from "pg";

const PAYSTACK_BASE = "https://api.paystack.co";

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL,
  ssl: (process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || "").includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : false,
});

async function readProviderJson(response, provider) {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error(`${provider} returned an invalid response (${response.status}).`);
  }
}

async function verifyReference(reference, PAYSTACK_SECRET) {
  const res  = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
  });
  const data = await readProviderJson(res, "Paystack");

  if (!res.ok || !data.status) {
    throw new Error(data.message || `Paystack verify failed: ${res.status}`);
  }
  return data.data; // { status, amount, customer, metadata, … }
}

async function verifyStripeSession(sessionId, stripeSecret) {
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${stripeSecret}:`).toString("base64")}` },
  });
  const data = await readProviderJson(response, "Stripe");
  if (!response.ok || data.error) throw new Error(data.error?.message || `Stripe verify failed: ${response.status}`);
  return data;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const provider = String(searchParams.get("provider") || "").toLowerCase();
  const sessionId = searchParams.get("session_id");
  const reference = searchParams.get("reference") || searchParams.get("ref") || searchParams.get("trxref");
  if (provider === "stripe" || sessionId) return handleStripeVerify(sessionId);
  return handleVerify(reference);
}

export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch (_) {}
  return handleVerify(body.reference || body.ref);
}

async function handleVerify(reference) {
  const PAYSTACK_SECRET = process.env.PAYSTACK_LSK || process.env.PAYSTACK_SECRET_KEY || "";

  if (!PAYSTACK_SECRET) {
    return NextResponse.json({ success: false, error: "Payment gateway not configured." }, { status: 503 });
  }
  if (!reference) {
    return NextResponse.json({ success: false, error: "Payment reference is required." }, { status: 400 });
  }

  try {
    const tx = await verifyReference(reference, PAYSTACK_SECRET);

    const paid    = tx.status === "success";
    const amountNgn = tx.amount / 100;
    const orderId = tx.metadata?.order_id || null;

    // Update order status in DB
    if (orderId && process.env.DATABASE_URL) {
      const status = paid ? "paid" : "failed";
      pool.query(
        "UPDATE orders SET status=$1, updated_at=NOW() WHERE (id=$2 OR paystack_ref=$3)",
        [status, orderId, reference]
      ).catch(e => console.warn("[Payments/Verify] DB update skipped:", e.message));
    }

    return NextResponse.json({
      success:    true,
      paid,
      status:     tx.status,
      reference,
      amount_ngn: amountNgn,
      order_id:   orderId,
      customer:   tx.customer?.email || null,
      paid_at:    tx.paid_at || null,
      channel:    tx.channel || null,
    });

  } catch (err) {
    console.error("[Payments/Verify] Fatal:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Verification failed." },
      { status: 502 }
    );
  }
}

async function handleStripeVerify(sessionId) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY || "";
  if (!stripeSecret) return NextResponse.json({ success: false, error: "Stripe is not configured." }, { status: 503 });
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return NextResponse.json({ success: false, error: "A valid Stripe checkout session is required." }, { status: 400 });
  }
  try {
    const session = await verifyStripeSession(sessionId, stripeSecret);
    const paid = session.payment_status === "paid";
    const orderId = session.metadata?.order_id || null;
    const amountUsd = Number(session.amount_total || 0) / 100;
    const rate = Number(session.metadata?.exchange_rate || 0);
    const sourceCurrency = String(session.metadata?.source_currency || "USD").toUpperCase();
    const amountNgn = sourceCurrency === "NGN" && rate > 0 ? amountUsd * rate : null;

    if (paid && orderId && process.env.DATABASE_URL) {
      await pool.query(
        `UPDATE orders
         SET status='paid', payment_reference=$1, amount_paid=COALESCE($2, amount_paid), paid_at=COALESCE(paid_at, NOW()), updated_at=NOW()
         WHERE id=$3 AND status <> 'paid'`,
        [session.id, amountNgn, orderId]
      );
    }

    return NextResponse.json({
      success: true,
      paid,
      status: session.payment_status || session.status,
      provider: "stripe",
      reference: session.id,
      session_id: session.id,
      order_id: orderId,
      amount_usd: amountUsd,
      amount_ngn: amountNgn,
      customer: session.customer_details?.email || session.customer_email || null,
    });
  } catch (error) {
    console.error("[Payments/StripeVerify] failed:", error.message);
    return NextResponse.json({ success: false, error: "Stripe payment verification failed." }, { status: 502 });
  }
}
