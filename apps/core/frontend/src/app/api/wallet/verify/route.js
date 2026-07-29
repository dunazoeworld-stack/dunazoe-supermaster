/**
 * DUNAZOE — Wallet Deposit Verification
 * GET /api/wallet/verify?ref=DZ-WALLET-xxx
 * Called after Paystack redirects back from payment.
 * Verifies the payment with Paystack → credits user's wallet.
 */
import { NextResponse } from "next/server";

const PAYSTACK_BASE = "https://api.paystack.co";
const GATEWAY       = process.env.GATEWAY_URL || "http://localhost:3000";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("ref") || searchParams.get("reference") || searchParams.get("trxref");
  const token     = req.headers.get("Authorization") || "";

  if (!reference) {
    return NextResponse.json({ success: false, error: "Payment reference required" }, { status: 400 });
  }

  const PAYSTACK_SECRET = process.env.PAYSTACK_LSK || process.env.PAYSTACK_SECRET_KEY || "";
  if (!PAYSTACK_SECRET) {
    return NextResponse.json({ success: false, error: "Payment gateway not configured." }, { status: 503 });
  }

  // 1. Verify with Paystack
  let psData;
  try {
    const psRes = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });
    psData = await psRes.json();
  } catch (err) {
    return NextResponse.json({ success: false, error: "Could not verify payment. Please try again." }, { status: 502 });
  }

  if (!psData.status || psData.data?.status !== "success") {
    return NextResponse.json({
      success:  false,
      error:    `Payment not confirmed. Status: ${psData.data?.status || "unknown"}`,
      ps_status: psData.data?.status,
    }, { status: 402 });
  }

  const amount_ngn = psData.data.amount / 100;

  // 2. Extract user_id from JWT
  let user_id = null;
  try {
    const jwtParts = token.replace("Bearer ", "").split(".");
    if (jwtParts.length === 3) {
      const payload = JSON.parse(Buffer.from(jwtParts[1], "base64").toString("utf8"));
      user_id = payload.id;
    }
  } catch (_) {}

  if (!user_id) {
    return NextResponse.json({ success: false, error: "Authentication required to credit wallet." }, { status: 401 });
  }

  // 3. Credit wallet via gateway → wallet-service
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const walletRes = await fetch(`${GATEWAY}/wallets/deposit`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body:    JSON.stringify({
        user_id,
        amount:    amount_ngn,
        currency:  "NGN",
        reference,
        note:      "Wallet top-up via Paystack",
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const walletData = await walletRes.json();

    if (walletData.success) {
      return NextResponse.json({
        success:      true,
        message:      `₦${amount_ngn.toLocaleString("en-NG")} deposited successfully.`,
        amount_ngn,
        balance_after: walletData.balance_after,
        reference,
      });
    }
    // If already deposited (idempotency)
    if (walletData.error?.toLowerCase().includes("already")) {
      return NextResponse.json({ success: true, message: "Deposit already processed.", amount_ngn, reference });
    }
    return NextResponse.json({ success: false, error: walletData.error || "Failed to credit wallet." }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Wallet credit service unavailable. Contact support with ref: " + reference }, { status: 503 });
  }
}
