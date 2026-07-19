"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function ThriftPage() {
  const [savings, setSavings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("dunazoe_token");
    fetch(`${API}/thrift/personal`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setSavings(d.savings || d.accounts || []))
      .catch(() => setSavings([]))
      .finally(() => setLoading(false));
  }, []);

  const totalSaved = savings.reduce((s, a) => s + parseFloat(a.balance || a.amount_saved || 0), 0);

  return (
    <PageShell title="Ajo Savings" icon="⬡" authRequired={true}
      subtitle="Personal savings — set a goal, save at your pace, earn 5% p.a. interest"
      actions={
        <Link href="/thrift/contribute" className="btn btn-primary btn-sm">+ New Savings Plan</Link>
      }>

      {/* Feature tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px", marginBottom: "40px" }}>
        {[
          { icon: "🎯", label: "Goal-based saving", desc: "Set a target amount and save towards it at your own pace" },
          { icon: "📅", label: "Flexible duration", desc: "Choose how long to save — from 1 month up to 12 months max" },
          { icon: "💹", label: "5% p.a. interest", desc: "Your savings earn interest automatically — paid at maturity" },
          { icon: "🔒", label: "Escrow-protected", desc: "All funds held securely until your target date" },
        ].map(f => (
          <div key={f.label} className="card">
            <div className="card-body" style={{ textAlign: "center" }}>
              <span style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}>{f.icon}</span>
              <p style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "4px" }}>{f.label}</p>
              <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Total savings summary */}
      {savings.length > 0 && (
        <div className="card" style={{ marginBottom: "24px", background: "linear-gradient(135deg,rgba(0,163,255,0.08),rgba(0,102,255,0.04))", border: "1px solid rgba(0,163,255,0.2)" }}>
          <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Total Saved</p>
              <p className="text-gradient" style={{ fontSize: "1.8rem", fontWeight: 900 }}>₦{totalSaved.toLocaleString("en-NG")}</p>
            </div>
            <Link href="/thrift/contribute" className="btn btn-primary btn-sm">+ Add Plan</Link>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>My Savings Plans</h2>
        <Link href="/thrift/contribute" className="btn btn-outline btn-sm">New Plan</Link>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: "100px", borderRadius: "14px" }} />)}
        </div>
      ) : savings.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {savings.map(s => {
            const saved  = parseFloat(s.balance || s.amount_saved || 0);
            const target = parseFloat(s.target_amount || 0);
            const pct    = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
            const daysLeft = s.target_date
              ? Math.max(0, Math.ceil((new Date(s.target_date) - Date.now()) / 86400000))
              : null;
            return (
              <div key={s.id} className="card">
                <div className="card-body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                    <div>
                      <p style={{ fontWeight: 700, marginBottom: "2px" }}>{s.purpose || s.name || "Savings Plan"}</p>
                      <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                        {s.plan_type || "monthly"} · {daysLeft !== null ? `${daysLeft} days left` : "Active"}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p className="text-gradient" style={{ fontWeight: 800, fontSize: "1.05rem" }}>
                        ₦{saved.toLocaleString("en-NG")}
                      </p>
                      {target > 0 && (
                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                          of ₦{target.toLocaleString("en-NG")} goal
                        </p>
                      )}
                    </div>
                  </div>
                  {target > 0 && (
                    <div style={{ background: "var(--bg-3)", borderRadius: "999px", height: "6px", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "var(--dz-gradient)", borderRadius: "999px", transition: "width 0.4s" }} />
                    </div>
                  )}
                  {target > 0 && (
                    <p style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "4px" }}>{pct}% of goal reached</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">⬡</span>
          <p className="empty-title">No savings plans yet</p>
          <p className="empty-body">Create a personal savings plan and watch your money grow with 5% annual interest.</p>
          <Link href="/thrift/contribute" className="btn btn-primary">Start Saving</Link>
        </div>
      )}
    </PageShell>
  );
}
