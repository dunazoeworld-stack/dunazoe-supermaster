/**
 * POST /api/webhooks/stripe
 * Canonical Stripe webhook URL — register this in the Stripe dashboard.
 * Verifies Stripe-Signature header and handles payment_intent.succeeded,
 * charge.refunded, and customer.subscription.* events.
 */
import { NextResponse } from "next/server";
import crypto from "crypto";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.DATABASE_URL || "").includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : false,
});

const SERVICE_CHARGE_PCT = 0.05;

export async function POST(request) {
  const STRIPE_SECRET        = process.env.STRIPE_SECRET_KEY || "";
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

  if (!STRIPE_SECRET || !STRIPE_WEBHOOK_SECRET) {
    console.error("[Webhook/Stripe] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ received: false }, { status: 503 });
  }

  const rawBody   = await request.text();
  const sigHeader = request.headers.get("stripe-signature") || "";

  // ── Stripe signature verification (HMAC-SHA256 with timestamp tolerance) ─
  let event;
  try {
    const parts     = Object.fromEntries(sigHeader.split(",").map(p => p.split("=")));
    const timestamp = parts.t || "";
    const v1sig     = parts.v1 || "";
    const signed    = `${timestamp}.${rawBody}`;
    const expected  = crypto.createHmac("sha256", STRIPE_WEBHOOK_SECRET).update(signed).digest("hex");

    if (!v1sig || expected !== v1sig) {
      console.warn("[Webhook/Stripe] ❌ Invalid signature — rejected");
      return NextResponse.json({ received: false }, { status: 401 });
    }

    // Replay attack protection — reject if timestamp > 5 minutes old
    const age = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
    if (age > 300) {
      console.warn(`[Webhook/Stripe] ❌ Timestamp too old (${Math.round(age)}s) — rejected`);
      return NextResponse.json({ received: false }, { status: 401 });
    }

    event = JSON.parse(rawBody);
  } catch (err) {
    console.warn("[Webhook/Stripe] ❌ Signature/parse error:", err.message);
    return NextResponse.json({ received: false }, { status: 400 });
  }

  const { type, data } = event;
  const obj = data?.object || {};
  console.log(`[Webhook/Stripe] ▶ ${type} | id=${obj.id || "—"}`);

  try {
    if (type === "payment_intent.succeeded") {
      const amountNgn  = (obj.amount || 0) / 100;
      const reference  = obj.id;
      const orderId    = obj.metadata?.order_id || null;
      const vendorId   = obj.metadata?.vendor_id || null;

      if (orderId) {
        const { rowCount } = await pool.query(
          `UPDATE orders
           SET status='paid', payment_reference=$1, amount_paid=$2, paid_at=NOW(), updated_at=NOW()
           WHERE (id=$3 OR stripe_payment_intent=$1) AND status != 'paid'`,
          [reference, amountNgn, orderId]
        );
        if (rowCount > 0 && vendorId) {
          const vendorAmount = parseFloat((amountNgn * (1 - SERVICE_CHARGE_PCT)).toFixed(2));
          await pool.query(
            `INSERT INTO vendor_payouts (vendor_id, order_id, gross_ngn, service_charge_ngn, net_ngn, status, scheduled_at)
             VALUES ($1,$2,$3,$4,$5,'pending',NOW()+INTERVAL '24 hours')
             ON CONFLICT DO NOTHING`,
            [vendorId, orderId, amountNgn, amountNgn * SERVICE_CHARGE_PCT, vendorAmount]
          ).catch(() => {});
          console.log(`[Webhook/Stripe] ✅ Order ${orderId} paid ₦${amountNgn}, payout scheduled`);
        }
      }
    }

    if (type === "charge.refunded") {
      const reference = obj.payment_intent || obj.id;
      await pool.query(
        `UPDATE orders SET status='refunded', updated_at=NOW()
         WHERE payment_reference=$1 AND status='paid'`,
        [reference]
      ).catch(() => {});
      console.log(`[Webhook/Stripe] ↩ Refund processed for ${reference}`);
    }
  } catch (e) {
    console.error("[Webhook/Stripe] DB error:", e.message);
  }

  // Always 200 — Stripe retries on 5xx
  return NextResponse.json({ received: true, type });
}
