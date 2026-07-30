"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const STATUS_CONFIG = {
  open:         { label: "Open",         badge: "badge-info",    icon: "🔵", desc: "Dispute received and awaiting review" },
  under_review: { label: "Under Review", badge: "badge-warning", icon: "🔍", desc: "Our team is actively investigating" },
  resolved:     { label: "Resolved",     badge: "badge-success", icon: "✅", desc: "Dispute has been resolved" },
  escalated:    { label: "Escalated",    badge: "badge-danger",  icon: "🔺", desc: "Escalated to senior mediation team" },
  closed:       { label: "Closed",       badge: "badge-muted",   icon: "🔒", desc: "Case closed" },
};

function DisputeTimeline({ status, createdAt, updatedAt }) {
  const stages = ["open", "under_review", "resolved"];
  const currentIdx = stages.indexOf(status === "escalated" ? "under_review" : status === "closed" ? "resolved" : status);

  return (
    <div style={{ margin: "12px 0 4px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
      <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Case Timeline
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "0" }}>
        {stages.map((s, i) => {
          const cfg = STATUS_CONFIG[s] || STATUS_CONFIG.open;
          const done = i <= currentIdx;
          const active = i === currentIdx;
          return (
            <div key={s} style={{ display: "flex", alignItems: "center", flex: i < stages.length - 1 ? 1 : 0 }}>
              {/* Node */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.75rem", fontWeight: 700, flexShrink: 0,
                  background: done ? (active ? "var(--dz-gradient)" : "rgba(0,200,150,0.2)") : "var(--surface)",
                  border: `2px solid ${done ? (active ? "var(--dz-blue)" : "var(--success)") : "var(--border)"}`,
                  color: done ? (active ? "#fff" : "var(--success)") : "var(--text-muted)",
                }}>
                  {done ? (active ? cfg.icon : "✓") : "○"}
                </div>
                <span style={{ fontSize: "0.62rem", color: done ? "var(--text-secondary)" : "var(--text-muted)", textAlign: "center", maxWidth: "60px", lineHeight: 1.2 }}>
                  {cfg.label}
                </span>
              </div>
              {/* Connector line */}
              {i < stages.length - 1 && (
                <div style={{ flex: 1, height: "2px", background: i < currentIdx ? "var(--success)" : "var(--border)", margin: "0 4px", marginBottom: "20px" }} />
              )}
            </div>
          );
        })}
      </div>
      {status === "escalated" && (
        <div style={{ marginTop: "8px", padding: "6px 10px", background: "rgba(255,59,92,0.08)", borderRadius: "8px", border: "1px solid rgba(255,59,92,0.2)", fontSize: "0.72rem", color: "var(--danger)" }}>
          🔺 Escalated — senior mediation team has been notified
        </div>
      )}
      <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "8px" }}>
        Opened {createdAt ? new Date(createdAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
        {updatedAt && updatedAt !== createdAt ? ` · Updated ${new Date(updatedAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}` : ""}
      </p>
    </div>
  );
}

