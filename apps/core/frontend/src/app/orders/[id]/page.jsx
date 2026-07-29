"use client";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import PageShell from "../../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function OrderDetailPage({ params }) {
  const { id } = use(params);
  const [order, setOrder]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [paying, setPaying]   = useState(false);
  const [payError, setPayError] = useState("");
  const [user, setUser]       = useState(null);

  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem("dunazoe_user") || "{}"); setUser(u); } catch (_) {}

    // If the ID looks like a local/fake order (starts with "ORD-" and has no numeric DB id),
    // try to find it in localStorage first, then fall back to showing a pending-payment state.
    const isLocalOrder = id && (String(id).startsWith("ORD-") || isNaN(parseInt(id)));
    if (isLocalOrder) {
      // Check if order is in local history
      try {
        const localOrders = JSON.parse(localStorage.getItem("dunazoe_pending_orders") || "[]");
        const found = localOrders.find(o => String(o.order_id) === String(id) || String(o.id) === String(id));
        if (found) {
          setOrder({ ...found, status: found.status || "pending", id: found.order_id || found.id });
          setLoading(false);
          return;
        }
      } catch (_) {}
      // Show friendly pending state
      setOrder({
        id,
        status: "pending",
        amount: 0,
        delivery_address: "",
        created_at: new Date().toISOString(),
        _is_local: true,
      });
      setLoading(false);
      return;
    }

    const token = localStorage.getItem("dunazoe_token");
    fetch(`${API}/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.order || d.success) {
          setOrder(d.order || d);
        } else if (d.offline) {
          setError("Order service is temporarily offline. Please check your orders list shortly.");
        } else {
          setError("Order not found. It may still be processing.");
        }
      })
      .catch(() => setError("Failed to load order. Please check your internet connection."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handlePay() {
    if (!order || !user) return;
    setPaying(true); setPayError("");
    try {
      const token = localStorage.getItem("dunazoe_token");
      const amount = parseFloat(order.total || order.amount || 0);
      const email  = user.email || order.customer_email || "";
      if (!email) { setPayError("No email found on your account."); setPaying(false); return; }

      const res = await fetch(`${API}/payments/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount, email,
          order_id:      id,
          customer_name: user.name || "",
          cart_items:    order.items || [],
          callback_url:  `${window.location.origin}/payment/verify?ref=DZ-ORD-${id}-${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        setPayError(data.error || "Payment initiation failed. Please try again.");
      }
    } catch (_) {
      setPayError("Connection error. Please check your internet and try again.");
    } finally { setPaying(false); }
  }

  const STATUS_MAP = { pending: "info", reserved: "warning", processing: "warning", shipped: "info", paid: "success", delivered: "success", cancelled: "danger" };
  const canPay = order && ["pending","reserved"].includes(order.status);
  const orderId = `ORD-${String(id).padStart(5, "0")}`;
  const paymentId = order?.paystack_ref || order?.payment_reference || order?.payment_id;

  return (
    <PageShell title={orderId} icon="📦" authRequired={true}
      breadcrumb={[{ href: "/orders", label: "Orders" }, { label: orderId }]}>
      {loading
        ? <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}><div className="dz-spinner" /></div>
        : error ? (
          <div className="empty-state">
            <span className="empty-icon">❌</span>
            <p className="empty-title">Order not found</p>
            <p className="empty-body">{error}</p>
            <Link href="/orders" className="btn btn-primary">View All Orders</Link>
          </div>
        ) : order ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Local/pending order notice */}
            {order._is_local && (
              <div className="alert alert-warning">
                ⏳ Your order is being processed. If payment was completed, it will appear here shortly.
                Check your <Link href="/orders" style={{ color: "var(--dz-blue)", fontWeight: 700 }}>orders list</Link> for updates,
                or check your email for a payment confirmation.
              </div>
            )}

            {/* Order header */}
            <div className="card">
              <div className="card-body">
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: "1.15rem" }}>{orderId}</p>
                    <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "monospace" }}>ID: {id}</p>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                      {order.created_at ? new Date(order.created_at).toLocaleString("en-NG") : "—"}
                    </p>
                  </div>
                  <span className={`badge badge-${STATUS_MAP[order.status] || "muted"}`} style={{ fontSize: "0.88rem", padding: "6px 14px", alignSelf: "flex-start" }}>
                    {order.status || "pending"}
                  </span>
                </div>

                {/* Payment Reference */}
                {paymentId && (
                  <div style={{ padding: "10px 14px", background: "var(--surface)", borderRadius: "10px", marginBottom: "12px" }}>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "2px" }}>💳 Payment Reference</p>
                    <p style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.85rem", color: "var(--dz-blue)" }}>{paymentId}</p>
                  </div>
                )}

                {order.delivery_address && (
                  <div style={{ padding: "12px", background: "var(--surface)", borderRadius: "10px", fontSize: "0.85rem" }}>
                    <p style={{ color: "var(--text-secondary)", marginBottom: "2px" }}>📍 Delivery to:</p>
                    <p style={{ fontWeight: 600 }}>{order.delivery_address}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Items */}
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
                    <span className="text-gradient">₦{parseFloat(order.total || order.amount || 0).toLocaleString("en-NG")}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Pay error */}
            {payError && <div className="alert alert-error">⚠️ {payError}</div>}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {canPay && (
                <button onClick={handlePay} disabled={paying} className="btn btn-primary btn-lg" style={{ minWidth: "140px" }}>
                  {paying ? "Initialising…" : `💳 Pay ₦${parseFloat(order.total || order.amount || 0).toLocaleString("en-NG")}`}
                </button>
              )}
              <Link href={`/track?order=${id}`} className="btn btn-outline btn-sm">📍 Track Order</Link>
              {order.status !== "delivered" && order.status !== "cancelled" && (
                <Link href="/disputes" className="btn btn-ghost btn-sm">⚖️ Raise Dispute</Link>
              )}
              <Link href="/orders" className="btn btn-ghost btn-sm">← All Orders</Link>
            </div>

            {/* Trust badge */}
            <div style={{ padding: "10px 14px", background: "rgba(0,200,150,0.06)", borderRadius: "10px", fontSize: "0.78rem", color: "var(--success)" }}>
              🔒 DUNAZOE Escrow Protected · Your funds are held securely until delivery is confirmed
            </div>
          </div>
        ) : null}
    </PageShell>
  );
}
