"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function TrustPage() {
  const [trust, setTrust] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("dunazoe_token");
    fetch(`${API}/trust/score`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.score !== undefined || d.trust_score !== undefined) setTrust(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const score = trust?.score ?? trust?.trust_score ?? null;
  const tier = score === null ? null : score >= 80 ? "Platinum" : score >= 60 ? "Gold" : score >= 40 ? "Silver" : "Bronze";
  const tierColor = { Platinum: "#A0C4FF", Gold: "#FFD700", Silver: "#C0C0C0", Bronze: "#CD7F32" };

  const FACTORS = [
    { icon: "⬡", label: "Ajo Consistency", desc: "Regular Ajo contributions boost your score" },
    { icon: "📦", label: "Order History", desc: "Completed orders increase trust" },
    { icon: "⭐", label: "Vendor Ratings", desc: "Positive reviews you've given and received" },
    { icon: "✅", label: "KYC Verified", desc: "Identity verification adds significant points" },
    { icon: "⚖️", label: "Dispute Record", desc: "Low disputes keep your score high" },
    { icon: "💳", label: "Payment History", desc: "Timely payments add to your score" },
  ];

  return (
    <PageShell title="Trust Score" icon="⭐" authRequired={true}
      subtitle="Your DUNAZOE trust rating — built on track record, not just credit">
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}><div className="dz-spinner" /></div>
      ) : (
        <>
          <div className="card" style={{ textAlign: "center", marginBottom: "32px", background: "linear-gradient(135deg, rgba(0,163,255,0.08), rgba(0,102,255,0.04))", borderColor: "var(--border-strong)" }}>
            <div className="card-body" style={{ padding: "40px" }}>
              {score !== null ? (
                <>
                  <div style={{ fontSize: "5rem", fontWeight: 900, lineHeight: 1, marginBottom: "8px", background: "var(--dz-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{Math.round(score)}</div>
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: tierColor[tier], letterSpacing: "0.1em" }}>{tier} Member</span>
                  <div style={{ marginTop: "20px", background: "var(--bg-3)", borderRadius: "99px", height: "10px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${score}%`, background: "var(--dz-gradient)", borderRadius: "99px", transition: "width 1s ease" }} />
                  </div>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "8px" }}>Score out of 100</p>
                </>
              ) : (
                <>
                  <div style={{ fontSize: "5rem", fontWeight: 900, lineHeight: 1, marginBottom: "8px", color: "var(--text-muted)" }}>—</div>
                  <p style={{ color: "var(--text-secondary)" }}>Trust score not yet calculated</p>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "6px" }}>Complete your profile, verify identity, and make your first purchase to get scored.</p>
                </>
              )}
            </div>
          </div>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "16px" }}>How Your Score is Built</h2>
          <div className="grid-2" style={{ marginBottom: "32px" }}>
            {FACTORS.map(f => (
              <div key={f.label} className="card">
                <div className="card-body" style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "1.4rem" }}>{f.icon}</span>
                  <div><p style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: "2px" }}>{f.label}</p><p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{f.desc}</p></div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link href="/thrift" className="btn btn-primary btn-sm">⬡ Join Ajo Group</Link>
            <Link href="/products" className="btn btn-outline btn-sm">🛒 Make a Purchase</Link>
          </div>
        </>
      )}
    </PageShell>
  );
}
