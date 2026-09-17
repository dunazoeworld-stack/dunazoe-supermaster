import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getIceServers, hasTurnConfiguration } from "../../../../lib/turnProvider.js";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "";

function authorized(request) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token || !JWT_SECRET) return false;
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch (_) {
    return false;
  }
}

export async function GET(request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    provider: process.env.TURN_PROVIDER || "coturn",
    ice_servers: getIceServers(),
    turn_configured: hasTurnConfiguration(),
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}