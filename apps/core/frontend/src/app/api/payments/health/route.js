/**
 * GET /api/payments/health
 * Returns the configuration status of all payment gateways and the wallet ledger.
 * Used by the checkout page to show a clear error before the user attempts to pay.
 */
import { NextResponse } from "next/server";
import { Pool } from "pg";

export async function GET() {
  const paystackKey = process.env.PAYSTACK_LSK || "";
  const stripeKey   = process.env.STRIPE_SECRET_KEY || "";

  const paystack = paystackKey.startsWith("sk_") ? "configured" : "missing";
  const stripe   = stripeKey.startsWith("sk_")   ? "configured" : "missing";

  // Check wallet ledger schema
  let walletLedger = "unknown";
  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
      max: 1,
    });
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
    } finally {
      await pool.end().catch(() => {});
    }
  }

  const healthy = paystack === "configured";

  return NextResponse.json(
    {
      paystack,
      stripe,
      wallet_ledger: walletLedger,
      any_gateway:   healthy || stripe === "configured",
    },
    { status: healthy ? 200 : 503 }
  );
}
