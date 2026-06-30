"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function DisputesPage() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ order_id: "", reason: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("dunazoe_token");
    fetch(`${API}/disputes`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setDisputes(d.disputes || []))
      .catch(() => setDisputes([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault(); setError(""); setSubmitting(true);
    try {
      const token = localStorage.getItem("dunazoe_token");
      const res = await fetch(`${API}/disputes`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) { setSuccess(true); setShowForm(false); }
      else setError(data.error || "Submission failed.");
    } catch (_) { setError("Connection error. Please try again."); }
    finally { setSubmitting(false); }
  }

  const STATUS_BADGE = { open: "warning", under_review: "info", resolved: "success", closed: "muted", escalated: "danger" };

  return (
    <PageShell title="Disputes" icon="⚖️" authRequired={true}
      subtitle="Raise and manage buyer/seller disputes — DUNAZOE mediates all cases"
      actions={<button onClick={() => { setShowForm(!showForm); setSuccess(false); }} className="btn btn-primary btn-sm">+ Raise Dispute</button>}>
      {success && <div className="alert alert-success" style={{ marginBottom: "20px" }}>✅ Dispute submitted successfully. Our team will review it within 24–48 hours.</div>}
      {showForm && (
        <div className="card" style={{ marginBottom: "32px" }}>
          <div className="card-body">
            <h3 style={{ fontWeight: 700, marginBottom: "16px" }}>Raise a Dispute</h3>
            {error && <div className="alert alert-error" style={{ marginBottom: "12px" }}>⚠️ {error}</div>}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="form-group">
                <label className="form-label">Order ID</label>
                <input className="form-input" type="text" value={form.order_id} onChange={e => setForm(f => ({ ...f, order_id: e.target.value }))} placeholder="e.g. 12345" required />
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
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1,2].map(i => <div key={i} className="skeleton" style={{ height: "80px", borderRadius: "14px" }} />)}
        </div>
      ) : disputes.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {disputes.map(d => (
            <div key={d.id} className="card">
              <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <p style={{ fontWeight: 700 }}>Dispute #{d.id}</p>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Order #{d.order_id} · {d.reason?.replace(/_/g, " ") || "—"}</p>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{d.created_at ? new Date(d.created_at).toLocaleDateString("en-NG") : "—"}</p>
                </div>
                <span className={`badge badge-${STATUS_BADGE[d.status] || "muted"}`}>{(d.status || "open").replace(/_/g, " ")}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">⚖️</span>
          <p className="empty-title">No disputes</p>
          <p className="empty-body">All clear. If you have an issue with an order, raise a dispute and we'll mediate.</p>
          <button onClick={() => setShowForm(true)} className="btn btn-primary">Raise a Dispute</button>
        </div>
      )}
    </PageShell>
  );
}
