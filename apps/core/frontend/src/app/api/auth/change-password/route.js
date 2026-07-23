import { NextResponse } from "next/server";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;

function verify(req) {
  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!token || !JWT_SECRET) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch (_) { return null; }
}

export async function POST(req) {
  const payload = verify(req);
  if (!payload) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { current_password, new_password } = await req.json();
    if (!current_password || !new_password)
      return NextResponse.json({ success: false, error: "Both current and new password are required" }, { status: 400 });
    if (new_password.length < 8)
      return NextResponse.json({ success: false, error: "New password must be at least 8 characters" }, { status: 400 });

    const result = await pool.query("SELECT password_hash FROM users WHERE id=$1", [payload.id]);
    if (!result.rows.length)
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

    const match = await bcrypt.compare(current_password, result.rows[0].password_hash);
    if (!match)
      return NextResponse.json({ success: false, error: "Current password is incorrect" }, { status: 401 });

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query("UPDATE users SET password_hash=$1 WHERE id=$2", [hash, payload.id]);

    return NextResponse.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    console.error("[change-password]", err.message);
    return NextResponse.json({ success: false, error: "Failed to change password" }, { status: 500 });
  }
}
