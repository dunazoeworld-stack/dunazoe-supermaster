"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import NetworkBanner from "../../components/NetworkBanner";

export default function OpsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [revealed, setRevealed] = useState({});
  const [user, setUser] = useState(null);

  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem("dunazoe_user") || "{}"); setUser(u); } catch (_) {}
    loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true); setError("");
    const token = localStorage.getItem("dunazoe_token");
    if (!token) { setError("Authentication required. Please sign in as an operator."); setLoading(false); return; }
    try {
      const res = await fetch("/api/ops/status", { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (!d.success) { setError(d.error || "Access denied. Operator role required."); }
      else setData(d);
    } catch (_) { setError("Could not reach ops endpoint. Please check your connection."); }
    finally { setLoading(false); }
  }

  function copyToClipboard(text) {
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  const TABS = ["overview", "secrets", "webhooks", "deploy", "distribution"];
  const TAB_ICONS = { overview: "📊", secrets: "🔐", webhooks: "🔗", deploy: "🚀", distribution: "📱" };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
      <div className="dz-spinner" style={{ width: "48px", height: "48px" }} />
      <p style={{ color: "var(--text-secondary)" }}>Loading operator dashboard…</p>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh" }}>
      <NetworkBanner />
      <Navbar />
      <div className="container" style={{ paddingTop: "60px", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🔒</div>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: "8px" }} className="text-gradient">Operator Access Required</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>{error}</p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <Link href="/login" className="btn btn-primary">Sign In as Operator</Link>
          <button onClick={loadStatus} className="btn btn-ghost">Retry</button>
        </div>
      </div>
    </div>
  );

  const readiness = data?.readiness ?? 0;
  const readinessColor = readiness >= 80 ? "var(--success)" : readiness >= 50 ? "var(--warning)" : "var(--danger)";

  return (
    <div style={{ minHeight: "100vh" }}>
      <NetworkBanner />
      <Navbar />
      <div className="container" style={{ paddingTop: "32px", paddingBottom: "80px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "32px" }}>
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 900 }}><span className="text-gradient">Operator Cockpit</span></h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>DUNAZOE DevOps & Deployment AI · v{data?.version} · {data?.environment}</p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "2rem", fontWeight: 900, color: readinessColor, lineHeight: 1 }}>{readiness}%</p>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Deploy Readiness</p>
            </div>
            <button onClick={loadStatus} className="btn btn-ghost btn-sm">🔄 Refresh</button>
          </div>
        </div>

        {data?.critical_missing > 0 && (
          <div className="alert alert-error" style={{ marginBottom: "24px" }}>
            ⚠️ <strong>{data.critical_missing} critical config{data.critical_missing > 1 ? "s" : ""} missing.</strong> Deployment will fail until resolved. Check the Secrets tab.
          </div>
        )}

        {/* TABS */}
        <div style={{ display: "flex", gap: "4px", overflowX: "auto", paddingBottom: "4px", marginBottom: "28px", borderBottom: "1px solid var(--border)" }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "9px 18px", borderRadius: "10px 10px 0 0", border: "none",
              background: tab === t ? "var(--elevated)" : "transparent",
              borderBottom: tab === t ? "2px solid var(--dz-blue)" : "2px solid transparent",
              color: tab === t ? "var(--dz-blue)" : "var(--text-secondary)",
              cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}>
              {TAB_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div className="grid-3">
              {[
                { label: "Environment", value: data?.environment || "—", icon: "🌍" },
                { label: "Version", value: data?.version || "—", icon: "📦" },
                { label: "Operator", value: `${user?.name?.split(" ")[0] || "Unknown"} (${data?.operator?.role || "?"})`, icon: "👤" },
                { label: "Config Loaded", value: `${data?.secrets?.filter(s => s.loaded).length || 0}/${data?.secrets?.length || 0}`, icon: "🔐" },
                { label: "Critical Missing", value: data?.critical_missing || 0, icon: "⚠️", danger: data?.critical_missing > 0 },
                { label: "Timestamp", value: data?.timestamp ? new Date(data.timestamp).toLocaleTimeString("en-NG") : "—", icon: "🕐" },
              ].map(({ label, value, icon, danger }) => (
                <div key={label} className="stat-tile" style={danger ? { borderColor: "rgba(255,59,92,0.4)" } : {}}>
                  <p style={{ fontSize: "1.2rem" }}>{icon}</p>
                  <p style={{ fontSize: "1.2rem", fontWeight: 800, color: danger ? "var(--danger)" : "var(--text)", marginTop: "4px" }}>{value}</p>
                  <p className="stat-label">{label}</p>
                </div>
              ))}
            </div>
            <div className="card"><div className="card-body">
              <p style={{ fontWeight: 700, marginBottom: "14px" }}>Service Health</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {Object.entries(data?.services || {}).map(([svc, info]) => (
                  <div key={svc} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--surface)", borderRadius: "10px" }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: "0.88rem" }}>{svc.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</p>
                      {info.note && <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{info.note}</p>}
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>:{info.port}</span>
                      <span className={`badge ${info.status === "running" ? "badge-success" : "badge-danger"}`}>{info.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div></div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <Link href="/deploy" className="btn btn-primary">🚀 Deploy Control</Link>
              <Link href="/deploy/studio" className="btn btn-outline">🏗️ Build Studio</Link>
              <button onClick={() => setTab("secrets")} className="btn btn-ghost">🔐 Secrets →</button>
            </div>
          </div>
        )}

        {/* SECRETS */}
        {tab === "secrets" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div className="alert alert-info" style={{ marginBottom: "8px" }}>🔒 Values are masked by default. Only operator roles can view the presence and validity of secrets.</div>
            {(data?.secrets || []).map(s => (
              <div key={s.key} className="card" style={{ borderColor: s.action_needed ? "rgba(255,59,92,0.35)" : s.loaded ? "var(--border)" : "rgba(255,159,0,0.3)" }}>
                <div className="card-body" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px", padding: "12px 16px" }}>
                  <div style={{ flex: 1, minWidth: "180px" }}>
                    <p style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.85rem" }}>{s.key}</p>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{s.category}</p>
                  </div>
                  <span className={`badge ${s.loaded ? "badge-success" : s.critical ? "badge-danger" : "badge-warning"}`}>
                    {s.loaded ? "✓ Loaded" : s.critical ? "✗ Missing (Critical)" : "○ Not Set"}
                  </span>
                  {s.loaded && (
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <code style={{ fontSize: "0.78rem", background: "var(--bg-3)", padding: "4px 8px", borderRadius: "6px", color: "var(--text-secondary)" }}>
                        {revealed[s.key] ? s.masked : "••••••••••"}
                      </code>
                      <button onClick={() => setRevealed(r => ({ ...r, [s.key]: !r[s.key] }))} className="btn btn-ghost btn-sm" style={{ padding: "3px 8px" }}>
                        {revealed[s.key] ? "Hide" : "Show"}
                      </button>
                    </div>
                  )}
                  {s.action_needed && <span className="badge badge-danger">Action Needed</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* WEBHOOKS */}
        {tab === "webhooks" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="alert alert-info" style={{ marginBottom: "8px" }}>Configure these webhook URLs in your provider dashboards. All endpoints verify signatures server-side.</div>
            {(data?.webhooks || []).map(w => (
              <div key={w.name} className="card">
                <div className="card-body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "10px" }}>
                    <div>
                      <p style={{ fontWeight: 700 }}>{w.name}</p>
                      <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{w.provider} · {w.method} verification</p>
                    </div>
                    <span className={`badge ${w.verified ? "badge-success" : "badge-warning"}`}>
                      {w.verified ? "✓ Secret Configured" : "⚠ Secret Missing"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <code style={{ flex: 1, fontSize: "0.8rem", background: "var(--bg-3)", padding: "8px 12px", borderRadius: "8px", color: "var(--dz-blue)", overflow: "auto", whiteSpace: "nowrap" }}>
                      {w.url}
                    </code>
                    <button onClick={() => copyToClipboard(w.url)} className="btn btn-primary btn-sm">Copy</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* DEPLOY */}
        {tab === "deploy" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="alert alert-warning">⚠️ Deploy actions affect production. Always run an audit first.</div>
            {[
              { href: "/deploy", label: "🚀 Deployment Engine", desc: "View deployment status and trigger deploys" },
              { href: "/deploy/studio", label: "🏗️ Build Studio", desc: "Service build status and logs" },
              { href: "/deploy/apis", label: "⚡ API Control Center", desc: "Manage API keys and service connections" },
              { href: "/deploy/features", label: "🔘 Feature Flags", desc: "Toggle features without redeploy" },
              { href: "/deploy/scaling", label: "📈 Scale Migration", desc: "Manage scaling and resource allocation" },
              { href: "/deploy/github", label: "🐙 GitHub Integration", desc: "Push/pull the repository" },
            ].map(({ href, label, desc }) => (
              <Link key={href} href={href} className="card" style={{ textDecoration: "none" }}>
                <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div><p style={{ fontWeight: 700 }}>{label}</p><p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{desc}</p></div>
                  <span style={{ color: "var(--dz-blue)" }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* DISTRIBUTION */}
        {tab === "distribution" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="grid-2">
              {Object.entries(data?.pwa || {}).filter(([k]) => typeof k === "string" && !["android_path","ios_path"].includes(k)).map(([key, val]) => (
                <div key={key} className="card">
                  <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ fontWeight: 600, fontSize: "0.88rem" }}>{key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</p>
                    <span className={`badge ${val ? "badge-success" : "badge-danger"}`}>{val ? "✓ Ready" : "✗ Missing"}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="card"><div className="card-body">
              <p style={{ fontWeight: 700, marginBottom: "14px" }}>Install Paths</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ padding: "12px", background: "var(--surface)", borderRadius: "10px" }}>
                  <p style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>🤖 Android</p>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{data?.pwa?.android_path}</p>
                </div>
                <div style={{ padding: "12px", background: "var(--surface)", borderRadius: "10px" }}>
                  <p style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>🍎 iOS (Safari)</p>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{data?.pwa?.ios_path}</p>
                </div>
              </div>
            </div></div>
          </div>
        )}
      </div>
    </div>
  );
}
