import { NextResponse } from "next/server";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  console.error("[auth/login] FATAL: JWT_SECRET / SESSION_SECRET not set. Auth endpoint will reject all requests.");
}
const SESSION_DAYS = 7;

function issueToken(user_id, role) {
  return jwt.sign({ id: user_id, role }, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
}

async function saveSession(user_id, role, token) {
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_DAYS);
  try {
    await pool.query(
      "INSERT INTO sessions(token,user_id,role,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT(token) DO NOTHING",
      [token, user_id, role, expires]
    );
  } catch (_) {}
}

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password)
      return NextResponse.json({ success: false, error: "email and password required" }, { status: 400 });

    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1 AND is_active=TRUE", [email]
    );
    if (result.rows.length === 0)
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match)
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });

    await pool.query("UPDATE users SET last_seen=NOW() WHERE id=$1", [user.id]).catch(() => {});

    const token = issueToken(user.id, user.role);
    await saveSession(user.id, user.role, token);

    return NextResponse.json({
      success: true,
      message: "Login successful",
      user_id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token,
    });

  } catch (err) {
    console.error("[auth/login]", err.message);
    if (err.message?.includes("relation") && err.message?.includes("does not exist")) {
      return NextResponse.json({ success: false, error: "Database not set up yet. Please contact support." }, { status: 503 });
    }
    return NextResponse.json({ success: false, error: "Login failed. Please try again." }, { status: 500 });
  }
}
