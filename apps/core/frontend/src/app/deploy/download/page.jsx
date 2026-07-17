"use client";
/**
 * DUNAZOE — Deployment AI + Superuser Control Panel
 * This IS the standalone app. Install it as a PWA on your phone via the steps below.
 * Once installed, it gives you full remote control over the 34-service DUNAZOE platform.
 */
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../../components/PageShell";

const API = "";   // same origin

const FEATURES = [
  { icon: "🔒", title: "5-Gate Security Audit",    desc: "Security ≥90 · Reliability ≥90 · Scalability ≥85 · Performance ≥85 · Readiness ≥90" },
  { icon: "🚀", title: "One-Tap Deployment",        desc: "Deploy to NameCheap, AWS, Render, Replit, or VPS with a single tap" },
  { icon: "⏱️", title: "72-Hour Post-Deploy Monitor", desc: "Auto health tracking with WhatsApp alerts on degradation" },
  { icon: "⏪", title: "Instant Rollback",           desc: "Revert to any previous version and restore DB backups" },
  { icon: "🐙", title: "GitHub Sync",               desc: "Push & pull code changes directly from your phone" },
  { icon: "🔧", title: "Kill-Switch Controls",       desc: "Disable payments, login, or notifications without downtime" },
  { icon: "📊", title: "34-Service Health Board",   desc: "Live status of every microservice in the DUNAZOE platform" },
  { icon: "🤖", title: "AI Studio",                 desc: "Generate code proposals, changesets, and deployment guides" },
];

const INSTALL_STEPS = {
  android: [
    { n: 1, text: 'Open this page in Chrome on your Android phone' },
    { n: 2, text: 'Tap the ⋮ menu (top-right corner)' },
    { n: 3, text: 'Tap "Add to Home Screen"' },
    { n: 4, text: 'Tap "Add" on the confirmation dialog' },
    { n: 5, text: 'The DUNAZOE Superuser app icon now appears on your home screen 🎉' },
  ],
  ios: [
    { n: 1, text: 'Open this page in Safari on your iPhone or iPad' },
    { n: 2, text: 'Tap the Share button (□ with ↑ arrow) at the bottom' },
    { n: 3, text: 'Scroll down and tap "Add to Home Screen"' },
    { n: 4, text: 'Tap "Add" (top-right)' },
    { n: 5, text: 'The DUNAZOE Superuser app icon now appears on your home screen 🎉' },
  ],
};

const CONTROL_ACTIONS = [
  { label: "▶ Run Full Audit",    path: "/deployment/audit",              method: "POST", color: "#FF4500", body: {} },
  { label: "📊 Platform Status",  path: "/deployment/status",             method: "GET",  color: "#FF6B00", body: null },
  { label: "⏱ Monitor Health",   path: "/deployment/monitor",            method: "GET",  color: "#10B981", body: null },
  { label: "🐙 GitHub Status",    path: "/deployment/github",             method: "GET",  color: "#6D28D9", body: null },
  { label: "💾 Backup State",     path: "/deployment/self/backup",        method: "POST", color: "#F59E0B", body: {} },
  { label: "⏪ Rollback",         path: "/deployment/rollback",           method: "POST", color: "#EF4444", body: { version: "previous" } },
];

