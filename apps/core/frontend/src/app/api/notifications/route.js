/**
 * Notification proxy — GET user notifications, POST mark-read / read-all.
 * Forwards to notification-service (port 4017).
 * Returns empty array gracefully when the service is offline.
 */
import { NextResponse } from "next/server";

const NOTIF_URL = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:4017";

async function proxyFetch(url, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export async function GET(request) {
  const token = request.headers.get("Authorization") || "";
  const search = new URL(request.url).search;
  try {
    const res = await proxyFetch(`${NOTIF_URL}/notifications${search}`, {
      headers: { Authorization: token },
    });
    const d = await res.json();
    return NextResponse.json(d, { status: res.status });
  } catch (_) {
    // Notification service offline — return empty list so UI loads cleanly
    return NextResponse.json({ success: true, notifications: [], unread: 0, offline: true });
  }
}

export async function POST(request) {
  const token = request.headers.get("Authorization") || "";
  const url = new URL(request.url);

  // Distinguish between:
  //   POST /api/notifications/read-all         → mark all read
  //   POST /api/notifications/:id/read         → mark one read
  const parts = url.pathname.split("/").filter(Boolean);
  // parts: ["api","notifications","read-all"]  or ["api","notifications","<id>","read"]
  const isReadAll = parts[2] === "read-all";

  try {
    if (isReadAll) {
      const res = await proxyFetch(`${NOTIF_URL}/notifications/read-all`, {
        method: "POST",
        headers: { Authorization: token },
      });
      const d = await res.json();
      return NextResponse.json(d, { status: res.status });
    } else {
      const id = parts[2]; // /:id
      const res = await proxyFetch(`${NOTIF_URL}/notifications/${id}/read`, {
        method: "POST",
        headers: { Authorization: token },
      });
      const d = await res.json();
      return NextResponse.json(d, { status: res.status });
    }
  } catch (_) {
    return NextResponse.json({ success: true, offline: true });
  }
}
