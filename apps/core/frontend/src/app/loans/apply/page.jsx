"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function LoanApplyPage() {
  const [form, setForm] = useState({ amount: "", purpose: "", duration: "30", monthly_income: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [offline, setOffline] = useState(false);
  const [trustOk, setTrustOk] = useState(null);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const token = localStorage.getItem("dunazoe_token");
    fetch(`${API}/trust/score`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { const s = d.score ?? d.trust_score ?? 0; setTrustOk(s >= 40); })
      .catch(() => setTrustOk(false));
    const go = () => setOffline(false); const off = () => setOffline(true);
    window.addEventListener("online", go); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", go); window.removeEventListener("offline", off); };
  }, []);

  async function handleApply(e) {
    e.preventDefault();
    if (offline || !navigator.onLine) { setError("Loan applications require a live connection."); return; }
    if (parseFloat(form.amount) < 1000) { setError("Minimum loan amount is ₦1,000."); return; }
    setLoading(true); setError("");
    try {
      const token = localStorage.getItem("dunazoe_token");
      const res = await fetch(`${API}/loans/apply`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount), duration: parseInt(form.duration) }),
      });
      const data = await res.json();
      if (data.success) setSuccess(true);
      else setError(data.error || "Application failed. Please try again.");
    } catch (_) { setError("Connection error. Please check your network."); }
    finally { setLoading(false); }
  }

  return (
    <PageShell title="Apply for Loan" icon="💰" authRequired={true}
      subtitle="DUNAZOE micro-lending — powered by your trust score"
      breadcrumb={[{ href: "/wallet", label: "Wallet" }, { label: "Loan Application" }]}>
      {offline && <div className="alert alert-error" style={{ marginBottom: "20px" }}>📡 Offline — loan applications require a live connection.</div>}
      {trustOk === false && (
        <div className="alert alert-warning" style={{ marginBottom: "20px" }}>
          ⚠️ Your trust score may be too low for a loan. <Link href="/trust" style={{ color: "var(--warning)", fontWeight: 700 }}>Check your score →</Link>
        </div>
      )}
      {success ? (
        <div style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ fontSize: "4rem", marginBottom: "16px" }}>✅</div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "8px" }} className="text-gradient">Application Submitted!</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "8px" }}>Your loan application is under review. You'll be notified within 24 hours.</p>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "24px" }}>Loan decisions are based on your trust score, Ajo history, and order record.</p>
          <Link href="/wallet" className="btn btn-primary">← Back to Wallet</Link>
        </div>
      ) : (
        <div className="container-md" style={{ padding: 0 }}>
          <form onSubmit={handleApply} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div className="card"><div className="card-body">
              {error && <div className="alert alert-error" style={{ marginBottom: "16px" }}>⚠️ {error}</div>}
              <h3 style={{ fontWeight: 700, marginBottom: "16px" }}>Loan Details</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div className="form-group">
                  <label className="form-label">Loan Amount (₦)</label>
                  <input className="form-input" type="number" min="1000" max="500000" step="500" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="e.g. 25000" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Purpose</label>
                  <select className="form-input" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} required>
                    <option value="">Select purpose</option>
                    <option value="business">Business / Inventory</option>
                    <option value="education">Education</option>
                    <option value="medical">Medical Emergency</option>
                    <option value="agriculture">Agriculture</option>
                    <option value="personal">Personal</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Repayment Period</label>
                  <select className="form-input" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}>
                    <option value="30">30 days</option>
                    <option value="60">60 days</option>
                    <option value="90">90 days</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Monthly Income (₦)</label>
                  <input className="form-input" type="number" min="0" value={form.monthly_income}
                    onChange={e => setForm(f => ({ ...f, monthly_income: e.target.value }))} placeholder="e.g. 80000" required />
                </div>
              </div>
            </div></div>
            <div className="alert alert-info">
              🔒 Loan disbursements go directly to your DUNAZOE wallet. Repayments are auto-deducted from your wallet on the due date.
            </div>
            <button type="submit" disabled={loading || offline} className="btn btn-primary btn-lg" style={{ justifyContent: "center" }}>
              {loading ? "Submitting…" : offline ? "🔌 No Connection" : "Submit Application →"}
            </button>
          </form>
        </div>
      )}
    </PageShell>
  );
}
