/**
 * POST /api/payments/webhook
 * Paystack webhook receiver.
 * Verifies HMAC-SHA512 signature, then processes charge.success events.
 * This runs entirely in Next.js without needing the payment microservice.
 */
import { NextResponse } from "next/server";
import crypto from "crypto";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL,
  ssl: (process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || "").includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : false,
});

export async function POST(request) {
  const PAYSTACK_SECRET = process.env.PAYSTACK_LSK || process.env.PAYSTACK_SECRET_KEY || "";

  if (!PAYSTACK_SECRET) {
    return NextResponse.json({ received: false }, { status: 503 });
  }

  // ── Signature verification ────────────────────────────────────────────────
  const rawBody  = await request.text();
  const signature = request.headers.get("x-paystack-signature") || "";
  const expected  = crypto.createHmac("sha512", PAYSTACK_SECRET).update(rawBody).digest("hex");

  if (signature !== expected) {
    console.warn("[Webhook] Invalid Paystack signature — rejected");
    return NextResponse.json({ received: false }, { status: 401 });
  }

  let event;
  try { event = JSON.parse(rawBody); } catch (_) {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  const { event: eventType, data } = event;
  console.log(`[Webhook] Event: ${eventType} | Ref: ${data?.reference}`);

  // ── charge.success ────────────────────────────────────────────────────────
  if (eventType === "charge.success") {
    const reference = data.reference;
    const amountNgn = data.amount / 100;
    const orderId   = data.metadata?.order_id || null;

    try {
      if (orderId) {
        await pool.query(
          `UPDATE orders
           SET status='paid', payment_reference=$1, amount_paid=$2, updated_at=NOW()
           WHERE (id=$3 OR paystack_ref=$1) AND status != 'paid'`,
          [reference, amountNgn, orderId]
        );
        console.log(`[Webhook] ✅ Order ${orderId} marked paid — ₦${amountNgn}`);
      } else {
        // Try to find by reference alone
        await pool.query(
          `UPDATE orders
           SET status='paid', payment_reference=$1, amount_paid=$2, updated_at=NOW()
           WHERE paystack_ref=$1 AND status != 'paid'`,
          [reference, amountNgn]
        );
      }
    } catch (e) {
      console.error("[Webhook] DB update failed:", e.message);
      // Return 200 anyway — Paystack will retry on 5xx
    }
  }

  // Always return 200 to Paystack to acknowledge receipt
  return NextResponse.json({ received: true });
}
