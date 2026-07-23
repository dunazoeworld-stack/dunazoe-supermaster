import { NextResponse } from "next/server";
import { Pool } from "pg";
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

export async function PATCH(req) {
  const payload = verify(req);
  if (!payload) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { name, email, phone, state, city, town } = await req.json();
    await pool.query(
      `UPDATE users SET name=COALESCE(NULLIF($1,''),name), email=COALESCE(NULLIF($2,''),email),
       phone=COALESCE(NULLIF($3,''),phone), state=COALESCE(NULLIF($4,''),state),
       city=COALESCE(NULLIF($5,''),city), town=COALESCE(NULLIF($6,''),town)
       WHERE id=$7`,
      [name, email, phone, state, city, town, payload.id]
    );
    return NextResponse.json({ success: true, message: "Profile updated" });
  } catch (err) {
    console.error("[auth/profile]", err.message);
    return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
  }
}
