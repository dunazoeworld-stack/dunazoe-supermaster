import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("sslmode=require") ? { rejectUnauthorized: false } : false,
});

export async function POST(req) {
  try {
    const { token } = await req.json();
    if (token) {
      await pool.query("DELETE FROM sessions WHERE token=$1", [token]).catch(() => {});
    }
    return NextResponse.json({ success: true, message: "Logged out" });
  } catch (err) {
    return NextResponse.json({ success: true, message: "Logged out" });
  }
}
