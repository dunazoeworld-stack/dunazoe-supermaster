"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem("dunazoe_user") || "{}"); setUser(u); } catch (_) {}
    const token = localStorage.getItem("dunazoe_token");
    fetch(`${API}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setStats(d.stats || d))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const ADMIN_LINKS = [
    { href: "/ops", icon: "🛸", label: "Operator Cockpit", desc: "Deployment & DevOps AI" },
    { href: "/deploy", icon: "🚀", label: "Deploy Control", desc: "Deploy & manage services" },
    { href: "/deploy/studio", icon: "🏗️", label: "Build Studio", desc: "Service build status" },
    { href: "/deploy/apis", icon: "⚡", label: "API Center", desc: "Manage API keys" },
    { href: "/deploy/features", icon: "🔘", label: "Feature Flags", desc: "Toggle features" },
    { href: "/deploy/github", icon: "🐙", label: "GitHub", desc: "Push/pull repo" },
  ];

  const STAT_TILES = [
    { key: "total_users", icon: "👥", label: "Total Users" },
    { key: "total_orders", icon: "📦", label: "Total Orders" },
    { key: "total_vendors", icon: "🏪", label: "Vendors" },
    { key: "total_revenue", icon: "₦", label: "Revenue", format: true },
    { key: "open_disputes", icon: "⚖️", label: "Open Disputes" },
    { key: "active_thrift", icon: "⬡", label: "Active Ajo Groups" },
  ];

  return (
    <PageShell title="Admin Dashboard" icon="⚙️" authRequired={true}
      subtitle="Platform management console — operator & admin access only">
      {user && !["admin","super_admin","coordinator"].includes(user.role) && (
        <div className="alert alert-error" style={{ marginBottom: "20px" }}>
          ⚠️ You need admin access to view full platform data. Some sections may be restricted.
        </div>
      )}
      {loading ? (
        <div className="grid-3" style={{ marginBottom: "32px" }}>
          {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: "100px", borderRadius: "16px" }} />)}
        </div>
      ) : (
        <div className="grid-3" style={{ marginBottom: "32px" }}>
          {STAT_TILES.map(({ key, icon, label, format }) => (
            <div key={key} className="stat-tile">
              <p style={{ fontSize: "1.2rem", marginBottom: "4px" }}>{icon}</p>
              <p className="stat-value">
                {stats?.[key] !== undefined
                  ? format ? `₦${parseFloat(stats[key]).toLocaleString("en-NG")}` : stats[key].toLocaleString()
                  : "—"}
              </p>
              <p className="stat-label">{label}</p>
            </div>
          ))}
        </div>
      )}
      <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "16px" }}>Quick Access</h2>
      <div className="grid-2" style={{ marginBottom: "40px" }}>
        {ADMIN_LINKS.map(({ href, icon, label, desc }) => (
          <Link key={href} href={href} className="card" style={{ textDecoration: "none" }}>
            <div className="card-body" style={{ display: "flex", gap: "14px", alignItems: "center" }}>
              <span style={{ fontSize: "1.8rem" }}>{icon}</span>
              <div><p style={{ fontWeight: 700 }}>{label}</p><p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{desc}</p></div>
              <span style={{ marginLeft: "auto", color: "var(--dz-blue)" }}>→</span>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
