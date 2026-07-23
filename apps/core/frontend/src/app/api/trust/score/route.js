import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";

function verify(req) {
  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!token || !JWT_SECRET) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch (_) { return null; }
}

export async function GET(req) {
  const payload = verify(req);
  if (!payload) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${GATEWAY}/trust/score?user_id=${payload.id}`, {
      headers: { Authorization: req.headers.get("Authorization") || "" },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const d = await res.json();
    return NextResponse.json(d, { status: res.status });
  } catch (_) {
    return NextResponse.json({ success: true, score: 0, trust_score: 0, offline: true });
  }
}
