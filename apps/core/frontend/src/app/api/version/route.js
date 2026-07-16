/**
 * DUNAZOE — /api/version
 * Returns the current platform version.
 * Bump BUILD_VERSION env var on every deployment to trigger client update banners.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    version: process.env.BUILD_VERSION || "2.0.0",
    build:   process.env.BUILD_ID     || "latest",
    cache:   "dunazoe-v4",
    updated: "2026-07-16",
    features: [
      "Chat Widget (REST polling)",
      "Notification Bell",
      "Marketing AI",
      "Full Product Listing",
      "Logistics Provider Selector",
      "Product Share Button",
      "Deployment AI Control Panel",
    ],
  }, { headers: { "Cache-Control": "no-store" } });
}
