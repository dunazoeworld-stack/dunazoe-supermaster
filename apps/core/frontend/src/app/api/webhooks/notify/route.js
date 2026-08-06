/**
 * POST /api/webhooks/notify
 * Termii delivery-report callback — marks SMS/OTP delivery status.
 * Register this URL in the Termii dashboard as the DLR callback.
 */
import { NextResponse } from "next/server";

export async function POST(request) {
  const TERMII_KEY = process.env.TERMII_API_KEY || "";

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  // Termii sends a token in the payload for verification
  const payloadToken = body?.api_key || body?.token || "";
  if (TERMII_KEY && payloadToken && payloadToken !== TERMII_KEY) {
    console.warn("[Webhook/Notify] ❌ Token mismatch — rejected");
    return NextResponse.json({ received: false }, { status: 401 });
  }

  const { message_id, status, phone_number } = body;
  console.log(`[Webhook/Notify] ▶ DLR id=${message_id} status=${status} to=${phone_number}`);

  // Non-critical: log delivery status — extend here to update DB records
  return NextResponse.json({ received: true });
}

// Termii sometimes sends GET pings for URL validation
export async function GET() {
  return NextResponse.json({ status: "ok", service: "dunazoe-notify-webhook" });
}
