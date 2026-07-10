"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function OrderDetailPage({ params }) {
  const { id } = params;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("dunazoe_token");
    fetch(`${API}/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.order || d.success) setOrder(d.order || d); else setError("Order not found."); })
      .catch(() => setError("Failed to load order."))
      .finally(() => setLoading(false));
  }, [id]);

  const STATUS_MAP = { pending: "info", processing: "warning", shipped: "info", delivered: "success", cancelled: "danger" };

  return (
    <PageShell title={`Order #${id}`} icon="📦" authRequired={true}
      breadcrumb={[{ href: "/orders", label: "Orders" }, { label: `#${id}` }]}>
      {loading ? <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}><div className="dz-spinner" /></div>
        : error ? (
          <div className="empty-state">
            <span className="empty-icon">❌</span>
            <p className="empty-title">Order not found</p>
            <p className="empty-body">{error}</p>
            <Link href="/orders" className="btn btn-primary">View All Orders</Link>
          </div>
        ) : order ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div className="card">
              <div className="card-body">
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: "1.1rem" }}>Order #{order.id || id}</p>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{order.created_at ? new Date(order.created_at).toLocaleString("en-NG") : "—"}</p>
                  </div>
                  <span className={`badge badge-${STATUS_MAP[order.status] || "muted"}`} style={{ fontSize: "0.88rem", padding: "6px 14px" }}>{order.status || "pending"}</span>
                </div>
                {order.delivery_address && (
                  <div style={{ padding: "12px", background: "var(--surface)", borderRadius: "10px", fontSize: "0.85rem" }}>
                    <p style={{ color: "var(--text-secondary)", marginBottom: "2px" }}>Delivery to:</p>
                    <p style={{ fontWeight: 600 }}>{order.delivery_address}</p>
                  </div>
                )}
              </div>
            </div>
            {order.items && order.items.length > 0 && (
              <div className="card">
                <div className="card-body">
                  <p style={{ fontWeight: 700, marginBottom: "14px" }}>Items</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {order.items.map((item, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px", background: "var(--surface)", borderRadius: "10px" }}>
                        <span style={{ fontSize: "0.88rem" }}>{item.name} × {item.qty || 1}</span>
                        <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>₦{(parseFloat(item.price || 0) * (item.qty || 1)).toLocaleString("en-NG")}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px", fontWeight: 800, fontSize: "1.05rem" }}>
                    <span>Total</span>
                    <span className="text-gradient">₦{parseFloat(order.total || 0).toLocaleString("en-NG")}</span>
                  </div>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <Link href="/track" className="btn btn-outline btn-sm">📍 Track Order</Link>
              {order.status !== "delivered" && order.status !== "cancelled" && (
                <Link href="/disputes" className="btn btn-ghost btn-sm">⚖️ Raise Dispute</Link>
              )}
              <Link href="/orders" className="btn btn-ghost btn-sm">← All Orders</Link>
            </div>
          </div>
        ) : null}
    </PageShell>
  );
}
