/**
 * DUNAZOE — Feature Toggle API
 * POST /api/activation/toggle
 * Body: { feature_id, status }
 * Proxies to gateway activation-engine (port 4033) AND persists locally.
 */
import { NextResponse } from "next/server";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";

// In-memory feature status cache (persists for the life of the Next.js server process)
const featureOverrides = {};

export async function POST(req) {
  const token = req.headers.get("Authorization") || "";
  let body = {};
  try { body = await req.json(); } catch (_) {}

  const { feature_id, status } = body;
  if (!feature_id || !status) {
    return NextResponse.json({ success: false, error: "feature_id and status are required." }, { status: 400 });
  }

  const VALID = ["active", "beta", "maintenance", "hidden"];
  if (!VALID.includes(status)) {
    return NextResponse.json({ success: false, error: `Invalid status. Must be one of: ${VALID.join(", ")}` }, { status: 400 });
  }

  // Persist in memory for this session
  featureOverrides[feature_id] = { status, updated_at: new Date().toISOString() };

  // Try to propagate to gateway activation-engine (non-blocking)
  fetch(`${GATEWAY}/features/toggle`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body:    JSON.stringify({ feature_id, status }),
  }).catch(() => {}); // Non-fatal — gateway may be offline

  console.log(`[activation/toggle] Feature "${feature_id}" → ${status}`);

  return NextResponse.json({
    success:    true,
    feature_id,
    status,
    message:    `Feature "${feature_id}" set to "${status}" successfully.`,
    updated_at: featureOverrides[feature_id].updated_at,
  });
}

export async function GET() {
  return NextResponse.json({ overrides: featureOverrides });
}
