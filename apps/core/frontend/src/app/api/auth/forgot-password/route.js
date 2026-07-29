import { NextResponse } from "next/server";
import crypto from "crypto";
import pool from "../../../../lib/db.js";


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

      const appUrl    = process.env.NEXT_PUBLIC_APP_URL || process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : "https://dunazoe.com";
      const resetLink = `${appUrl}/reset-password?token=${token}`;
      console.log(`[forgot-password] Reset link for ${email}: ${resetLink}`);

      // ── Fire notification (non-blocking) ─────────────────────────────────
      const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";
      fetch(`${GATEWAY}/notifications/send`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          user_id:  user.id,
          channels: ["in_app", "email"],
          title:    "🔐 Password Reset Request",
          message:  `Hi ${user.name || "there"}, we received a request to reset your DUNAZOE password. Click the link to reset: ${resetLink} (expires in 1 hour). If you didn't request this, ignore this message.`,
          email:    email,
          email_subject: "Reset your DUNAZOE password",
          email_html: `<p>Hi ${user.name || "there"},</p><p>We received a password reset request for your DUNAZOE account.</p><p><a href="${resetLink}" style="background:#0066FF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a></p><p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`,
        }),
      }).catch(err => console.warn("[forgot-password] Notification dispatch failed:", err.message));
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
