/**
 * DUNAZOE Ops — Account Activate/Deactivate
 * POST /api/ops/accounts/:userId/activate
 * POST /api/ops/accounts/:userId/deactivate
 * Superuser/admin only.
 */
import { NextResponse } from "next/server";
import { Pool } from "pg";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.DATABASE_URL || "").includes("sslmode=require") ? { rejectUnauthorized: false } : false,
});

const SUPERUSER_EMAILS = ["dunazoeworld@gmail.com", "comfortwins@gmail.com"];

function isOperator(token) {
  try {
    const jwt = token.replace("Bearer ", "").split(".");
    if (jwt.length !== 3) return false;
    const payload = JSON.parse(Buffer.from(jwt[1], "base64").toString("utf8"));
    return payload.role === "admin" || payload.role === "superuser" || SUPERUSER_EMAILS.includes(payload.email);
  } catch { return false; }
}

export async function POST(req, { params: routeParams }) {
  const { userId, action } = await routeParams;
  const token = req.headers.get("Authorization") || "";

  if (!isOperator(token)) {
    return NextResponse.json({ success: false, error: "Superuser access required." }, { status: 403 });
  }

  if (!["activate", "deactivate"].includes(action)) {
    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  }

  const newStatus = action === "activate" ? "active" : "suspended";

  // Try gateway first
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${GATEWAY}/users/${userId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const d = await res.json();
    if (d.success) return NextResponse.json(d);
  } catch (_) {}

  // Direct DB fallback
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ success: false, error: "Database not available." }, { status: 503 });
  }

  try {
    const result = await pool.query(
      "UPDATE users SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id, email, role, status",
      [newStatus, userId]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ success: false, error: "User not found." }, { status: 404 });
    }
    const updated = result.rows[0];
    console.log(`[Ops/Accounts] ${action} user ${userId} (${updated.email}) by operator`);
    return NextResponse.json({
      success: true,
      user_id: userId,
      status:  newStatus,
      action,
      email:   updated.email,
      message: `Account ${action}d successfully.`,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
