"use client";
/**
 * DUNAZOE Express — Delivery Vendor Operations Hub
 * Route: /deliver
 * For registered DUNAZOE delivery agents:
 * - Register as a delivery agent (can_deliver = true)
 * - View active delivery assignments
 * - Update tracking status with GPS + photo
 * - Track earnings & milestone bonuses
 */
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const STAGES = [
  { id: "confirmed",   icon: "✅", label: "Confirmed",    desc: "Order confirmed, ready for pickup" },
  { id: "picked_up",   icon: "📦", label: "Picked Up",    desc: "Item collected from vendor" },
  { id: "in_transit",  icon: "🚗", label: "In Transit",   desc: "En route to customer" },
  { id: "nearby",      icon: "📍", label: "Nearby",       desc: "Within 500m of destination" },
  { id: "delivered",   icon: "🎉", label: "Delivered",    desc: "Delivered to customer (photo required)" },
];

export default function DeliverPage() {
  const [tab,           setTab]          = useState("assignments");
  const [assignments,   setAssignments]  = useState([]);
  const [loading,       setLoading]      = useState(true);
  const [profile,       setProfile]      = useState(null);
  const [isAgent,       setIsAgent]      = useState(false);

  // Registration form
  const [regForm,       setRegForm]      = useState({
    lat: "", lng: "", pickup_address: "", phone: "", service_area: "local",
  });
  const [regLoading,    setRegLoading]   = useState(false);
  const [regMsg,        setRegMsg]       = useState({ type: "", text: "" });

  // Tracking update
  const [trackForm,     setTrackForm]    = useState({ assignment_id: "", stage: "", photo_url: "" });
  const [trackLoading,  setTrackLoading] = useState(false);
  const [trackMsg,      setTrackMsg]     = useState({ type: "", text: "" });

  // Earnings
  const [earnings,      setEarnings]     = useState({ total_deliveries: 0, pending_payout: 0, total_earned: 0 });

  const token = typeof window !== "undefined" ? localStorage.getItem("dunazoe_token") || "" : "";

  useEffect(() => {
    if (!token) { setLoading(false); return; }

    // Auto-get GPS location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setRegForm(f => ({
          ...f,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        }));
      }, () => {});
    }

    Promise.allSettled([
      fetch(`${API}/delivery/profile`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API}/delivery/assignments?limit=20`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API}/delivery/earnings`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([p, a, e]) => {
      if (p.status === "fulfilled" && p.value?.success) {
        setProfile(p.value.agent);
        setIsAgent(true);
      }
      if (a.status === "fulfilled" && a.value?.assignments) setAssignments(a.value.assignments);
      if (e.status === "fulfilled" && e.value?.total_deliveries !== undefined) setEarnings(e.value);
    }).finally(() => setLoading(false));
  }, [token]);

  async function handleRegister(e) {
    e.preventDefault();
    if (!regForm.lat || !regForm.lng) {
      setRegMsg({ type: "error", text: "Please enable location access or enter your coordinates." });
      return;
    }
    setRegLoading(true); setRegMsg({ type: "", text: "" });
    try {
      const res = await fetch(`${API}/delivery/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          lat:             parseFloat(regForm.lat),
          lng:             parseFloat(regForm.lng),
          pickup_address:  regForm.pickup_address,
          phone:           regForm.phone,
          service_area:    regForm.service_area,
          can_deliver:     true,
        }),
      });
      const d = await res.json();
      if (d.success) {
        setRegMsg({ type: "success", text: d.message || "Registered as delivery agent! You'll receive assignment notifications." });
        setIsAgent(true);
        setProfile(d.agent || {});
        setTab("assignments");
      } else {
        setRegMsg({ type: "error", text: d.error || "Registration failed. Please try again." });
      }
    } catch (_) { setRegMsg({ type: "error", text: "Connection error. Please try again." }); }
    finally { setRegLoading(false); }
  }

  async function updateTracking(e) {
    e.preventDefault();
    if (!trackForm.assignment_id || !trackForm.stage) {
      setTrackMsg({ type: "error", text: "Assignment ID and stage are required." });
      return;
    }
    if (trackForm.stage === "delivered" && !trackForm.photo_url) {
      setTrackMsg({ type: "error", text: "A delivery photo URL is required to mark as delivered." });
      return;
    }
    setTrackLoading(true); setTrackMsg({ type: "", text: "" });
    try {
      const res = await fetch(`${API}/delivery/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          assignment_id: trackForm.assignment_id,
          stage:         trackForm.stage,
          photo_url:     trackForm.photo_url || undefined,
        }),
      });
      const d = await res.json();
      if (d.success) {
        setTrackMsg({ type: "success", text: `✅ Updated to "${trackForm.stage}" successfully.` });
        setTrackForm({ assignment_id: "", stage: "", photo_url: "" });
        // Refresh assignments
        fetch(`${API}/delivery/assignments?limit=20`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(d => { if (d.assignments) setAssignments(d.assignments); })
          .catch(() => {});
      } else {
        setTrackMsg({ type: "error", text: d.error || "Update failed. Please try again." });
      }
    } catch (_) { setTrackMsg({ type: "error", text: "Connection error. Please try again." }); }
    finally { setTrackLoading(false); }
  }

  const TABS = [
    { id: "assignments", icon: "📦", label: "Assignments" },
    { id: "track",       icon: "📍", label: "Update Status" },
    { id: "earnings",    icon: "💰", label: "Earnings" },
    ...(isAgent ? [] : [{ id: "register", icon: "🚀", label: "Register" }]),
  ];

  const statusColor = { pending: "#F59E0B", assigned: "#00A3FF", in_transit: "#8B5CF6", delivered: "#00C896", failed: "#FF3B5C" };

  return (
    <PageShell title="DUNAZOE Express" icon="⚡" authRequired={true}
      subtitle="Delivery Vendor Operations Hub"
      breadcrumb={[{ href: "/dashboard", label: "Dashboard" }, { label: "DUNAZOE Express" }]}>

      {/* Agent Status Banner */}
      {isAgent && profile ? (
        <div className="alert alert-success" style={{ marginBottom: "20px" }}>
          ⚡ Active Delivery Agent · {profile.city || "Nigeria"} ·{" "}
          <span style={{ fontWeight: 700 }}>
            {earnings.total_deliveries} deliveries completed
          </span>
        </div>
      ) : !loading && (
        <div className="alert alert-info" style={{ marginBottom: "20px" }}>
          🚀 Register as a DUNAZOE Express delivery vendor to start earning.{" "}
          <button onClick={() => setTab("register")} style={{ background: "none", border: "none", color: "var(--dz-blue)", cursor: "pointer", fontWeight: 700, textDecoration: "underline" }}>
            Register now →
          </button>
        </div>
      )}

      {/* Tab nav */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 14px", borderRadius: "10px", border: "none", cursor: "pointer",
            fontWeight: 600, fontSize: "0.82rem",
            background: tab === t.id ? "var(--dz-gradient)" : "var(--surface)",
            color: tab === t.id ? "#fff" : "var(--text-secondary)",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}><div className="dz-spinner" /></div>
      ) : (

        /* ── ASSIGNMENTS TAB ───────────────────────────────── */
        tab === "assignments" ? (
          <div>
            {assignments.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📦</span>
                <p className="empty-title">No active assignments</p>
                <p className="empty-body">
                  {isAgent
                    ? "You'll be notified when a delivery is assigned to you."
                    : "Register as a delivery agent to receive assignments."}
                </p>
                {!isAgent && (
                  <button onClick={() => setTab("register")} className="btn btn-primary">
                    🚀 Register as Delivery Agent
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {assignments.map(a => (
                  <div key={a.assignment_id} className="card">
                    <div className="card-body">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                        <div>
                          <p style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "2px" }}>
                            {a.assignment_id}
                          </p>
                          <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                            Order #{a.order_id} · {a.assignment_type === "courier" ? a.courier_name : "DUNAZOE Express"}
                          </p>
                        </div>
                        <span style={{
                          fontSize: "0.72rem", fontWeight: 700, padding: "3px 10px", borderRadius: "999px",
                          background: (statusColor[a.status] || "#888") + "22",
                          color: statusColor[a.status] || "#888",
                          border: `1px solid ${(statusColor[a.status] || "#888")}44`,
                        }}>
                          {a.status}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.82rem" }}>
                        {a.pickup_address && (
                          <p><span style={{ color: "var(--text-muted)" }}>📦 Pickup:</span> {a.pickup_address}</p>
                        )}
                        {a.delivery_address && (
                          <p><span style={{ color: "var(--text-muted)" }}>📍 Deliver to:</span> {a.delivery_address}</p>
                        )}
                        {a.distance_km && (
                          <p><span style={{ color: "var(--text-muted)" }}>📏 Distance:</span> {parseFloat(a.distance_km).toFixed(1)}km</p>
                        )}
                        {a.estimated_cost && (
                          <p><span style={{ color: "var(--text-muted)" }}>💰 Your fee:</span>{" "}
                            <strong style={{ color: "var(--success)" }}>₦{parseFloat(a.estimated_cost).toLocaleString("en-NG")}</strong>
                          </p>
                        )}
                        {a.eta_minutes && a.eta_minutes < 1440 && (
                          <p><span style={{ color: "var(--text-muted)" }}>⏱ ETA:</span> ~{a.eta_minutes} mins</p>
                        )}
                      </div>
                      {a.ai_selection_reason && (
                        <p style={{ fontSize: "0.72rem", color: "var(--dz-blue)", marginTop: "8px" }}>
                          🤖 {a.ai_selection_reason}
                        </p>
                      )}
                      {/* Quick update buttons */}
                      {["assigned","in_transit","nearby"].includes(a.status) && (
                        <div style={{ marginTop: "12px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <button onClick={() => {
                            const next = a.status === "assigned" ? "picked_up"
                              : a.status === "in_transit" ? "nearby"
                              : "delivered";
                            setTrackForm({ assignment_id: a.assignment_id, stage: next, photo_url: "" });
                            setTab("track");
                          }} className="btn btn-primary btn-sm">
                            📍 Update Status →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        /* ── UPDATE STATUS TAB ─────────────────────────────── */
        ) : tab === "track" ? (
          <div>
            {trackMsg.text && (
              <div className={`alert alert-${trackMsg.type === "success" ? "success" : "error"}`} style={{ marginBottom: "16px" }}>
                {trackMsg.text}
              </div>
            )}
            <div className="card"><div className="card-body">
              <h3 style={{ fontWeight: 700, marginBottom: "16px" }}>📍 Update Delivery Status</h3>
              <form onSubmit={updateTracking} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="form-group">
                  <label className="form-label">Assignment ID *</label>
                  <input className="form-input" required value={trackForm.assignment_id}
                    onChange={e => setTrackForm(f => ({ ...f, assignment_id: e.target.value }))}
                    placeholder="e.g. LOGISTICS_OP_xxx" />
                </div>
                <div className="form-group">
                  <label className="form-label">Delivery Stage *</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {STAGES.map(s => (
                      <label key={s.id} style={{
                        display: "flex", gap: "10px", alignItems: "flex-start", padding: "10px 12px",
                        borderRadius: "10px", cursor: "pointer",
                        border: `1.5px solid ${trackForm.stage === s.id ? "var(--dz-blue)" : "var(--border)"}`,
                        background: trackForm.stage === s.id ? "rgba(0,163,255,0.08)" : "transparent",
                      }}>
                        <input type="radio" name="stage" value={s.id}
                          checked={trackForm.stage === s.id}
                          onChange={() => setTrackForm(f => ({ ...f, stage: s.id }))}
                          style={{ accentColor: "var(--dz-blue)", marginTop: "2px" }} />
                        <div>
                          <p style={{ fontWeight: 600, fontSize: "0.85rem" }}>{s.icon} {s.label}</p>
                          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{s.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {trackForm.stage === "delivered" && (
                  <div className="form-group">
                    <label className="form-label">Delivery Photo URL * (required for delivery confirmation)</label>
                    <input className="form-input" type="url" required
                      value={trackForm.photo_url}
                      onChange={e => setTrackForm(f => ({ ...f, photo_url: e.target.value }))}
                      placeholder="https://… (photo of delivered package at door)" />
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      Take a photo of the delivery and upload it to get a URL (e.g. WhatsApp → copy image link).
                    </p>
                  </div>
                )}

                <button type="submit" disabled={trackLoading} className="btn btn-primary">
                  {trackLoading ? "Updating…" : "📍 Update Tracking Status"}
                </button>
              </form>
            </div></div>
          </div>

        /* ── EARNINGS TAB ──────────────────────────────────── */
        ) : tab === "earnings" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {[
                { label: "Total Deliveries", value: earnings.total_deliveries, icon: "📦", color: "var(--dz-blue)" },
                { label: "Total Earned (₦)", value: `₦${(earnings.total_earned||0).toLocaleString("en-NG")}`, icon: "💰", color: "var(--success)" },
                { label: "Pending Payout",   value: `₦${(earnings.pending_payout||0).toLocaleString("en-NG")}`, icon: "⏳", color: "var(--warning)" },
                { label: "Next Milestone",   value: `${100 - ((earnings.total_deliveries||0) % 100)} deliveries`, icon: "🏆", color: "#8B5CF6" },
              ].map(s => (
                <div key={s.label} className="stat-tile">
                  <span style={{ fontSize: "1.6rem", display: "block", marginBottom: "6px" }}>{s.icon}</span>
                  <p className="stat-value" style={{ background: "none", WebkitTextFillColor: s.color, fontSize: "1.4rem" }}>{s.value}</p>
                  <p className="stat-label">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="alert alert-info">
              🏆 Earn <strong>₦5,000 milestone bonus</strong> every 100 completed deliveries.{" "}
              <strong>2% commission</strong> on every delivery fee. Payouts processed within 24 hours of delivery confirmation.
            </div>
            <div className="card"><div className="card-body">
              <p style={{ fontWeight: 700, marginBottom: "12px" }}>💡 Commission Structure</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.85rem" }}>
                {[
                  ["Local delivery (same city)", "₦500 base + ₦50/km"],
                  ["Inter-state via courier", "2% of delivery fee"],
                  ["Pickup station coordination", "₦500 flat"],
                  ["Milestone bonus (every 100)", "₦5,000 credited to wallet"],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--surface)", borderRadius: "8px" }}>
                    <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                    <strong style={{ color: "var(--success)" }}>{val}</strong>
                  </div>
                ))}
              </div>
            </div></div>
          </div>

        /* ── REGISTER TAB ──────────────────────────────────── */
        ) : (
          <div>
            {regMsg.text && (
              <div className={`alert alert-${regMsg.type === "success" ? "success" : "error"}`} style={{ marginBottom: "16px" }}>
                {regMsg.type === "success" ? "✅ " : "⚠️ "}{regMsg.text}
              </div>
            )}
            <div className="card"><div className="card-body">
              <h3 style={{ fontWeight: 700, marginBottom: "4px" }}>🚀 Become a DUNAZOE Delivery Agent</h3>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "16px" }}>
                Earn 2% commission on every delivery + ₦5,000 milestone bonus every 100 deliveries.
                DUNAZOE Express uses a Delivery Vendor First policy — you get priority over courier services.
              </p>
              <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="form-group">
                    <label className="form-label">Latitude (auto-detected)</label>
                    <input className="form-input" type="number" step="0.000001" required
                      value={regForm.lat} onChange={e => setRegForm(f => ({ ...f, lat: e.target.value }))}
                      placeholder="e.g. 6.5244" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Longitude (auto-detected)</label>
                    <input className="form-input" type="number" step="0.000001" required
                      value={regForm.lng} onChange={e => setRegForm(f => ({ ...f, lng: e.target.value }))}
                      placeholder="e.g. 3.3792" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Your Pickup Address *</label>
                  <input className="form-input" required value={regForm.pickup_address}
                    onChange={e => setRegForm(f => ({ ...f, pickup_address: e.target.value }))}
                    placeholder="e.g. 15 Bode Thomas Street, Surulere, Lagos" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input className="form-input" type="tel" required value={regForm.phone}
                    onChange={e => setRegForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="e.g. 08012345678" />
                </div>
                <div className="form-group">
                  <label className="form-label">Service Area</label>
                  <select className="form-input" value={regForm.service_area}
                    onChange={e => setRegForm(f => ({ ...f, service_area: e.target.value }))}>
                    <option value="local">Local (same city only)</option>
                    <option value="regional">Regional (same state, 50km radius)</option>
                    <option value="sw_nigeria">South-West Nigeria (Lagos, Ogun, Oyo, Osun, Ondo, Ekiti)</option>
                    <option value="nationwide">Nationwide (all 36 states)</option>
                  </select>
                </div>
                <div className="alert alert-info" style={{ fontSize: "0.78rem" }}>
                  ✅ By registering, you agree to: maintain a 30-minute response time on assigned deliveries,
                  upload delivery photo proof for every completed order, and maintain a 4.5+ star rating.
                  Assignments within 50km of your location will be offered to you first.
                </div>
                <button type="submit" disabled={regLoading} className="btn btn-primary btn-lg" style={{ justifyContent: "center" }}>
                  {regLoading ? "Registering…" : "⚡ Register as Delivery Agent"}
                </button>
              </form>
            </div></div>
          </div>
        )
      )}
    </PageShell>
  );
}
