"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const STATUS_BADGE = {
  pending: "info", reserved: "warning", processing: "warning",
  shipped: "info", paid: "success", delivered: "success", cancelled: "danger",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("dunazoe_token");
    fetch(`${API}/orders?limit=50`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setOrders(d.orders || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageShell title="My Orders" icon="📦" authRequired={true}
      subtitle="Track and manage all your DUNAZOE orders"
      actions={
        <div style={{ display: "flex", gap: "8px" }}>
          <Link href="/track" className="btn btn-outline btn-sm">📍 Track</Link>
          <Link href="/products" className="btn btn-primary btn-sm">🛒 Shop</Link>
        </div>
      }>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: "90px", borderRadius: "14px" }} />)}
        </div>
      ) : orders.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {orders.map(o => {
            const orderId = `ORD-${String(o.id).padStart(5, "0")}`;
            const canPay = ["pending","reserved"].includes(o.status);
            return (
              <div key={o.id} className="card">
                <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ flex: 1, minWidth: "160px" }}>
                    <p style={{ fontWeight: 700, fontFamily: "monospace" }}>{orderId}</p>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "2px" }}>ID: {o.id}</p>
                    <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                      {o.created_at ? new Date(o.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      {o.items_count && ` · ${o.items_count} item${o.items_count > 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span className={`badge badge-${STATUS_BADGE[o.status] || "muted"}`}>{o.status || "pending"}</span>
                    <span style={{ fontWeight: 800, background: "var(--dz-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                      ₦{parseFloat(o.total || 0).toLocaleString("en-NG")}
                    </span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {canPay && (
                        <Link href={`/orders/${o.id}`} className="btn btn-primary btn-sm" style={{ fontSize: "0.75rem", padding: "5px 12px" }}>💳 Pay</Link>
                      )}
                      <Link href={`/track?order=${o.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: "0.75rem" }}>📍 Track</Link>
                      <Link href={`/orders/${o.id}`} className="btn btn-outline btn-sm" style={{ fontSize: "0.75rem" }}>View →</Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">📦</span>
          <p className="empty-title">No orders yet</p>
          <p className="empty-body">Your orders will appear here once you start shopping.</p>
          <Link href="/products" className="btn btn-primary">Start Shopping</Link>
        </div>
      )}
    </PageShell>
  );
}
