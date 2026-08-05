"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const POLL_MS = 15_000; // refresh order list every 15 s

const STATUS_BADGE = {
  pending: "info", reserved: "warning", processing: "warning",
  shipped: "info", paid: "success", delivered: "success", cancelled: "danger",
};

const STATUS_LABEL = {
  pending: "⏳ Pending", reserved: "🔒 Reserved", processing: "⚙️ Processing",
  shipped: "🚚 Shipped", paid: "💳 Paid", delivered: "✅ Delivered", cancelled: "❌ Cancelled",
};

export default function OrdersPage() {
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [lastPoll, setLastPoll] = useState(null);
  const [live,     setLive]     = useState(false);
  const tokenRef               = useRef("");
  const pollRef                = useRef(null);

  const fetchOrders = useCallback(async (token) => {
    try {
      const r = await fetch(`${API}/orders?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const d = await r.json();
      setOrders(prev => {
        const next = d.orders || [];
        // detect any status change for live pulse
        const changed = next.some((o, i) => prev[i]?.status !== o.status);
        if (changed) setLive(true);
        return next;
      });
      setLastPoll(new Date());
    } catch (_) {}
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("dunazoe_token") || "";
    tokenRef.current = token;

    fetchOrders(token).finally(() => setLoading(false));

    // Auto-refresh every 15 s
    pollRef.current = setInterval(() => fetchOrders(tokenRef.current), POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [fetchOrders]);

  // Clear live pulse after 3 s
  useEffect(() => {
    if (!live) return;
    const t = setTimeout(() => setLive(false), 3000);
    return () => clearTimeout(t);
  }, [live]);

  return (
    <PageShell
      title="My Orders"
      icon="📦"
      authRequired={true}
      subtitle="Track and manage all your DUNAZOE orders"
      actions={
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* Live indicator */}
          <div title={lastPoll ? `Last updated ${lastPoll.toLocaleTimeString()}` : "Connecting…"}
            style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.72rem",
              color: live ? "#00CC88" : "#3D4F6E", transition: "color 0.4s" }}>
            <span style={{
              width: "7px", height: "7px", borderRadius: "50%",
              background: live ? "#00CC88" : "#3D4F6E",
              display: "inline-block",
              boxShadow: live ? "0 0 6px #00CC88" : "none",
              transition: "all 0.4s",
            }} />
            LIVE
          </div>
          <Link href="/track"   className="btn btn-outline btn-sm">📍 Track</Link>
          <Link href="/products" className="btn btn-primary btn-sm">🛒 Shop</Link>
        </div>
      }
    >
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton" style={{ height: "90px", borderRadius: "14px" }} />
          ))}
        </div>
      ) : orders.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {orders.map(o => {
            // Strip any existing "ORD-" prefix before padding
            const rawId   = String(o.id).replace(/^ORD-?/i, "");
            const orderId = `ORD-${rawId.padStart(5, "0")}`;
            const canPay  = ["pending", "reserved"].includes(o.status);

            return (
              <div key={o.id} className="card" style={{ transition: "box-shadow 0.3s" }}>
                <div className="card-body" style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", flexWrap: "wrap", gap: "10px",
                }}>
                  <div style={{ flex: 1, minWidth: "160px" }}>
                    <p style={{ fontWeight: 700, fontFamily: "monospace" }}>{orderId}</p>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "2px" }}>
                      {o.vendor_name ? `📦 ${o.vendor_name}` : `ID: ${o.id}`}
                    </p>
                    <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                      {o.created_at
                        ? new Date(o.created_at).toLocaleDateString("en-NG", {
                            day: "numeric", month: "short", year: "numeric",
                          })
                        : "—"}
                      {o.items_count ? ` · ${o.items_count} item${o.items_count > 1 ? "s" : ""}` : ""}
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span className={`badge badge-${STATUS_BADGE[o.status] || "muted"}`}>
                      {STATUS_LABEL[o.status] || o.status || "pending"}
                    </span>
                    <span style={{
                      fontWeight: 800,
                      background: "var(--dz-gradient)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}>
                      ₦{parseFloat(o.total || 0).toLocaleString("en-NG")}
                    </span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {canPay && (
                        <Link href={`/orders/${o.id}`}
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: "0.75rem", padding: "5px 12px" }}>
                          💳 Pay
                        </Link>
                      )}
                      <Link href={`/track?order=${o.id}`}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: "0.75rem" }}>
                        📍 Track
                      </Link>
                      <Link href={`/orders/${o.id}`}
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: "0.75rem" }}>
                        View →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textAlign: "center", marginTop: "4px" }}>
            Updates every 15 s · {lastPoll ? `Last: ${lastPoll.toLocaleTimeString()}` : "Connecting…"}
          </p>
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
