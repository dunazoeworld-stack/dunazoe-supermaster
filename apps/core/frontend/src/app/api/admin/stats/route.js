import { NextResponse } from "next/server";
import { Pool } from "pg";
import jwt from "jsonwebtoken";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;

function verifyAdmin(req) {
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "").trim();
    if (!token || !JWT_SECRET) return null;
    const payload = jwt.verify(token, JWT_SECRET);
    if (!["admin", "super_admin", "coordinator"].includes(payload.role)) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

export async function GET(req) {
  // Allow access even without admin token — show zeros for non-admins
  const isAdmin = !!verifyAdmin(req);

  if (!isAdmin) {
    return NextResponse.json({
      success: true,
      stats: {
        total_users: null,
        total_orders: null,
        total_vendors: null,
        total_revenue: null,
        open_disputes: null,
        active_thrift: null,
      },
      restricted: true,
    });
  }

  try {
    const [usersR, ordersR, vendorsR, revenueR] = await Promise.allSettled([
      pool.query("SELECT COUNT(*) AS cnt FROM users WHERE is_active=TRUE"),
      pool.query("SELECT COUNT(*) AS cnt FROM orders"),
      pool.query("SELECT COUNT(*) AS cnt FROM vendors WHERE status='active'"),
      pool.query("SELECT COALESCE(SUM(total),0) AS rev FROM orders WHERE status NOT IN ('cancelled','refunded')"),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        total_users:   usersR.status === "fulfilled"   ? parseInt(usersR.value.rows[0].cnt)    : 0,
        total_orders:  ordersR.status === "fulfilled"  ? parseInt(ordersR.value.rows[0].cnt)   : 0,
        total_vendors: vendorsR.status === "fulfilled" ? parseInt(vendorsR.value.rows[0].cnt)  : 0,
        total_revenue: revenueR.status === "fulfilled" ? parseFloat(revenueR.value.rows[0].rev): 0,
        open_disputes: 0,
        active_thrift: 0,
      },
    });
  } catch (err) {
    console.error("[admin/stats]", err.message);
    // Return zeros rather than crashing the admin page
    return NextResponse.json({
      success: true,
      stats: { total_users: 0, total_orders: 0, total_vendors: 0, total_revenue: 0, open_disputes: 0, active_thrift: 0 },
      error: "Partial data",
    });
  }
}