export default function DeployDownloadPage() {
  const [platform,    setPlatform]    = useState("android");
  const [status,      setStatus]      = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [actionResult, setActionResult] = useState(null);
  const [runningAction, setRunningAction] = useState(null);
  const [isPWA,        setIsPWA]       = useState(false);
  const [pageUrl,      setPageUrl]     = useState("/deploy/download");

  // Detect if already running as PWA + capture URL client-side (avoids SSR hydration mismatch)
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true;
    setIsPWA(standalone);
    setPageUrl(window.location.href);
  }, []);

  // Fetch platform status on mount
  useEffect(() => {
    async function fetchStatus() {
      try {
        const r = await fetch(`${API}/api/deploy/proxy?path=/deployment/status`);
        const d = await r.json();
        setStatus(d);
      } catch (_) {
        setStatus({ offline: true, message: "Deployment service unreachable" });
      } finally {
        setLoadingStatus(false);
      }
    }
    fetchStatus();
    const t = setInterval(fetchStatus, 30000);
    return () => clearInterval(t);
  }, []);

  async function runAction(action) {
    setRunningAction(action.label);
    setActionResult(null);
    try {
      const r = await fetch(`${API}/api/deploy/proxy?path=${action.path}`, {
        method: action.method,
        headers: { "Content-Type": "application/json",
          Authorization: `Bearer ${typeof localStorage !== "undefined" ? localStorage.getItem("dunazoe_token") || "" : ""}` },
        body: action.body ? JSON.stringify(action.body) : undefined,
      });
      const d = await r.json();
      setActionResult({ ok: r.ok, label: action.label, data: d });
    } catch (err) {
      setActionResult({ ok: false, label: action.label, data: { error: err.message } });
    } finally {
      setRunningAction(null);
    }
  }

  const statusColor = status?.offline ? "#EF4444" : status?.ok === false ? "#F59E0B" : "#10B981";
  const statusText  = status?.offline ? "Offline" : status?.platform?.status || (status?.ok === false ? "Degraded" : "Online");

  return (
    <PageShell
      title="Deployment AI · Superuser Panel"
      icon="🚀"
      subtitle={isPWA ? "Running as installed app ✓" : "Install this page as a PWA for full phone control"}
      authRequired={false}
    >

      {/* ── PWA Install Banner ─────────────────────────────────────────────── */}
      {!isPWA && (
        <div style={{
          padding: "20px 24px", borderRadius: "16px", marginBottom: "32px",
          background: "linear-gradient(135deg, rgba(255,70,0,0.18), rgba(255,107,0,0.08))",
          border: "1px solid rgba(255,107,0,0.3)",
        }}>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: "8px" }}>
            📲 Install Superuser App on Your Phone
          </h2>
          <p style={{ fontSize: "0.83rem", color: "var(--text-secondary)", marginBottom: "20px" }}>
            This IS the DUNAZOE Deployment AI superuser app. Install it once — it runs offline,
            appears on your home screen, and gives you full remote control of the platform.
          </p>

          {/* Platform toggle */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
            {["android", "ios"].map(p => (
              <button key={p} onClick={() => setPlatform(p)} style={{
                padding: "7px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "0.82rem",
                background: platform === p ? "var(--dz-gradient)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${platform === p ? "transparent" : "var(--border)"}`,
                color: "#fff",
              }}>
                {p === "android" ? "🤖 Android" : "🍎 iOS / iPad"}
              </button>
            ))}
          </div>

          <ol style={{ paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
            {INSTALL_STEPS[platform].map(s => (
              <li key={s.n} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <span style={{
                  minWidth: "28px", height: "28px", borderRadius: "50%",
                  background: "var(--dz-gradient)", display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: "0.78rem", flexShrink: 0,
                }}>{s.n}</span>
                <p style={{ fontSize: "0.86rem", color: "var(--text-secondary)", paddingTop: "4px" }}>{s.text}</p>
              </li>
            ))}
          </ol>

          {/* Share link for phone */}
          <div style={{
            marginTop: "20px", padding: "12px 16px", borderRadius: "10px",
            background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)",
            fontSize: "0.8rem", color: "var(--text-muted)",
          }}>
            📎 Share this URL to your phone:{" "}
            <span
              onClick={() => { navigator.clipboard?.writeText(pageUrl); }}
              style={{ color: "#FF6B00", cursor: "pointer", fontWeight: 600, wordBreak: "break-all" }}
            >
              {pageUrl}
            </span>
            {" "}(tap to copy)
          </div>
        </div>
      )}

      {/* ── Live Platform Status ───────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: "28px" }}>
        <div className="card-body">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 800 }}>📡 Live Platform Status</h2>
            <span style={{
              padding: "4px 12px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: 700,
              background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44`,
            }}>● {statusText}</span>
          </div>
          {loadingStatus ? (
            <div style={{ display: "flex", gap: "10px" }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: "48px", flex: 1, borderRadius: "10px" }} />)}
            </div>
          ) : status?.offline ? (
            <p style={{ fontSize: "0.83rem", color: "var(--text-muted)" }}>
              ⚠️ {status.message} — Start <code style={{ color: "#FF6B00" }}>deployment-ai-service</code> on port 4027 to enable remote control.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px" }}>
              {[
                { label: "Services", value: status?.platform?.services || status?.services || "34" },
                { label: "Version",  value: status?.platform?.version  || status?.version  || "2.0.0" },
                { label: "Uptime",   value: status?.uptime  || "—" },
                { label: "Audits",   value: status?.total_audits || status?.audits || "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  padding: "12px", borderRadius: "10px", background: "rgba(255,107,0,0.06)",
                  border: "1px solid var(--border)", textAlign: "center",
                }}>
                  <p style={{ fontSize: "1.1rem", fontWeight: 800, color: "#FF6B00" }}>{String(value)}</p>
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Remote Control Actions ─────────────────────────────────────────── */}
      <h2 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: "14px" }}>🎛️ Remote Control</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "32px" }}>
        {CONTROL_ACTIONS.map(action => (
          <button
            key={action.label}
            onClick={() => runAction(action)}
            disabled={runningAction === action.label}
            style={{
              padding: "14px 10px", borderRadius: "12px", cursor: "pointer",
              background: `${action.color}18`, border: `1px solid ${action.color}44`,
              color: action.color, fontWeight: 700, fontSize: "0.82rem",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
              transition: "all 0.2s", opacity: runningAction && runningAction !== action.label ? 0.5 : 1,
            }}
          >
            <span style={{ fontSize: "1.2rem" }}>{action.label.split(" ")[0]}</span>
            <span>{runningAction === action.label ? "Running…" : action.label.replace(/^.+ /, "")}</span>
          </button>
        ))}
      </div>

      {/* Action Result */}
      {actionResult && (
        <div style={{
          padding: "16px 20px", borderRadius: "12px", marginBottom: "28px",
          background: actionResult.ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
          border: `1px solid ${actionResult.ok ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
        }}>
          <p style={{ fontWeight: 700, marginBottom: "8px", fontSize: "0.88rem", color: actionResult.ok ? "#10B981" : "#EF4444" }}>
            {actionResult.ok ? "✅" : "❌"} {actionResult.label}
          </p>
          <pre style={{
            fontSize: "0.73rem", color: "var(--text-secondary)", overflowX: "auto",
            whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "160px",
          }}>
            {JSON.stringify(actionResult.data, null, 2)}
          </pre>
        </div>
      )}

      {/* ── Quick Nav ─────────────────────────────────────────────────────── */}
      <h2 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: "14px" }}>🗂️ Control Panel Pages</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginBottom: "36px" }}>
        {[
          { href: "/deploy/status",     icon: "📊", label: "Status" },
          { href: "/deploy/monitor",    icon: "⏱",  label: "Monitor" },
          { href: "/deploy/audit",      icon: "🔍", label: "Audit" },
          { href: "/deploy/github",     icon: "🐙", label: "GitHub" },
          { href: "/deploy/self",       icon: "🔧", label: "Self-Manage" },
          { href: "/deploy/scaling",    icon: "📈", label: "Scaling" },
          { href: "/deploy/releases",   icon: "🏷",  label: "Releases" },
          { href: "/deploy/assistant",  icon: "🤖", label: "AI Studio" },
          { href: "/ops",               icon: "⚙️", label: "Ops Cockpit" },
          { href: "/admin",             icon: "👑", label: "Admin" },
        ].map(({ href, icon, label }) => (
          <Link key={href} href={href} className="card" style={{ textDecoration: "none" }}>
            <div className="card-body" style={{ textAlign: "center", padding: "14px" }}>
              <span style={{ fontSize: "1.3rem", display: "block", marginBottom: "4px" }}>{icon}</span>
              <p style={{ fontWeight: 600, fontSize: "0.78rem" }}>{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── App Features ──────────────────────────────────────────────────── */}
      <h2 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: "14px" }}>🏆 Superuser App Features</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px", marginBottom: "36px" }}>
        {FEATURES.map(({ icon, title, desc }) => (
          <div key={title} className="card">
            <div className="card-body" style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
              <span style={{ fontSize: "1.5rem", flexShrink: 0 }}>{icon}</span>
              <div>
                <p style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "4px" }}>{title}</p>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.5 }}>{desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Version Info ──────────────────────────────────────────────────── */}
      <div style={{
        padding: "16px 20px", borderRadius: "12px",
        background: "rgba(255,107,0,0.04)", border: "1px solid var(--border)",
        fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.8,
      }}>
        <strong style={{ color: "var(--text)" }}>Platform v2.0.0</strong> · 34 microservices ·
        Chat AI · Notification AI · Marketing AI · Logistics AI · Deployment AI ·
        Built by DUNAZOE Engineering · Last updated 16 Jul 2026
      </div>
    </PageShell>
  );
}
