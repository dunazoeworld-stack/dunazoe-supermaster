import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

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

  const servers = [{ urls: "stun:stun.l.google.com:19302" }];
  const configuredTurnUrls = [
    process.env.TURN_SERVER_URL,
    ...(process.env.TURN_SERVER_URLS || "").split(","),
  ].map(value => String(value || "").trim()).filter(Boolean);

  for (const urls of configuredTurnUrls) {
    servers.push({
      urls,
      ...(process.env.TURN_USERNAME ? { username: process.env.TURN_USERNAME } : {}),
      ...(process.env.TURN_PASSWORD ? { credential: process.env.TURN_PASSWORD } : {}),
    });
  }

  return NextResponse.json({
    success: true,
    ice_servers: servers,
    turn_configured: servers.length > 1,
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}