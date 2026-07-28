import { NextResponse } from "next/server";
import pool from "../../../../lib/db.js";


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
