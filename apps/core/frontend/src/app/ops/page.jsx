"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import NetworkBanner from "../../components/NetworkBanner";

const DEPLOYED_URL = "https://dunazoe-supermaster-1--dunazoeworld.replit.app";

export default function OpsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [revealed, setRevealed] = useState({});
  const [user, setUser] = useState(null);

  // STAE state
  const [stae, setStae] = useState(null);
  const [staeLoading, setStaeLoading] = useState(false);
  const [staeMsg, setStaeMsg] = useState(null);

  // Product AI state
  const [productAI, setProductAI] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMsg, setAiMsg] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [aiForm, setAiForm] = useState({ type: "demand_forecast", category: "fashion", city: "lagos", cost_price: "", name: "", description: "", price: "", images: "1", has_cost_price: true, segment: "new_user" });

  // Site Test state
  const [siteTests, setSiteTests] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testTarget, setTestTarget] = useState("deployed");

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

  async function loadStae() {
    setStaeLoading(true); setStaeMsg(null);
    const token = localStorage.getItem("dunazoe_token");
    try {
      const res = await fetch("/api/stae", { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (d.success) setStae(d);
      else setStaeMsg({ type: "error", text: d.error || "STAE access denied." });
    } catch (_) { setStaeMsg({ type: "error", text: "Could not reach STAE endpoint." }); }
    finally { setStaeLoading(false); }
  }

  async function staeAction(action, target) {
    setStaeLoading(true); setStaeMsg(null);
    const token = localStorage.getItem("dunazoe_token");
    try {
      const res = await fetch("/api/stae", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, target }),
      });
      const d = await res.json();
      if (d.success) {
        setStaeMsg({ type: "success", text: d.result || d.note || "Action completed." });
        await loadStae();
      } else {
        setStaeMsg({ type: "error", text: d.error || "Action failed." });
      }
    } catch (_) { setStaeMsg({ type: "error", text: "Network error during STAE action." }); }
    finally { setStaeLoading(false); }
  }

  useEffect(() => {
    if (tab === "stae" && !stae) loadStae();
    if (tab === "productai" && !productAI) loadProductAI();
  }, [tab]);

  async function loadProductAI() {
    setAiLoading(true); setAiMsg(null);
    const token = localStorage.getItem("dunazoe_token");
    try {
      const res = await fetch("/api/ops/product-ai", { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (d.success) setProductAI(d);
      else setAiMsg({ type: "error", text: d.error || "Product AI access denied." });
    } catch (_) { setAiMsg({ type: "error", text: "Could not reach Product AI endpoint." }); }
    finally { setAiLoading(false); }
  }

  async function runProductAI() {
    setAiLoading(true); setAiMsg(null); setAiResult(null);
    const token = localStorage.getItem("dunazoe_token");
    const payload = { type: aiForm.type, data: {} };
    if (aiForm.type === "demand_forecast")    payload.data = { category: aiForm.category, city: aiForm.city };
    if (aiForm.type === "optimize_price")     payload.data = { cost_price: +aiForm.cost_price, category: aiForm.category, city: aiForm.city, name: aiForm.name };
    if (aiForm.type === "listing_assistant")  payload.data = { name: aiForm.name, description: aiForm.description, price: +aiForm.price, category: aiForm.category, images: +aiForm.images, has_cost_price: aiForm.has_cost_price };
    if (aiForm.type === "marketing_copy")     payload.data = { segment: aiForm.segment, product_name: aiForm.name, price: +aiForm.price };
    if (aiForm.type === "recommend")          payload.data = { city: aiForm.city };
    if (aiForm.type === "vendor_insights")    payload.data = { city: aiForm.city };
    if (aiForm.type === "site_health")        payload.data = { base_url: testTarget === "deployed" ? DEPLOYED_URL : "http://localhost:5000" };
    try {
      const res = await fetch("/api/ops/product-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (d.success) { setAiResult(d); setAiMsg({ type: "success", text: `✅ ${aiForm.type} completed.` }); }
      else setAiMsg({ type: "error", text: d.error || "AI operation failed." });
    } catch (_) { setAiMsg({ type: "error", text: "Network error running AI operation." }); }
    finally { setAiLoading(false); }
  }

  async function runSiteTests() {
    setTestLoading(true); setSiteTests(null); setAiMsg(null);
    const token = localStorage.getItem("dunazoe_token");
    const base_url = testTarget === "deployed" ? DEPLOYED_URL : "http://localhost:5000";
    try {
      const res = await fetch("/api/ops/product-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: "site_health", data: { base_url } }),
      });
      const d = await res.json();
      if (d.success) setSiteTests(d.result);
      else setAiMsg({ type: "error", text: d.error || "Site test failed." });
    } catch (_) { setAiMsg({ type: "error", text: "Could not run site tests." }); }
    finally { setTestLoading(false); }
  }

  function copyToClipboard(text) {
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  const TABS = ["overview", "secrets", "webhooks", "stae", "productai", "sitetest", "deploy", "distribution"];
  const TAB_ICONS = { overview: "📊", secrets: "🔐", webhooks: "🔗", stae: "⚡", productai: "🤖", sitetest: "🧪", deploy: "🚀", distribution: "📱" };
  const TAB_LABELS = { overview: "Overview", secrets: "Secrets", webhooks: "Webhooks", stae: "STAE", productai: "Product AI", sitetest: "Site Tests", deploy: "Deploy", distribution: "Distribution" };

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

  // STAE helpers
  const modeColor = { normal: "var(--success)", surge: "var(--warning)", degraded: "#F5A623", freeze: "var(--danger)" };
  const SCALE_SERVICES = ["order-service", "payment-service", "inventory-service", "auth-service", "wallet-service"];

  return (
    <div style={{ minHeight: "100vh" }}>
      <NetworkBanner />
      <Navbar />
      <div className="container" style={{ paddingTop: "32px", paddingBottom: "80px" }}>
        {/* Header */}
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
              {TAB_ICONS[t]} {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div className="grid-3">
              {[
                { label: "Environment",    value: data?.environment || "—",   icon: "🌍" },
                { label: "Version",        value: data?.version || "—",       icon: "📦" },
                { label: "Operator",       value: `${user?.name?.split(" ")[0] || "Unknown"} (${data?.operator?.role || "?"})`, icon: "👤" },
                { label: "Config Loaded",  value: `${data?.secrets?.filter(s => s.loaded).length || 0}/${data?.secrets?.length || 0}`, icon: "🔐" },
                { label: "Critical Missing", value: data?.critical_missing || 0, icon: "⚠️", danger: data?.critical_missing > 0 },
                { label: "Timestamp",      value: data?.timestamp ? new Date(data.timestamp).toLocaleTimeString("en-NG") : "—", icon: "🕐" },
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
              <button onClick={() => setTab("stae")} className="btn btn-ghost">⚡ STAE Controls →</button>
              <button onClick={() => setTab("secrets")} className="btn btn-ghost">🔐 Secrets →</button>
            </div>
          </div>
        )}

        {/* ── SECRETS ───────────────────────────────────────────────────────── */}
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

        {/* ── WEBHOOKS ──────────────────────────────────────────────────────── */}
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

        {/* ── STAE ──────────────────────────────────────────────────────────── */}
        {tab === "stae" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Mode banner */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", padding: "16px 20px", background: "var(--elevated)", borderRadius: "14px", border: "1px solid var(--border)" }}>
              <div>
                <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "4px" }}>PLATFORM MODE</p>
                <p style={{ fontSize: "1.6rem", fontWeight: 900, color: modeColor[stae?.state?.mode] || "var(--text)", lineHeight: 1, textTransform: "uppercase" }}>
                  {stae ? stae.state.mode : "—"}
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <span className={`badge ${stae?.state?.surgeActive ? "badge-warning" : "badge-success"}`}>
                  {stae?.state?.surgeActive ? "⚡ Surge Active" : "✓ Normal Traffic"}
                </span>
                <span className={`badge ${stae?.state?.queueProtection ? "badge-info" : "badge-muted"}`}>
                  {stae?.state?.queueProtection ? "🛡 Queue Protected" : "○ No Queue Guard"}
                </span>
              </div>
              <button onClick={loadStae} className="btn btn-ghost btn-sm" disabled={staeLoading}>
                {staeLoading ? "…" : "🔄 Refresh"}
              </button>
            </div>

            {/* Simulation notice */}
            <div className="alert alert-info" style={{ fontSize: "0.82rem" }}>
              ℹ️ <strong>MANAGED SIMULATION MODE</strong> — Running on Replit single-container. Scaling controls manage internal throttles and queue protection. No cloud autoscaling resources are modified. Every action is logged truthfully.
            </div>

            {/* Feedback message */}
            {staeMsg && (
              <div className={`alert ${staeMsg.type === "success" ? "alert-success" : "alert-error"}`}>
                {staeMsg.type === "success" ? "✅" : "❌"} {staeMsg.text}
              </div>
            )}

            {/* Recommendations */}
            {stae?.recommendations?.length > 0 && (
              <div className="card" style={{ borderColor: "rgba(245,166,35,0.4)" }}>
                <div className="card-body">
                  <p style={{ fontWeight: 700, marginBottom: "10px" }}>⚠️ Recommendations</p>
                  {stae.recommendations.map((r, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--surface)", borderRadius: "8px", marginBottom: "6px" }}>
                      <div>
                        <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>{r.reason}</p>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{r.action}</p>
                      </div>
                      <span className={`badge ${r.priority === "HIGH" ? "badge-danger" : "badge-warning"}`}>{r.priority}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Primary controls */}
            <div className="card">
              <div className="card-body">
                <p style={{ fontWeight: 700, marginBottom: "14px" }}>⚡ Primary Controls</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                  {[
                    { action: "health_check",       label: "🩺 Run Health Check",       style: "ghost" },
                    { action: "activate_surge",     label: "⚡ Activate Surge Mode",    style: "warning" },
                    { action: "deactivate_surge",   label: "✅ Normalize Traffic",       style: "success" },
                    { action: "pause_noncritical",  label: "⏸ Pause Non-Critical",      style: "warning" },
                    { action: "resume_all",         label: "▶ Resume All Workloads",    style: "success" },
                    { action: "enable_queue_protection",  label: "🛡 Enable Queue Guard",  style: "ghost" },
                    { action: "disable_queue_protection", label: "🔓 Disable Queue Guard", style: "ghost" },
                  ].map(({ action, label, style }) => (
                    <button key={action} onClick={() => staeAction(action)} disabled={staeLoading}
                      style={{
                        padding: "12px 14px", borderRadius: "10px", border: "none", cursor: staeLoading ? "not-allowed" : "pointer",
                        fontWeight: 700, fontSize: "0.82rem", textAlign: "left",
                        background: style === "warning" ? "rgba(245,166,35,0.12)" : style === "success" ? "rgba(0,204,136,0.12)" : "rgba(0,163,255,0.08)",
                        color: style === "warning" ? "#F5A623" : style === "success" ? "var(--success)" : "var(--dz-blue)",
                        opacity: staeLoading ? 0.6 : 1,
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Per-service scaling */}
            <div className="card">
              <div className="card-body">
                <p style={{ fontWeight: 700, marginBottom: "14px" }}>🔧 Per-Service Scaling</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {(stae?.services || SCALE_SERVICES.map(n => ({ name: n, critical: true }))).filter(s => s.critical).map(svc => (
                    <div key={svc.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--surface)", borderRadius: "10px" }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: "0.85rem" }}>{svc.name}</p>
                        <span className={`badge ${svc.healthy === true ? "badge-success" : svc.healthy === false ? "badge-danger" : "badge-muted"}`} style={{ fontSize: "0.7rem" }}>
                          {svc.healthy === true ? "✓ reachable" : svc.healthy === false ? "✗ unreachable" : "not checked"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button onClick={() => staeAction("scale_up", svc.name)} disabled={staeLoading}
                          className="btn btn-primary btn-sm">▲ Scale Up</button>
                        <button onClick={() => staeAction("scale_down", svc.name)} disabled={staeLoading}
                          className="btn btn-ghost btn-sm">▼ Scale Down</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Audit log */}
            {stae?.recentLog?.length > 0 && (
              <div className="card">
                <div className="card-body">
                  <p style={{ fontWeight: 700, marginBottom: "12px" }}>📋 Recent STAE Audit Log</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {stae.recentLog.map((entry, i) => (
                      <div key={i} style={{ padding: "8px 12px", background: "var(--surface)", borderRadius: "8px", fontSize: "0.78rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "4px", marginBottom: "2px" }}>
                          <span style={{ fontWeight: 700, color: "var(--dz-blue)", fontFamily: "monospace" }}>{entry.action}</span>
                          <span style={{ color: "var(--text-muted)" }}>{new Date(entry.ts).toLocaleTimeString("en-NG")}</span>
                        </div>
                        <p style={{ color: "var(--text-secondary)" }}>{entry.result}</p>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>by {entry.operator} · target: {entry.target}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!stae && !staeLoading && (
              <button onClick={loadStae} className="btn btn-primary">Load STAE Status</button>
            )}
          </div>
        )}

        {/* ── PRODUCT AI ────────────────────────────────────────────────────── */}
        {tab === "productai" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Status banner */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", padding: "16px 20px", background: "var(--elevated)", borderRadius: "14px", border: "1px solid var(--border)" }}>
              <div>
                <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "4px" }}>PRODUCT AI STATUS</p>
                <p style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--success)", lineHeight: 1 }}>
                  {productAI ? "🟢 ACTIVE" : aiLoading ? "⏳ LOADING…" : "⚪ NOT LOADED"}
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {productAI && <span className="badge badge-success">{productAI.product_ai.categories_indexed} categories indexed</span>}
                {productAI && <span className={`badge ${productAI.product_ai.ai_service_port4014.startsWith("online") ? "badge-success" : "badge-warning"}`}>
                  AI Service: {productAI.product_ai.ai_service_port4014.startsWith("online") ? "Online :4014" : "Inline fallback"}
                </span>}
              </div>
              <button onClick={loadProductAI} className="btn btn-ghost btn-sm" disabled={aiLoading}>{aiLoading ? "…" : "🔄 Refresh"}</button>
            </div>

            <div className="alert alert-info" style={{ fontSize: "0.82rem" }}>
              🤖 <strong>Product Listing AI</strong> — Rule-based engine (no external API cost). Operations: demand forecasting, price optimisation, listing scoring, marketing copy generation, vendor insights, and full site health tests. Superuser only.
            </div>

            {aiMsg && <div className={`alert ${aiMsg.type === "success" ? "alert-success" : "alert-error"}`}>{aiMsg.text}</div>}

            {/* Operation runner */}
            <div className="card">
              <div className="card-body">
                <p style={{ fontWeight: 700, marginBottom: "14px" }}>⚙️ Run AI Operation</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px", marginBottom: "14px" }}>
                  {/* Operation type */}
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>OPERATION</label>
                    <select className="form-input" value={aiForm.type} onChange={e => setAiForm(f => ({ ...f, type: e.target.value }))} style={{ marginTop: "4px" }}>
                      <option value="demand_forecast">📊 Demand Forecast</option>
                      <option value="optimize_price">💰 Price Optimiser</option>
                      <option value="listing_assistant">🏷️ Listing Assistant</option>
                      <option value="marketing_copy">📣 Marketing Copy</option>
                      <option value="recommend">⭐ Recommendations</option>
                      <option value="vendor_insights">📈 Vendor Insights</option>
                      <option value="site_health">🧪 Site Health</option>
                    </select>
                  </div>
                  {/* Category */}
                  {["demand_forecast","optimize_price","listing_assistant"].includes(aiForm.type) && (
                    <div>
                      <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>CATEGORY</label>
                      <select className="form-input" value={aiForm.category} onChange={e => setAiForm(f => ({ ...f, category: e.target.value }))} style={{ marginTop: "4px" }}>
                        {["fashion","electronics","food_groceries","beauty_health","phones_tablets","thrift_fashion","solar_energy","baby_kids","services","books_education","sports_fitness","furniture","agriculture","automotive"].map(c => (
                          <option key={c} value={c}>{c.replace(/_/g," ")}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {/* City */}
                  {["demand_forecast","optimize_price","recommend","vendor_insights"].includes(aiForm.type) && (
                    <div>
                      <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>CITY</label>
                      <select className="form-input" value={aiForm.city} onChange={e => setAiForm(f => ({ ...f, city: e.target.value }))} style={{ marginTop: "4px" }}>
                        {["lagos","abuja","port harcourt","kano","ibadan","enugu","abeokuta"].map(c => (
                          <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {/* Cost price */}
                  {aiForm.type === "optimize_price" && (
                    <div>
                      <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>COST PRICE (₦)</label>
                      <input className="form-input" type="number" min="0" value={aiForm.cost_price} onChange={e => setAiForm(f => ({ ...f, cost_price: e.target.value }))} placeholder="e.g. 5000" style={{ marginTop: "4px" }} />
                    </div>
                  )}
                  {/* Product name */}
                  {["optimize_price","listing_assistant","marketing_copy"].includes(aiForm.type) && (
                    <div>
                      <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>PRODUCT NAME</label>
                      <input className="form-input" value={aiForm.name} onChange={e => setAiForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Ankara Dress" style={{ marginTop: "4px" }} />
                    </div>
                  )}
                  {/* Price */}
                  {["listing_assistant","marketing_copy"].includes(aiForm.type) && (
                    <div>
                      <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>PRICE (₦)</label>
                      <input className="form-input" type="number" min="0" value={aiForm.price} onChange={e => setAiForm(f => ({ ...f, price: e.target.value }))} placeholder="e.g. 12000" style={{ marginTop: "4px" }} />
                    </div>
                  )}
                  {/* Segment */}
                  {aiForm.type === "marketing_copy" && (
                    <div>
                      <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>CUSTOMER SEGMENT</label>
                      <select className="form-input" value={aiForm.segment} onChange={e => setAiForm(f => ({ ...f, segment: e.target.value }))} style={{ marginTop: "4px" }}>
                        {["new_user","loyal","champion","at_risk","thrift_seeker","price_sensitive"].map(s => (
                          <option key={s} value={s}>{s.replace(/_/g," ")}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {/* Description */}
                  {aiForm.type === "listing_assistant" && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>DESCRIPTION</label>
                      <textarea className="form-input" rows={2} value={aiForm.description} onChange={e => setAiForm(f => ({ ...f, description: e.target.value }))} placeholder="Product description text…" style={{ marginTop: "4px", resize: "vertical" }} />
                    </div>
                  )}
                </div>
                <button onClick={runProductAI} disabled={aiLoading} className="btn btn-primary" style={{ width: "100%" }}>
                  {aiLoading ? "⏳ Running…" : "▶ Run Operation"}
                </button>
              </div>
            </div>

            {/* Results */}
            {aiResult && (
              <div className="card" style={{ borderColor: "rgba(0,200,150,0.3)" }}>
                <div className="card-body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <p style={{ fontWeight: 700 }}>🤖 AI Result — <span style={{ color: "var(--dz-blue)" }}>{aiResult.type}</span></p>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{new Date(aiResult.ts).toLocaleTimeString("en-NG")}</span>
                  </div>
                  <pre style={{ fontSize: "0.78rem", background: "var(--bg-3)", padding: "14px", borderRadius: "10px", overflowX: "auto", whiteSpace: "pre-wrap", color: "var(--text-secondary)", maxHeight: "360px", overflowY: "auto" }}>
                    {JSON.stringify(aiResult.result, null, 2)}
                  </pre>
                  {aiResult.source && <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "6px" }}>Source: {aiResult.source}</p>}
                </div>
              </div>
            )}

            {/* Demand index matrix quick-view */}
            {productAI?.demand_index && (
              <div className="card">
                <div className="card-body">
                  <p style={{ fontWeight: 700, marginBottom: "12px" }}>📊 Demand Index — Nigerian Market</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px" }}>
                    {Object.entries(productAI.demand_index).sort(([,a],[,b]) => b-a).map(([cat, score]) => (
                      <div key={cat} style={{ padding: "8px 12px", background: "var(--surface)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 600, textTransform: "capitalize" }}>{cat.replace(/_/g," ")}</span>
                        <span style={{ fontSize: "0.82rem", fontWeight: 800, color: score >= 0.85 ? "var(--success)" : score >= 0.70 ? "var(--warning)" : "var(--text-secondary)" }}>
                          {(score * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SITE TESTS ────────────────────────────────────────────────────── */}
        {tab === "sitetest" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="alert alert-info" style={{ fontSize: "0.82rem" }}>
              🧪 <strong>Site Testing</strong> — Run health checks against all key routes. Tests both the <strong>Deployed app</strong> and the <strong>Dev server</strong>. All fixes should be verified here after deployment.
            </div>

            {/* Target selector */}
            <div className="card">
              <div className="card-body">
                <p style={{ fontWeight: 700, marginBottom: "12px" }}>🎯 Test Target</p>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
                  {[
                    { key: "deployed", label: "🌐 Deployed App", url: DEPLOYED_URL },
                    { key: "dev",      label: "🖥️ Dev Server",   url: "http://localhost:5000" },
                  ].map(({ key, label, url }) => (
                    <button key={key} onClick={() => setTestTarget(key)} style={{
                      padding: "10px 20px", borderRadius: "10px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem",
                      background: testTarget === key ? "rgba(0,163,255,0.12)" : "var(--surface)",
                      color: testTarget === key ? "var(--dz-blue)" : "var(--text-secondary)",
                      outline: testTarget === key ? "2px solid var(--dz-blue)" : "1px solid var(--border)",
                    }}>
                      {label}<br /><span style={{ fontSize: "0.68rem", fontWeight: 400, opacity: 0.7 }}>{url}</span>
                    </button>
                  ))}
                </div>
                <button onClick={runSiteTests} disabled={testLoading} className="btn btn-primary">
                  {testLoading ? "⏳ Running tests…" : "▶ Run All Tests"}
                </button>
              </div>
            </div>

            {aiMsg && tab === "sitetest" && <div className={`alert ${aiMsg.type === "error" ? "alert-error" : "alert-success"}`}>{aiMsg.text}</div>}

            {/* Results */}
            {siteTests && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* Summary */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                  {[
                    { label: "Passed",    value: siteTests.passed,     color: "var(--success)"   },
                    { label: "Failed",    value: siteTests.failed,     color: siteTests.failed > 0 ? "var(--danger)" : "var(--text-muted)" },
                    { label: "Total",     value: siteTests.total,      color: "var(--text)"      },
                    { label: "Avg ms",    value: siteTests.avg_latency_ms, color: siteTests.avg_latency_ms > 2000 ? "var(--warning)" : "var(--success)" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="stat-tile">
                      <p style={{ fontSize: "1.5rem", fontWeight: 900, color }}>{value}</p>
                      <p className="stat-label">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Route results */}
                <div className="card">
                  <div className="card-body">
                    <p style={{ fontWeight: 700, marginBottom: "12px" }}>Route Results</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {siteTests.routes.map(r => (
                        <div key={r.path} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: r.ok ? "rgba(0,204,136,0.04)" : "rgba(255,59,92,0.06)", borderRadius: "8px", border: `1px solid ${r.ok ? "rgba(0,204,136,0.15)" : "rgba(255,59,92,0.2)"}` }}>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{r.label}</span>
                            <code style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginLeft: "8px" }}>{r.path}</code>
                          </div>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{r.latency_ms}ms</span>
                            <span className={`badge ${r.ok ? "badge-success" : "badge-danger"}`}>
                              {r.ok ? `✓ ${r.status}` : r.status ? `✗ ${r.status}` : "✗ Error"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DEPLOY ────────────────────────────────────────────────────────── */}
        {tab === "deploy" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="alert alert-warning">⚠️ Deploy actions affect production. Always run an audit first.</div>
            {[
              { href: "/deploy",          label: "🚀 Deployment Engine",    desc: "View deployment status and trigger deploys" },
              { href: "/deploy/studio",   label: "🏗️ Build Studio",         desc: "Service build status and logs" },
              { href: "/deploy/apis",     label: "⚡ API Control Center",   desc: "Manage API keys and service connections" },
              { href: "/deploy/features", label: "🔘 Feature Flags",        desc: "Toggle features without redeploy" },
              { href: "/deploy/scaling",  label: "📈 Scale Migration",      desc: "Manage scaling and resource allocation" },
              { href: "/deploy/github",   label: "🐙 GitHub Integration",   desc: "Push/pull the repository" },
              { href: "/deploy/audit",    label: "🔍 Audit Log",            desc: "Review all deployment and operator actions" },
              { href: "/deploy/monitor",  label: "📡 Monitor",              desc: "Live service health and uptime" },
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

        {/* ── DISTRIBUTION ──────────────────────────────────────────────────── */}
        {tab === "distribution" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="grid-2">
              {Object.entries(data?.pwa || {}).filter(([k]) => typeof k === "string" && !["android_path", "ios_path"].includes(k)).map(([key, val]) => (
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
