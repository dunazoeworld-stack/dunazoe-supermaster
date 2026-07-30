/**
 * POST /api/payments/webhook
 * Paystack webhook receiver — verifies HMAC-SHA512 and handles:
 *   • charge.success    → mark order paid, schedule vendor payout
 *   • transfer.success  → credit vendor wallet after delivery (24h hold)
 *   • transfer.failed   → retry or flag for manual review
 *   • subscription.*    → (reserved for future recurring payments)
 *
 * Always returns 200 so Paystack stops retrying; log errors internally.
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

const SERVICE_CHARGE_PCT = 0.05; // 5% deducted from vendor payout

export async function POST(request) {
  const PAYSTACK_SECRET = process.env.PAYSTACK_LSK || process.env.PAYSTACK_SECRET_KEY || "";

  if (!PAYSTACK_SECRET) {
    console.error("[Webhook] PAYSTACK_LSK not set — cannot verify webhook");
    return NextResponse.json({ received: false }, { status: 503 });
  }

  // ── Signature verification (HMAC-SHA512) ─────────────────────────────────
  const rawBody   = await request.text();
  const signature = request.headers.get("x-paystack-signature") || "";
  const expected  = crypto.createHmac("sha512", PAYSTACK_SECRET).update(rawBody).digest("hex");

  if (!signature || signature !== expected) {
    console.warn("[Webhook] ❌ Invalid Paystack signature — rejected");
    return NextResponse.json({ received: false }, { status: 401 });
  }

  let event;
  try { event = JSON.parse(rawBody); } catch (_) {
    console.warn("[Webhook] ❌ Invalid JSON body");
    return NextResponse.json({ received: false }, { status: 400 });
  }

  const { event: eventType, data } = event;
  const ref = data?.reference || data?.transfer_code || "—";
  console.log(`[Webhook] ▶ ${eventType} | ref=${ref}`);

  // ── charge.success ────────────────────────────────────────────────────────
  if (eventType === "charge.success") {
    const reference  = data.reference;
    const amountNgn  = (data.amount || 0) / 100;
    const orderId    = data.metadata?.order_id || null;
    const vendorId   = data.metadata?.vendor_id || null;
    const isWallet   = data.metadata?.type === "wallet_deposit";

    try {
      if (isWallet) {
        // ── Wallet top-up — idempotent credit ─────────────────────────────
        // Guard: skip if this reference was already credited
        const dupeCheck = await pool.query(
          `SELECT id FROM wallet_transactions
           WHERE reference = $1 AND type = 'deposit' LIMIT 1`,
          [reference]
        ).catch(() => ({ rows: [] }));

        if (dupeCheck.rows.length > 0) {
          console.log(`[Webhook] ⚠️  wallet_deposit ${reference} already credited — skipping`);
        } else {
          const email   = data.customer?.email;
          const userId  = data.metadata?.user_id || null;

          // Credit via user_id (preferred) or email fallback
          let credited = false;
          if (userId) {
            const { rowCount } = await pool.query(
              `UPDATE wallets SET balance_ngn = balance_ngn + $1, updated_at = NOW()
               WHERE user_id = $2`,
              [amountNgn, userId]
            );
            credited = rowCount > 0;
          }
          if (!credited && email) {
            const { rowCount } = await pool.query(
              `UPDATE wallets w SET balance_ngn = balance_ngn + $1, updated_at = NOW()
               FROM users u WHERE u.email = $2 AND w.user_id = u.id`,
              [amountNgn, email]
            );
            credited = rowCount > 0;
          }

          if (credited) {
            // Record transaction for idempotency + history
            await pool.query(
              `INSERT INTO wallet_transactions
                 (user_id, type, amount, currency, reference, note, created_at)
               SELECT
                 COALESCE($1::int, (SELECT id FROM users WHERE email=$2 LIMIT 1)),
                 'deposit', $3, 'NGN', $4,
                 'Paystack wallet top-up (webhook)', NOW()
               ON CONFLICT (reference) DO NOTHING`,
              [userId, email, amountNgn, reference]
            ).catch(() => {}); // table may use different schema — non-fatal

            console.log(`[Webhook] ✅ Wallet credited ₦${amountNgn} ref=${reference} user=${userId || email}`);

            // In-app notification (non-blocking)
            const notifyUserId = userId || (email
              ? await pool.query("SELECT id FROM users WHERE email=$1 LIMIT 1", [email])
                  .then(r => r.rows[0]?.id).catch(() => null)
              : null);
            if (notifyUserId) {
              const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";
              fetch(`${GATEWAY}/notifications/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  user_id:  notifyUserId,
                  channels: ["in_app"],
                  title:    "💰 Wallet Funded",
                  message:  `₦${amountNgn.toLocaleString("en-NG")} has been credited to your DUNAZOE wallet. Ref: ${reference}`,
                }),
              }).catch(() => {});
            }
          } else {
            console.warn(`[Webhook] ⚠️  wallet_deposit ${reference} — no wallet row found for user=${userId} email=${email}`);
          }
        }
      } else {
        // Product order payment — mark order paid
        if (orderId) {
          const { rowCount } = await pool.query(
            `UPDATE orders
             SET status='paid', payment_reference=$1, amount_paid=$2, paid_at=NOW(), updated_at=NOW()
             WHERE (id=$3 OR paystack_ref=$1) AND status != 'paid'`,
            [reference, amountNgn, orderId]
          );
          if (rowCount > 0) {
            console.log(`[Webhook] ✅ Order ${orderId} → paid ₦${amountNgn}`);
            // Schedule vendor payout: gross - 5% service charge (24h hold simulated by DB flag)
            if (vendorId) {
              const vendorAmount = parseFloat((amountNgn * (1 - SERVICE_CHARGE_PCT)).toFixed(2));
              await pool.query(
                `INSERT INTO vendor_payouts (vendor_id, order_id, gross_ngn, service_charge_ngn, net_ngn, status, scheduled_at)
                 VALUES ($1, $2, $3, $4, $5, 'pending', NOW() + INTERVAL '24 hours')
                 ON CONFLICT DO NOTHING`,
                [vendorId, orderId, amountNgn, amountNgn * SERVICE_CHARGE_PCT, vendorAmount]
              ).catch(() => {
                // Table may not exist — update wallet directly as fallback
                return pool.query(
                  `UPDATE wallets SET balance_ngn = balance_ngn + $1,
                   locked_ngn = GREATEST(0, locked_ngn - $2), updated_at = NOW()
                   WHERE user_id = (SELECT user_id FROM vendors WHERE id = $3 LIMIT 1)`,
                  [vendorAmount, amountNgn, vendorId]
                );
              });
            }
          }
        } else {
          // Try to match by reference only
          await pool.query(
            `UPDATE orders
             SET status='paid', payment_reference=$1, amount_paid=$2, paid_at=NOW(), updated_at=NOW()
             WHERE paystack_ref=$1 AND status != 'paid'`,
            [reference, amountNgn]
          );
        }
      }
    } catch (e) {
      console.error("[Webhook] charge.success DB error:", e.message);
      // Still return 200 — Paystack retries on 5xx
    }
  }

  // ── transfer.success ──────────────────────────────────────────────────────
  if (eventType === "transfer.success") {
    const transferCode = data.transfer_code || data.reference;
    const amountNgn    = (data.amount || 0) / 100;
    const recipientId  = data.recipient?.id || data.recipient?.recipient_code;

    try {
      // Mark payout as completed
      const { rowCount } = await pool.query(
        `UPDATE vendor_payouts
         SET status='completed', paid_at=NOW(), transfer_code=$1, updated_at=NOW()
         WHERE transfer_code=$1 OR paystack_ref=$1`,
        [transferCode]
      );
      if (rowCount === 0) {
        // Fallback: try to find by amount + recent pending
        await pool.query(
          `UPDATE vendor_payouts
           SET status='completed', paid_at=NOW(), transfer_code=$1, updated_at=NOW()
           WHERE status='pending' AND net_ngn=$2 AND scheduled_at <= NOW()
           ORDER BY scheduled_at ASC LIMIT 1`,
          [transferCode, amountNgn]
        );
      }
      console.log(`[Webhook] ✅ Transfer ${transferCode} completed — ₦${amountNgn}`);
    } catch (e) {
      console.error("[Webhook] transfer.success DB error:", e.message);
    }
  }

  // ── transfer.failed ───────────────────────────────────────────────────────
  if (eventType === "transfer.failed" || eventType === "transfer.reversed") {
    const transferCode = data.transfer_code || data.reference;
    const amountNgn    = (data.amount || 0) / 100;
    try {
      await pool.query(
        `UPDATE vendor_payouts
         SET status='failed', failure_reason=$1, updated_at=NOW()
         WHERE transfer_code=$2`,
        [data.reason || eventType, transferCode]
      );
      console.warn(`[Webhook] ⚠️ Transfer ${transferCode} ${eventType} — ₦${amountNgn}`);
    } catch (e) {
      console.error("[Webhook] transfer.failed DB error:", e.message);
    }
  }

  // Always 200 — Paystack retries on 5xx
  return NextResponse.json({ received: true, event: eventType });
}
