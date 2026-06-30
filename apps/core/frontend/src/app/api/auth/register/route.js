import { NextResponse } from "next/server";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "dunazoe_secret_change_in_prod";
const SALT_ROUNDS = 12;
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
    const { name, email, password, phone, role, business_name, whatsapp, state, city, town } = await req.json();

    if (!name || !email || !password)
      return NextResponse.json({ success: false, error: "name, email, and password are required" }, { status: 400 });

    if (password.length < 6)
      return NextResponse.json({ success: false, error: "Password must be at least 6 characters" }, { status: 400 });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return NextResponse.json({ success: false, error: "Invalid email format" }, { status: 400 });

    const existing = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (existing.rows.length > 0)
      return NextResponse.json({ success: false, error: "Email already registered" }, { status: 409 });

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const safe_role = ["customer", "vendor", "agent", "admin", "coordinator"].includes(role) ? role : "customer";

    const result = await pool.query(
      `INSERT INTO users(name,email,phone,whatsapp,password_hash,role,state,city,town)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,name,email,role,created_at`,
      [name, email, phone || null, whatsapp || phone || null, password_hash, safe_role, state || null, city || null, town || null]
    );
    const user = result.rows[0];

    if (safe_role === "vendor" && business_name) {
      await pool.query(
        `INSERT INTO vendors(user_id, business_name) VALUES($1,$2) ON CONFLICT DO NOTHING`,
        [user.id, business_name]
      ).catch(() => {});
    }

    const token = issueToken(user.id, user.role);
    await saveSession(user.id, user.role, token);

    return NextResponse.json({
      success: true,
      message: "Registration successful",
      user_id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token,
    }, { status: 201 });

  } catch (err) {
    console.error("[auth/register]", err.message);
    if (err.message?.includes("relation") && err.message?.includes("does not exist")) {
      return NextResponse.json({ success: false, error: "Database not set up yet. Please contact support." }, { status: 503 });
    }
    return NextResponse.json({ success: false, error: "Registration failed. Please try again." }, { status: 500 });
  }
}
