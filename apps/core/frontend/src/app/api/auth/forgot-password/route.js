import { NextResponse } from "next/server";
import { Pool } from "pg";
import crypto from "crypto";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email)
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });

    // Check user exists — always respond success to prevent email enumeration
    const result = await pool.query(
      "SELECT id, name FROM users WHERE email=$1 AND is_active=TRUE",
      [email]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store reset token in sessions table with a recognisable role prefix
      await pool.query(
        `INSERT INTO sessions(token, user_id, role, expires_at)
         VALUES($1, $2, $3, $4) ON CONFLICT(token) DO NOTHING`,
        [`pwd_reset_${token}`, user.id, "password_reset", expires]
      ).catch(() => {});

      // In production you'd send an email here. For now log to server console.
      const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || ""}/reset-password?token=${token}`;
      console.log(`[forgot-password] Reset link for ${email}: ${resetLink}`);
    }

    // Always return success (anti-enumeration)
    return NextResponse.json({
      success: true,
      message: "If that email is registered, a reset link has been sent.",
    });
  } catch (err) {
    console.error("[forgot-password]", err.message);
    return NextResponse.json({ success: false, error: "Request failed. Please try again." }, { status: 500 });
  }
}
