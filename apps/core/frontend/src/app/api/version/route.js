/**
 * DUNAZOE — /api/version
 * Returns current platform version and feature list.
 * Bump BUILD_VERSION env var on every deployment to trigger client update banners.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    version:  process.env.BUILD_VERSION || "2.1.0",
    build:    process.env.BUILD_ID      || "july2026-batch2",
    cache:    "dunazoe-v5",
    updated:  "2026-07-29",
    features: [
      "Chat Widget (REST polling)",
      "Notification Bell",
      "Marketing AI (vendor/admin only)",
      "Full Product Listing with ID search (PRD-XXXXX, VND-XXXXX)",
      "AI Logistics Quote Engine (all 36 NG states + international)",
      "Product Share + Copy Link",
      "Deployment AI Control Panel",
      "Wallet Deposit (Paystack direct fallback)",
      "Wallet Withdraw (bank-verified, single registered account)",
      "Paystack Webhook (charge.success + transfer.success/failed)",
      "Ops Cockpit: Services tab (all 34 microservices)",
      "Ops Cockpit: Accounts tab (activate/deactivate any account)",
      "Service charge 5% (buyer line item, vendor deducted at payout)",
      "Stripe USD payments (requires STRIPE_SECRET_KEY secret)",
      "Cloudinary image upload (requires CLOUDINARY_API_SECRET secret)",
    ],
    secrets_status: {
      cloudinary_upload: Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
      ),
      paystack: Boolean(process.env.PAYSTACK_LSK),
      stripe:   Boolean(process.env.STRIPE_SECRET_KEY),
      database: Boolean(process.env.DATABASE_URL),
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
