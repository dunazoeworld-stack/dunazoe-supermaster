"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function ThriftPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("dunazoe_token");
    fetch(`${API}/thrift/groups`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setGroups(d.groups || []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageShell title="Ajo Savings" icon="⬡" authRequired={true}
      subtitle="Digital group savings — contribute weekly, win big, build trust"
      actions={
        <Link href="/thrift/contribute" className="btn btn-primary btn-sm">+ Join a Group</Link>
      }>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px", marginBottom: "40px" }}>
        {[
          { icon: "👥", label: "How it works", desc: "Join a group, contribute weekly, collect when it's your turn" },
          { icon: "🔒", label: "Escrow-backed", desc: "All funds held in secure escrow until collection day" },
          { icon: "⭐", label: "Builds trust score", desc: "Consistent contributions increase your DUNAZOE trust rating" },
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

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Your Groups</h2>
        <Link href="/thrift/contribute" className="btn btn-outline btn-sm">Join a Group</Link>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1,2].map(i => <div key={i} className="skeleton" style={{ height: "80px", borderRadius: "14px" }} />)}
        </div>
      ) : groups.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {groups.map(g => (
            <div key={g.id} className="card">
              <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontWeight: 700 }}>{g.name}</p>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    {g.members} members · ₦{parseFloat(g.amount || 0).toLocaleString("en-NG")}/week
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className={`badge ${g.status === "active" ? "badge-success" : "badge-muted"}`}>{g.status || "active"}</span>
                  <Link href="/thrift/contribute" className="btn btn-primary btn-sm" style={{ display: "block", marginTop: "8px" }}>Contribute</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">⬡</span>
          <p className="empty-title">No Ajo groups yet</p>
          <p className="empty-body">Join a digital savings group and start building wealth with your community.</p>
          <Link href="/thrift/contribute" className="btn btn-primary">Join a Group</Link>
        </div>
      )}
    </PageShell>
  );
}
