"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const STATUS_BADGE = { pending: "info", processing: "warning", shipped: "info", delivered: "success", cancelled: "danger" };

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
      actions={<Link href="/products" className="btn btn-primary btn-sm">🛒 Shop</Link>}>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: "80px", borderRadius: "14px" }} />)}
        </div>
      ) : orders.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {orders.map(o => (
            <Link key={o.id} href={`/orders/${o.id}`} className="card" style={{ textDecoration: "none", display: "block" }}>
              <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <p style={{ fontWeight: 700 }}>Order #{o.id}</p>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    {o.created_at ? new Date(o.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    {o.items_count && ` · ${o.items_count} item${o.items_count > 1 ? "s" : ""}`}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span className={`badge badge-${STATUS_BADGE[o.status] || "muted"}`}>{o.status || "pending"}</span>
                  <span style={{ fontWeight: 800, background: "var(--dz-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    ₦{parseFloat(o.total || 0).toLocaleString("en-NG")}
                  </span>
                  <span style={{ color: "var(--dz-blue)", fontSize: "0.85rem" }}>View →</span>
                </div>
              </div>
            </Link>
          ))}
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
