/**
 * PATCH /api/orders/[id]/status
 * Vendor or admin updates an order's fulfillment status.
 * Emits order:status_update to realtime-service so buyers see changes instantly.
 *
 * Allowed vendor transitions: paid → processing → shipped → delivered
 * Admin can set any status.
 */
import { NextResponse } from "next/server";
import { Pool } from "pg";
import jwt from "jsonwebtoken";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.DATABASE_URL || "").includes("sslmode=require")
    ? { rejectUnauthorized: false } : false,
});

const VENDOR_TRANSITIONS = {
  paid:        ["processing"],
  processing:  ["shipped"],
  shipped:     ["delivered"],
};

async function notifyRealtime(orderId, status, extra = {}) {
  const url    = process.env.REALTIME_SERVICE_URL || "http://localhost:4021";
  const secret = process.env.INTERNAL_SECRET || "dunazoe_internal_shared";
  try {
    await fetch(`${url}/emit/order/${orderId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": secret },
      body: JSON.stringify({
        event: "order:status_update",
        data:  { order_id: orderId, status, updated_at: new Date().toISOString(), ...extra },
      }),
    });
  } catch (_) {} // non-fatal — DB is source of truth
}

export async function PATCH(request, { params }) {
  const { id } = await params;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization") || "";
  const token      = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }

  let caller;
  try {
    caller = jwt.verify(token, process.env.SESSION_SECRET || process.env.JWT_SECRET || "dunazoe_secret");
  } catch {
    return NextResponse.json({ success: false, error: "Invalid token." }, { status: 401 });
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  let body = {};
  try { body = await request.json(); } catch (_) {}
  const { status: newStatus, note } = body;

  if (!newStatus) {
    return NextResponse.json({ success: false, error: "status is required." }, { status: 400 });
  }

  try {
    // ── Fetch the order ───────────────────────────────────────────────────
    const orderRes = await pool.query(
      `SELECT o.*, v.user_id AS vendor_user_id
       FROM orders o
       LEFT JOIN vendors v ON o.vendor_id = v.id
       WHERE o.id = $1`,
      [id]
    );
    if (!orderRes.rows.length) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    }

    const order       = orderRes.rows[0];
    const isAdmin     = ["admin", "superuser"].includes(caller.role);
    const isVendor    = caller.id === order.vendor_user_id;
    const isCustomer  = caller.id === order.customer_id;

    if (!isAdmin && !isVendor && !isCustomer) {
      return NextResponse.json({ success: false, error: "Not authorised." }, { status: 403 });
    }

    // ── Validate transition (vendor only; admin bypasses) ─────────────────
    if (!isAdmin) {
      const allowed = VENDOR_TRANSITIONS[order.status] || [];
      if (!allowed.includes(newStatus)) {
        return NextResponse.json({
          success: false,
          error: `Cannot move order from '${order.status}' to '${newStatus}'. Allowed: ${allowed.join(", ") || "none"}.`,
        }, { status: 422 });
      }
    }

    // ── Update DB ─────────────────────────────────────────────────────────
    await pool.query(
      `UPDATE orders
         SET status = $1, updated_at = NOW()
           ${note ? ", vendor_note = $3" : ""}
       WHERE id = $2`,
      note ? [newStatus, id, note] : [newStatus, id]
    );

    // ── Notify realtime (non-blocking) ────────────────────────────────────
    await notifyRealtime(id, newStatus, { vendor_note: note || null });

    return NextResponse.json({
      success: true,
      order_id: id,
      status: newStatus,
      previous_status: order.status,
      updated_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error("[Orders/Status] Error:", err.message);
    return NextResponse.json({ success: false, error: "Failed to update order status." }, { status: 500 });
  }
}
