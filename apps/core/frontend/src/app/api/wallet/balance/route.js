import { NextResponse } from "next/server";
import { Pool } from "pg";
import jwt from "jsonwebtoken";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;

function verifyToken(req) {
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "").trim();
    if (!token || !JWT_SECRET) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch (_) {
    return null;
  }
}

export async function GET(req) {
  const payload = verifyToken(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Try wallet table first, fall back to 0 if table doesn't exist yet
    const result = await pool.query(
      `SELECT COALESCE(balance_ngn, 0) AS balance
       FROM wallets WHERE user_id = $1 LIMIT 1`,
      [payload.id]
    );

    const balance = result.rows.length > 0 ? parseFloat(result.rows[0].balance) : 0;
    return NextResponse.json({ success: true, balance });
  } catch (err) {
    // wallets table may not exist yet — return 0 gracefully
    if (err.message?.includes("relation") && err.message?.includes("does not exist")) {
      return NextResponse.json({ success: true, balance: 0, offline: true });
    }
    console.error("[wallet/balance]", err.message);
    return NextResponse.json({ success: true, balance: 0, offline: true });
  }
}
