"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function LoansPage() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trustScore, setTrustScore] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("dunazoe_token");
    Promise.allSettled([
      fetch(`${API}/loans`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API}/trust/score`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([loansR, trustR]) => {
      if (loansR.status === "fulfilled" && loansR.value?.loans) setLoans(loansR.value.loans);
      if (trustR.status === "fulfilled") setTrustScore(trustR.value?.score ?? trustR.value?.trust_score ?? null);
    }).finally(() => setLoading(false));
  }, []);

  const STATUS_COLOR = { pending: "info", approved: "success", rejected: "danger", repaid: "success", active: "info" };

  return (
    <PageShell title="My Loans" icon="💰" authRequired={true}
      subtitle="DUNAZOE micro-lending — powered by your trust score"
      actions={<Link href="/loans/apply" className="btn btn-primary btn-sm">Apply for Loan →</Link>}>

      {/* Trust Score */}
      <div className="card" style={{ marginBottom: "24px", background: "linear-gradient(135deg,rgba(0,163,255,0.08),rgba(0,102,255,0.04))", borderColor: "var(--border-strong)" }}>
        <div className="card-body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", padding: "18px 22px" }}>
          <div>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "4px" }}>🛡️ Trust Score</p>
            {loading
              ? <div className="skeleton" style={{ height: "28px", width: "80px" }} />
              : trustScore !== null
                ? <p style={{ fontSize: "1.6rem", fontWeight: 800, color: trustScore >= 60 ? "#10B981" : trustScore >= 40 ? "#F59E0B" : "#EF4444" }}>
                    {trustScore}<span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>/100</span>
                  </p>
                : <p style={{ color: "var(--text-muted)" }}>Not available</p>
            }
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>
              {trustScore !== null
                ? trustScore >= 60 ? "✅ Eligible for full loan access"
                  : trustScore >= 40 ? "⚠️ Eligible for small loans"
                  : "❌ Build your score to unlock loans"
                : "Complete more orders to earn a score"}
            </p>
          </div>
          <Link href="/loans/apply" className="btn btn-primary">Apply for Loan →</Link>
        </div>
      </div>

      {/* Loan History */}
      <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "16px" }}>Loan History</h2>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1,2].map(i => <div key={i} className="skeleton" style={{ height: "72px", borderRadius: "12px" }} />)}
        </div>
      ) : loans.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {loans.map(l => (
            <div key={l.id} className="card">
              <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", padding: "14px 18px" }}>
                <div>
                  <p style={{ fontWeight: 700 }}>₦{parseFloat(l.amount||0).toLocaleString("en-NG")}</p>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{l.purpose || "Loan"} · {l.duration_days || l.duration || "—"} days</p>
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    {l.created_at ? new Date(l.created_at).toLocaleDateString("en-NG") : ""}
                  </p>
                </div>
                <span className={`badge badge-${STATUS_COLOR[l.status] || "info"}`}>{l.status || "pending"}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">💰</span>
          <p className="empty-title">No loans yet</p>
          <p className="empty-body">Apply for a micro-loan powered by your trust score.</p>
          <Link href="/loans/apply" className="btn btn-primary">Apply Now →</Link>
        </div>
      )}
    </PageShell>
  );
}