export default function DisputesPage() {
  const [disputes,   setDisputes]  = useState([]);
  const [loading,    setLoading]   = useState(true);
  const [showForm,   setShowForm]  = useState(false);
  const [expanded,   setExpanded]  = useState(null);
  const [form,       setForm]      = useState({ order_id: "", reason: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]     = useState("");
  const [success,    setSuccess]   = useState(false);
  const [filter,     setFilter]    = useState("all");

  function load() {
    setLoading(true);
    const token = localStorage.getItem("dunazoe_token");
    fetch(`${API}/disputes`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setDisputes(d.disputes || []))
      .catch(() => setDisputes([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault(); setError(""); setSubmitting(true);
    try {
      const token = localStorage.getItem("dunazoe_token");
      const res = await fetch(`${API}/disputes`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) { setSuccess(true); setShowForm(false); load(); }
      else setError(data.error || "Submission failed.");
    } catch (_) { setError("Connection error. Please try again."); }
    finally { setSubmitting(false); }
  }

  const FILTERS = [
    { id: "all",         label: "All"          },
    { id: "open",        label: "Open"         },
    { id: "under_review",label: "Under Review" },
    { id: "escalated",   label: "Escalated"    },
    { id: "resolved",    label: "Resolved"     },
  ];

  const filtered = filter === "all" ? disputes : disputes.filter(d => d.status === filter);

  return (
    <PageShell title="Disputes" icon="⚖️" authRequired={true}
      subtitle="Raise and track buyer/seller disputes — DUNAZOE mediates all cases"
      actions={<button onClick={() => { setShowForm(!showForm); setSuccess(false); }} className="btn btn-primary btn-sm">+ Raise Dispute</button>}>

      {success && (
        <div className="alert alert-success" style={{ marginBottom: "20px" }}>
          ✅ Dispute submitted successfully. Our team will review it within 24–48 hours.
        </div>
      )}

      {/* Raise dispute form */}
      {showForm && (
        <div className="card" style={{ marginBottom: "32px" }}>
          <div className="card-body">
            <h3 style={{ fontWeight: 700, marginBottom: "16px" }}>Raise a Dispute</h3>
            {error && <div className="alert alert-error" style={{ marginBottom: "12px" }}>⚠️ {error}</div>}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="form-group">
                <label className="form-label">Order ID</label>
                <input className="form-input" value={form.order_id} onChange={e => setForm(f => ({ ...f, order_id: e.target.value }))} placeholder="e.g. ORD-00123" required />
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <select className="form-input" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required>
                  <option value="">Select reason</option>
                  <option value="item_not_received">Item not received</option>
                  <option value="wrong_item">Wrong item delivered</option>
                  <option value="damaged_item">Item arrived damaged</option>
                  <option value="seller_unresponsive">Seller not responding</option>
                  <option value="payment_issue">Payment issue</option>
                  <option value="refund_request">Refund request</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the issue in detail…" required style={{ resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button type="submit" disabled={submitting} className="btn btn-primary">{submitting ? "Submitting…" : "Submit Dispute"}</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "20px", flexWrap: "wrap" }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: "6px 14px", borderRadius: "20px", border: "none", cursor: "pointer",
            fontWeight: 600, fontSize: "0.78rem",
            background: filter === f.id ? "var(--dz-gradient)" : "var(--surface)",
            color: filter === f.id ? "#fff" : "var(--text-secondary)",
          }}>
            {f.label} {f.id !== "all" && <span style={{ opacity: 0.7, marginLeft: "4px", fontSize: "0.72rem" }}>({disputes.filter(d => d.status === f.id).length})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: "100px", borderRadius: "14px" }} />)}
        </div>
      ) : filtered.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filtered.map(d => {
            const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.open;
            const isExpanded = expanded === d.id;
            return (
              <div key={d.id} className="card" style={{ cursor: "pointer" }} onClick={() => setExpanded(isExpanded ? null : d.id)}>
                <div className="card-body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 700, fontFamily: "monospace", fontSize: "0.88rem" }}>
                          DSP-{String(d.id).padStart(5,"0")}
                        </span>
                        <span className={`badge ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>
                      </div>
                      <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                        Order #{d.order_id} · {(d.reason || "—").replace(/_/g, " ")}
                      </p>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {d.created_at ? new Date(d.created_at).toLocaleDateString("en-NG") : "—"}
                      </p>
                    </div>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>{isExpanded ? "▲ Less" : "▼ More"}</span>
                  </div>

                  {/* Expanded detail with timeline */}
                  {isExpanded && (
                    <div onClick={e => e.stopPropagation()}>
                      {d.description && (
                        <div style={{ marginTop: "12px", padding: "10px 12px", background: "var(--surface)", borderRadius: "8px", fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                          {d.description}
                        </div>
                      )}
                      <DisputeTimeline status={d.status} createdAt={d.created_at} updatedAt={d.updated_at} />
                      <div style={{ marginTop: "10px" }} className="alert alert-info">
                        {cfg.icon} <strong>{cfg.label}:</strong> {cfg.desc}. Response time: 24–48 hours.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">⚖️</span>
          <p className="empty-title">{filter === "all" ? "No disputes" : `No ${filter.replace(/_/g," ")} disputes`}</p>
          <p className="empty-body">All clear. If you have an issue with an order, raise a dispute and we'll mediate.</p>
          {filter === "all" && <button onClick={() => setShowForm(true)} className="btn btn-primary">Raise a Dispute</button>}
        </div>
      )}
    </PageShell>
  );
}
