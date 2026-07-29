/**
 * DUNAZOE — KYC API catch-all proxy
 * Routes: /api/kyc/*  →  gateway/kyc/*  →  kyc-service (port 4023)
 *
 * Handles:
 *   GET  /api/kyc/status           — user KYC level + limits
 *   POST /api/kyc/verify-bvn       — BVN/NIN identity hash
 *   POST /api/kyc/submit-id        — gov ID + selfie URLs for review
 *   POST /api/kyc/approve/:user_id — admin approval
 *   GET  /api/kyc/bank-accounts    — list user's bank accounts
 *   POST /api/kyc/bank-accounts    — register bank account for withdrawal
 */
import { NextResponse } from "next/server";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";

async function proxyKyc(req, { params }) {
  const path    = (await params).path || [];
  const subPath = path.join("/");
  const url     = `${GATEWAY}/kyc/${subPath}`;
  const token   = req.headers.get("Authorization") || "";

  const opts = {
    method:  req.method,
    headers: { Authorization: token },
  };

  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    opts.headers["Content-Type"] = "application/json";
    try { opts.body = JSON.stringify(await req.json()); } catch (_) {}
  }

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res   = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(timer);
    const data  = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[KYC proxy] Error:", err.message);
    return NextResponse.json(
      { success: false, error: "KYC service temporarily unavailable. Please try again." },
      { status: 503 }
    );
  }
}

export const GET    = proxyKyc;
export const POST   = proxyKyc;
export const PUT    = proxyKyc;
export const DELETE = proxyKyc;
