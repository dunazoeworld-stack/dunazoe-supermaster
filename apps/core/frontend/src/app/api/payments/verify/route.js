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

async function verifyReference(reference, PAYSTACK_SECRET) {
  const res  = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
  });
  const data = await res.json();

  if (!res.ok || !data.status) {
    throw new Error(data.message || `Paystack verify failed: ${res.status}`);
  }
  return data.data; // { status, amount, customer, metadata, … }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("reference") || searchParams.get("ref") || searchParams.get("trxref");
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
