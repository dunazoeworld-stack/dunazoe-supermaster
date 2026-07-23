/**
 * POST /api/notifications/read-all — mark all notifications read.
 */
import { NextResponse } from "next/server";

const NOTIF_URL = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:4017";

export async function POST(request) {
  const token = request.headers.get("Authorization") || "";
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${NOTIF_URL}/notifications/read-all`, {
      method: "POST",
      headers: { Authorization: token },
      signal: ctrl.signal,
    });
    const d = await res.json();
    return NextResponse.json(d, { status: res.status });
  } catch (_) {
    return NextResponse.json({ success: true, offline: true });
  }
}
