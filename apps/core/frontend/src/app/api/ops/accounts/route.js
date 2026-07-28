/**
 * DUNAZOE Ops — Accounts Control Centre API
 * Superuser/admin only. Lists users filtered by role + search.
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

export async function GET(req) {
  const token = req.headers.get("Authorization") || "";
  if (!isOperator(token)) {
    return NextResponse.json({ success: false, error: "Superuser access required." }, { status: 403 });
  }

  const params = new URL(req.url).searchParams;
  const role   = (params.get("role") || "").trim();
  const q      = (params.get("q")    || "").trim();
  const limit  = Math.min(parseInt(params.get("limit") || "50"), 200);

  // Try gateway first
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${GATEWAY}/users?${params.toString()}&limit=${limit}`, {
      headers: { Authorization: token },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const d = await res.json();
    if (d.users || d.accounts) {
      return NextResponse.json({ success: true, accounts: d.users || d.accounts });
    }
  } catch (_) {}

  // Direct DB fallback
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ success: true, accounts: [], offline: true });
  }

  try {
    const conditions = [];
    const values     = [];
    let n = 1;

    if (role && role !== "all") {
      conditions.push(`role = $${n++}`);
      values.push(role);
    }
    if (q) {
      conditions.push(`(LOWER(email) LIKE $${n} OR LOWER(COALESCE(full_name, name, '')) LIKE $${n})`);
      values.push(`%${q.toLowerCase()}%`);
      n++;
    }

    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    values.push(limit);
    const result = await pool.query(
      `SELECT id, email, full_name AS name, role, status, created_at FROM users ${where} ORDER BY created_at DESC LIMIT $${n}`,
      values
    );
    return NextResponse.json({ success: true, accounts: result.rows });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
