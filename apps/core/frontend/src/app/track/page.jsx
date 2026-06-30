"use client";
import { useState } from "react";
import Link from "next/link";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const STATUS_STEPS = ["confirmed", "processing", "shipped", "out_for_delivery", "delivered"];

export default function TrackPage() {
  const [orderId, setOrderId] = useState("");
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleTrack(e) {
    e.preventDefault(); setError(""); setTracking(null);
    if (!orderId.trim()) { setError("Please enter an order ID."); return; }
    setLoading(true);
    try {
      const token = localStorage.getItem("dunazoe_token");
      const res = await fetch(`${API}/orders/${orderId}/track`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success || data.status) setTracking(data);
      else setError(data.error || "Order not found. Check your order ID.");
    } catch (_) { setError("Could not reach tracking service. Please try again."); }
    finally { setLoading(false); }
  }

  const currentStep = tracking ? STATUS_STEPS.indexOf(tracking.status?.toLowerCase()) : -1;

  return (
    <PageShell title="Track Order" icon="📍" authRequired={false}
      subtitle="Real-time order tracking powered by DUNAZOE Express"
      actions={<Link href="/orders" className="btn btn-outline btn-sm">My Orders</Link>}>
      <div className="container-md" style={{ padding: 0 }}>
        <form onSubmit={handleTrack} style={{ display: "flex", gap: "10px", marginBottom: "32px", flexWrap: "wrap" }}>
          <input className="form-input" value={orderId} onChange={e => setOrderId(e.target.value)}
            placeholder="Enter Order ID (e.g. 12345)" style={{ flex: 1, minWidth: "200px" }} />
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? "Tracking…" : "Track →"}
          </button>
        </form>
        {error && <div className="alert alert-error" style={{ marginBottom: "20px" }}>⚠️ {error}</div>}
        {tracking && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div className="card" style={{ background: "linear-gradient(135deg, rgba(0,163,255,0.08), rgba(0,102,255,0.04))" }}>
              <div className="card-body">
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: "1.1rem" }}>Order #{tracking.order_id || orderId}</p>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{tracking.carrier || "DUNAZOE Express"}</p>
                  </div>
                  <span className="badge badge-info" style={{ fontSize: "0.88rem", padding: "6px 14px" }}>{tracking.status || "In Transit"}</span>
                </div>
                {tracking.estimated_delivery && (
                  <p style={{ marginTop: "10px", fontSize: "0.85rem", color: "var(--success)" }}>
                    ✅ Estimated delivery: <strong>{tracking.estimated_delivery}</strong>
                  </p>
                )}
              </div>
            </div>
            <div className="card"><div className="card-body">
              <p style={{ fontWeight: 700, marginBottom: "20px" }}>Delivery Progress</p>
              <div style={{ position: "relative", paddingLeft: "28px" }}>
                {STATUS_STEPS.map((step, i) => (
                  <div key={step} style={{ display: "flex", alignItems: "flex-start", gap: "12px", paddingBottom: i < STATUS_STEPS.length - 1 ? "24px" : 0, position: "relative" }}>
                    {i < STATUS_STEPS.length - 1 && (
                      <div style={{ position: "absolute", left: "-16px", top: "20px", width: "2px", height: "calc(100% - 8px)", background: i < currentStep ? "var(--dz-blue)" : "var(--border)" }} />
                    )}
                    <div style={{
                      position: "absolute", left: "-24px", width: "16px", height: "16px", borderRadius: "50%",
                      background: i <= currentStep ? "var(--dz-gradient)" : "var(--bg-3)",
                      border: `2px solid ${i <= currentStep ? "var(--dz-blue)" : "var(--border)"}`,
                      flexShrink: 0, top: "2px",
                    }} />
                    <div>
                      <p style={{ fontWeight: 600, fontSize: "0.88rem", color: i <= currentStep ? "var(--text)" : "var(--text-muted)" }}>
                        {step.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                      </p>
                      {i === currentStep && tracking.last_update && (
                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{tracking.last_update}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div></div>
            {tracking.events && tracking.events.length > 0 && (
              <div className="card"><div className="card-body">
                <p style={{ fontWeight: 700, marginBottom: "14px" }}>Tracking Events</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {tracking.events.map((ev, i) => (
                    <div key={i} style={{ display: "flex", gap: "12px", fontSize: "0.85rem" }}>
                      <span style={{ color: "var(--text-muted)", minWidth: "80px", flexShrink: 0 }}>{ev.time || "—"}</span>
                      <span style={{ color: "var(--text-secondary)" }}>{ev.message || ev.description}</span>
                    </div>
                  ))}
                </div>
              </div></div>
            )}
          </div>
        )}
        {!tracking && !error && !loading && (
          <div className="empty-state">
            <span className="empty-icon">📍</span>
            <p className="empty-title">Enter your order ID above</p>
            <p className="empty-body">Find your order ID in your confirmation email or in <Link href="/orders" style={{ color: "var(--dz-blue)" }}>My Orders</Link>.</p>
          </div>
        )}
      </div>
    </PageShell>
  );
}
