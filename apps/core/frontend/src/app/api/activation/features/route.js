/**
 * Activation Engine proxy — GET all feature states.
 * Forwards to activation-engine service (port 4033).
 * When the service is offline, returns 14 mock features so the UI loads gracefully.
 */
import { NextResponse } from "next/server";

const ACT_URL = process.env.ACTIVATION_ENGINE_URL || "http://localhost:4033";

const MOCK_FEATURES = [
  { name: "ajo_savings",          state: "ON",   description: "Rotating credit/savings groups (Ajo)" },
  { name: "chat_widget",          state: "ON",   description: "In-app vendor–buyer chat (REST polling)" },
  { name: "notification_bell",    state: "ON",   description: "Real-time notification bell + badge" },
  { name: "marketing_ai",         state: "ON",   description: "AI-generated promo copy for vendors" },
  { name: "product_ai",           state: "ON",   description: "AI price optimiser & demand forecast" },
  { name: "logistics_self",       state: "ON",   description: "Self-delivery zones for vendors" },
  { name: "share_button",         state: "ON",   description: "Native share + WhatsApp product share" },
  { name: "deployment_ai",        state: "ON",   description: "5-gate deployment audit engine" },
  { name: "update_notifier",      state: "ON",   description: "SW update banner & version polling" },
  { name: "site_tests",           state: "BETA", description: "Automated site health checks" },
  { name: "activation_engine",    state: "ON",   description: "This feature-flag system" },
  { name: "stae",                 state: "ON",   description: "System Traffic & Autoscaling Engine" },
  { name: "multi_image_upload",   state: "ON",   description: "Multi-image product listing (Cloudinary)" },
  { name: "offline_queue",        state: "BETA", description: "Upload queue drains on reconnect" },
];

export async function GET(request) {
  const token = request.headers.get("Authorization") || "";
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${ACT_URL}/activation/features`, {
      headers: { Authorization: token },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const d = await res.json();
    return NextResponse.json({ success: true, features: d.features ?? d, offline: false }, { status: 200 });
  } catch (_) {
    // Service offline — return mock data so the UI renders
    return NextResponse.json({ success: true, features: MOCK_FEATURES, offline: true }, { status: 200 });
  }
}
