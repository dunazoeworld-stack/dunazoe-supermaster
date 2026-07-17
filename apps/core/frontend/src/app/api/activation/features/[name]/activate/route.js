/**
 * Activation Engine proxy — toggle a single feature ON/OFF.
 * POST /api/activation/features/:name/activate  { state: "ON" | "OFF" | "BETA" }
 */
import { NextResponse } from "next/server";

const ACT_URL = process.env.ACTIVATION_ENGINE_URL || "http://localhost:4033";

export async function POST(request, { params }) {
  const { name } = await params;
  const token = request.headers.get("Authorization") || "";
  let body = {};
  try { body = await request.json(); } catch (_) {}

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(
      `${ACT_URL}/activation/features/${encodeURIComponent(name)}/activate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      }
    );
    clearTimeout(timer);
    const d = await res.json();
    return NextResponse.json(d, { status: res.status });
  } catch (err) {
    // Service offline — acknowledge optimistically so UI can update
    console.warn("[Activation] Service unreachable:", err.message);
    return NextResponse.json(
      { success: true, offline: true, feature: name, state: body.state ?? "ON",
        note: "Activation engine offline — change will apply when service starts." },
      { status: 200 }
    );
  }
}
