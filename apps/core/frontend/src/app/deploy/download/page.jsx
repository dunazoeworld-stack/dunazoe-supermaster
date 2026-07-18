"use client";
/**
 * DUNAZOE — Deployment AI + Superuser Control Panel
 * Auto-updates: live clock, 30s status poll, 5m version check,
 * activity log, pulse indicator — all visible in real time.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import PageShell from "../../../components/PageShell";

const API = "";

const FEATURES = [
  { icon: "🔒", title: "5-Gate Security Audit",      desc: "Security ≥90 · Reliability ≥90 · Scalability ≥85 · Performance ≥85 · Readiness ≥90" },
  { icon: "🚀", title: "One-Tap Deployment",          desc: "Deploy to NameCheap, AWS, Render, Replit, or VPS with a single tap" },
  { icon: "⏱️", title: "72-Hour Post-Deploy Monitor", desc: "Auto health tracking with WhatsApp alerts on degradation" },
  { icon: "⏪", title: "Instant Rollback",             desc: "Revert to any previous version and restore DB backups" },
  { icon: "🐙", title: "GitHub Sync",                 desc: "Push & pull code changes directly from your phone" },
  { icon: "🔧", title: "Kill-Switch Controls",         desc: "Disable payments, login, or notifications without downtime" },
  { icon: "📊", title: "34-Service Health Board",     desc: "Live status of every microservice in the DUNAZOE platform" },
  { icon: "🤖", title: "AI Studio",                   desc: "Generate code proposals, changesets, and deployment guides" },
];

const INSTALL_STEPS = {
  android: [
    { n: 1, text: "Open this page in Chrome on your Android phone" },
    { n: 2, text: "Tap the ⋮ menu (top-right corner)" },
    { n: 3, text: 'Tap "Add to Home Screen"' },
    { n: 4, text: 'Tap "Add" on the confirmation dialog' },
    { n: 5, text: "The DUNAZOE Superuser app icon now appears on your home screen 🎉" },
  ],
  ios: [
    { n: 1, text: "Open this page in Safari on your iPhone or iPad" },
    { n: 2, text: "Tap the Share button (□ with ↑ arrow) at the bottom" },
    { n: 3, text: 'Scroll down and tap "Add to Home Screen"' },
    { n: 4, text: 'Tap "Add" (top-right)' },
    { n: 5, text: "The DUNAZOE Superuser app icon now appears on your home screen 🎉" },
  ],
};

const CONTROL_ACTIONS = [
  { label: "▶ Run Full Audit",   path: "/deployment/audit",       method: "POST", color: "#FF4500", body: {} },
  { label: "📊 Platform Status", path: "/deployment/status",      method: "GET",  color: "#FF6B00", body: null },
  { label: "⏱ Monitor Health",  path: "/deployment/monitor",     method: "GET",  color: "#10B981", body: null },
  { label: "🐙 GitHub Status",   path: "/deployment/github",      method: "GET",  color: "#6D28D9", body: null },
  { label: "💾 Backup State",    path: "/deployment/self/backup", method: "POST", color: "#F59E0B", body: {} },
  { label: "⏪ Rollback",        path: "/deployment/rollback",    method: "POST", color: "#EF4444", body: { version: "previous" } },
];

const STATUS_POLL_MS  = 30_000;   // 30 s
const VERSION_POLL_MS = 5 * 60_000; // 5 min
const MAX_LOG         = 12;
let   LOG_SEQ         = 0;   // monotonic counter — avoids duplicate React keys

function fmt(d) {
  return d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const SUPERUSERS = ["dunazoeworld@gmail.com", "comfortwins@gmail.com"];

export default function DeployDownloadPage() {
  const [platform,      setPlatform]      = useState("android");
  const [status,        setStatus]        = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [actionResult,  setActionResult]  = useState(null);
  const [runningAction, setRunningAction] = useState(null);
  const [isPWA,         setIsPWA]         = useState(false);
  const [pageUrl,       setPageUrl]       = useState("/deploy/download");

  // ── Superuser access guard ────────────────────────────────────
  const [accessGranted, setAccessGranted] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  // ── Live clock ────────────────────────────────────────────────
  const [clock,          setClock]          = useState("");
  const [secsAgo,        setSecsAgo]        = useState(0);
  const [versionSecsAgo, setVersionSecsAgo] = useState(0);
  const lastStatusPoll   = useRef(Date.now());
  const lastVersionCheck = useRef(Date.now());

  // ── Version ───────────────────────────────────────────────────
  const [versionInfo,    setVersionInfo]    = useState(null);
  const [updateBanner,   setUpdateBanner]   = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  // ── Activity log ──────────────────────────────────────────────
  const [activityLog, setActivityLog] = useState([]);
  const addLog = useCallback((icon, msg) => {
    const id = ++LOG_SEQ;
    setActivityLog(prev => [
      { id, icon, msg, time: fmt(new Date()) },
      ...prev.slice(0, MAX_LOG - 1),
    ]);
  }, []);

  // ── Pulsing fetch indicator ────────────────────────────────────
  const [fetching, setFetching] = useState(false);

  // ── Access check — runs once on mount ─────────────────────────
  useEffect(() => {
    try {
      const token = localStorage.getItem("dunazoe_token");
      const user  = JSON.parse(localStorage.getItem("dunazoe_user") || "{}");
      const email = (user.email || "").toLowerCase().trim();
      if (token && SUPERUSERS.includes(email)) {
        setAccessGranted(true);
      }
    } catch (_) {}
    setAccessChecked(true);
  }, []);

  // Detect PWA + capture URL
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true;
    setIsPWA(standalone);
    setPageUrl(window.location.href);
  }, []);

  // ── Live clock tick — every second ────────────────────────────
  useEffect(() => {
    const tick = () => {
      setClock(fmt(new Date()));
      setSecsAgo(Math.floor((Date.now() - lastStatusPoll.current) / 1000));
      setVersionSecsAgo(Math.floor((Date.now() - lastVersionCheck.current) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Version check ──────────────────────────────────────────────
  const checkVersion = useCallback(async (showBanner = false) => {
    setCheckingUpdate(true);
    lastVersionCheck.current = Date.now();
    try {
      const r = await fetch(`${API}/api/version`, { cache: "no-store" });
      const d = await r.json();
      setVersionInfo(d);
      const stored = typeof localStorage !== "undefined" ? localStorage.getItem("dunazoe_app_version") : null;
      if (stored && stored !== d.version) {
        setUpdateBanner({ from: stored, to: d.version, features: d.features || [], updated: d.updated });
        addLog("🔔", `Update detected: v${stored} → v${d.version}`);
      } else if (showBanner) {
        setUpdateBanner({ current: true, version: d.version, updated: d.updated, features: d.features || [] });
        addLog("✅", `Platform v${d.version} — up to date (updated ${d.updated})`);
      } else {
        addLog("🔄", `Version check OK — v${d.version} (updated ${d.updated || "—"})`);
      }
      if (typeof localStorage !== "undefined") localStorage.setItem("dunazoe_app_version", d.version);
    } catch (e) {
      addLog("⚠️", "Version check failed — will retry");
    } finally {
      setCheckingUpdate(false);
    }
  }, [addLog]);

  // ── Status poll ────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    setFetching(true);
    lastStatusPoll.current = Date.now();
    try {
      const r = await fetch(`${API}/api/deploy/proxy?path=/deployment/status`);
      const d = await r.json();
      setStatus(d);
      const svcStatus = d.offline ? "offline" : d.platform?.status || "online";
      addLog(
        d.offline ? "🔴" : "🟢",
        `Platform status: ${svcStatus.toUpperCase()}${d.platform?.services ? ` · ${d.platform.services} services` : ""}`
      );
    } catch (_) {
      setStatus({ offline: true, message: "Deployment service unreachable" });
      addLog("🔴", "Status poll failed — service unreachable");
    } finally {
      setLoadingStatus(false);
      setFetching(false);
    }
  }, [addLog]);

  // ── Polling setup ──────────────────────────────────────────────
  useEffect(() => {
    fetchStatus();
    checkVersion();
    const tStatus  = setInterval(fetchStatus, STATUS_POLL_MS);
    const tVersion = setInterval(() => checkVersion(false), VERSION_POLL_MS);
    return () => { clearInterval(tStatus); clearInterval(tVersion); };
  }, [fetchStatus, checkVersion]);

  // ── Remote action runner ───────────────────────────────────────
  async function runAction(action) {
    setRunningAction(action.label);
    setActionResult(null);
    addLog("⚡", `Running: ${action.label}`);
    try {
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("dunazoe_token") || "" : "";
      const r = await fetch(`${API}/api/deploy/proxy?path=${action.path}`, {
        method: action.method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: action.body ? JSON.stringify(action.body) : undefined,
      });
      const d = await r.json();
      setActionResult({ ok: r.ok, label: action.label, data: d });
      addLog(r.ok ? "✅" : "❌", `${action.label}: ${r.ok ? "success" : "failed"}`);
    } catch (err) {
      setActionResult({ ok: false, label: action.label, data: { error: err.message } });
      addLog("❌", `${action.label}: ${err.message}`);
    } finally {
      setRunningAction(null);
    }
  }

  const statusColor = status?.offline ? "#EF4444" : status?.ok === false ? "#F59E0B" : "#10B981";
  const statusText  = status?.offline ? "Offline" : (status?.platform?.status || (status?.ok === false ? "Degraded" : "Online"));

  // ── Access gate ────────────────────────────────────────────────
  if (!accessChecked) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="dz-spinner" />
      </div>
    );
  }
  if (!accessGranted) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "12px", padding: "24px" }}>
        <span style={{ fontSize: "3rem" }}>🔒</span>
        <h2 style={{ fontWeight: 800, fontSize: "1.2rem", textAlign: "center" }}>Restricted Area</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", maxWidth: "320px" }}>
          This panel is not publicly accessible.
        </p>
        <a href="/" style={{ marginTop: "8px", fontSize: "0.82rem", color: "var(--dz-blue)" }}>← Go back</a>
      </div>
    );
  }

  return (
    <PageShell
      title="Deployment AI · Superuser Panel"
      icon="🚀"
      subtitle={isPWA ? "Running as installed app ✓" : "Install this page as a PWA for full phone control"}
      authRequired={false}
    >
      {/* ── LIVE MONITOR BAR ──────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px",
        padding: "10px 16px", borderRadius: "12px", marginBottom: "20px",
        background: "rgba(255,107,0,0.06)", border: "1px solid rgba(255,107,0,0.2)",
      }}>
        {/* Pulse + status */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{
            width: "10px", height: "10px", borderRadius: "50%", display: "inline-block",
            background: statusColor, flexShrink: 0,
            boxShadow: fetching ? `0 0 0 4px ${statusColor}44` : "none",
            transition: "box-shadow 0.3s",
          }} />
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: statusColor }}>{statusText.toUpperCase()}</span>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            · refreshed {secsAgo}s ago · next in {Math.max(0, Math.round(STATUS_POLL_MS / 1000) - secsAgo)}s
          </span>
        </div>
        {/* Live clock */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontFamily: "monospace" }}>🕐 {clock}</span>
          <button
            onClick={() => { fetchStatus(); checkVersion(true); }}
            disabled={fetching || checkingUpdate}
            style={{
              padding: "5px 12px", borderRadius: "7px", border: "1px solid rgba(255,107,0,0.3)",
              background: "rgba(255,107,0,0.1)", color: "#FF6B00", fontWeight: 700,
              fontSize: "0.75rem", cursor: "pointer",
            }}
          >
            {fetching || checkingUpdate ? "⏳ Checking…" : `🔄 Refresh${versionInfo ? ` · v${versionInfo.version}` : ""}`}
          </button>
        </div>
      </div>

      {/* ── UPDATE BANNER ─────────────────────────────────────────────────── */}
      {updateBanner && (
        <div style={{
          padding: "14px 18px", borderRadius: "12px", marginBottom: "18px",
          background: updateBanner.current ? "rgba(16,185,129,0.08)" : "linear-gradient(135deg,rgba(255,107,0,0.18),rgba(255,70,0,0.08))",
          border: `1px solid ${updateBanner.current ? "rgba(16,185,129,0.3)" : "rgba(255,107,0,0.4)"}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontWeight: 800, fontSize: "0.9rem", marginBottom: "4px", color: updateBanner.current ? "#10B981" : "#FF6B00" }}>
                {updateBanner.current
                  ? `✅ v${updateBanner.version} — Up to Date`
                  : `🔔 Update: v${updateBanner.from} → v${updateBanner.to}`}
              </p>
              <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginBottom: updateBanner.features?.length ? "8px" : 0 }}>
                {updateBanner.updated ? `Last updated: ${updateBanner.updated}` : ""}
              </p>
              {updateBanner.features?.length > 0 && (
                <ul style={{ paddingLeft: "16px", margin: 0, fontSize: "0.76rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
                  {updateBanner.features.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              )}
            </div>
            <button onClick={() => setUpdateBanner(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", fontSize:"1rem" }}>✕</button>
          </div>
        </div>
      )}

      {/* ── LIVE STATUS CARD ──────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <div className="card-body">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
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
              ⚠️ {status.message || "Deployment service offline"} — monitoring continues automatically.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "10px" }}>
              {[
                { label: "Services", value: status?.platform?.services || "34" },
                { label: "Version",  value: status?.platform?.version  || versionInfo?.version || "2.0.0" },
                { label: "Uptime",   value: status?.uptime  || "—" },
                { label: "Audits",   value: status?.total_audits || "—" },
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

      {/* ── ACTIVITY LOG ──────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div className="card-body" style={{ padding: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
              📋 Auto-Update Activity Log
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10B981", display: "inline-block",
                animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: "0.68rem", color: "#10B981", fontWeight: 700 }}>LIVE</span>
            </div>
          </div>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
          {activityLog.length === 0 ? (
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Waiting for first poll…</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "180px", overflowY: "auto" }}>
              {activityLog.map(entry => (
                <div key={entry.id} style={{
                  display: "flex", gap: "8px", alignItems: "baseline",
                  padding: "5px 8px", borderRadius: "7px", background: "rgba(255,255,255,0.02)",
                  borderLeft: "2px solid rgba(255,107,0,0.2)",
                }}>
                  <span style={{ fontSize: "0.9rem", flexShrink: 0 }}>{entry.icon}</span>
                  <span style={{ fontSize: "0.76rem", color: "var(--text-secondary)", flex: 1 }}>{entry.msg}</span>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "monospace", flexShrink: 0 }}>{entry.time}</span>
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "8px" }}>
            Status: every 30s · Version: every 5 min · Next status check in {Math.max(0, Math.round(STATUS_POLL_MS / 1000) - secsAgo)}s
          </p>
        </div>
      </div>

      {/* ── REMOTE CONTROL ────────────────────────────────────────────────── */}
      <h2 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: "14px" }}>🎛️ Remote Control</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "20px" }}>
        {CONTROL_ACTIONS.map(action => (
          <button
            key={action.label}
            onClick={() => runAction(action)}
            disabled={!!runningAction}
            style={{
              padding: "14px 10px", borderRadius: "12px", cursor: "pointer",
              background: `${action.color}18`, border: `1px solid ${action.color}44`,
              color: action.color, fontWeight: 700, fontSize: "0.82rem",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
              opacity: runningAction && runningAction !== action.label ? 0.5 : 1,
              transition: "all 0.2s",
            }}
          >
            <span style={{ fontSize: "1.2rem" }}>{action.label.split(" ")[0]}</span>
            <span>{runningAction === action.label ? "Running…" : action.label.replace(/^.+ /, "")}</span>
          </button>
        ))}
      </div>

      {actionResult && (
        <div style={{
          padding: "14px 18px", borderRadius: "12px", marginBottom: "24px",
          background: actionResult.ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
          border: `1px solid ${actionResult.ok ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
        }}>
          <p style={{ fontWeight: 700, marginBottom: "8px", fontSize: "0.88rem", color: actionResult.ok ? "#10B981" : "#EF4444" }}>
            {actionResult.ok ? "✅" : "❌"} {actionResult.label}
          </p>
          <pre style={{ fontSize: "0.73rem", color: "var(--text-secondary)", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "160px" }}>
            {JSON.stringify(actionResult.data, null, 2)}
          </pre>
        </div>
      )}

      {/* ── PWA INSTALL ───────────────────────────────────────────────────── */}
      {!isPWA && (
        <div style={{
          padding: "18px 20px", borderRadius: "16px", marginBottom: "28px",
          background: "linear-gradient(135deg, rgba(255,70,0,0.18), rgba(255,107,0,0.08))",
          border: "1px solid rgba(255,107,0,0.3)",
        }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: "8px" }}>📲 Install Superuser App on Your Phone</h2>
          <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "18px" }}>
            This IS the DUNAZOE Deployment AI superuser app. Install it once — it runs offline,
            appears on your home screen, and gives you full remote control.
          </p>
          <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
            {["android", "ios"].map(p => (
              <button key={p} onClick={() => setPlatform(p)} style={{
                padding: "7px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "0.82rem",
                background: platform === p ? "var(--dz-gradient)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${platform === p ? "transparent" : "var(--border)"}`, color: "#fff",
              }}>
                {p === "android" ? "🤖 Android" : "🍎 iOS / iPad"}
              </button>
            ))}
          </div>
          <ol style={{ paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
            {INSTALL_STEPS[platform].map(s => (
              <li key={s.n} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <span style={{ minWidth: "28px", height: "28px", borderRadius: "50%", background: "var(--dz-gradient)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.78rem", flexShrink: 0 }}>{s.n}</span>
                <p style={{ fontSize: "0.86rem", color: "var(--text-secondary)", paddingTop: "4px" }}>{s.text}</p>
              </li>
            ))}
          </ol>
          <div style={{ marginTop: "18px", padding: "10px 14px", borderRadius: "10px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", fontSize: "0.79rem", color: "var(--text-muted)" }}>
            📎 Share to phone:{" "}
            <span onClick={() => navigator.clipboard?.writeText(pageUrl)} style={{ color: "#FF6B00", cursor: "pointer", fontWeight: 600, wordBreak: "break-all" }}>
              {pageUrl}
            </span>
            {" "}(tap to copy)
          </div>
        </div>
      )}

      {/* ── QUICK NAV ─────────────────────────────────────────────────────── */}
      <h2 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: "12px" }}>🗂️ Control Panel Pages</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginBottom: "32px" }}>
        {[
          { href: "/deploy/status",    icon: "📊", label: "Status" },
          { href: "/deploy/monitor",   icon: "⏱",  label: "Monitor" },
          { href: "/deploy/audit",     icon: "🔍", label: "Audit" },
          { href: "/deploy/github",    icon: "🐙", label: "GitHub" },
          { href: "/deploy/self",      icon: "🔧", label: "Self-Manage" },
          { href: "/deploy/scaling",   icon: "📈", label: "Scaling" },
          { href: "/deploy/releases",  icon: "🏷",  label: "Releases" },
          { href: "/deploy/assistant", icon: "🤖", label: "AI Studio" },
          { href: "/ops",              icon: "⚙️", label: "Ops Cockpit" },
          { href: "/admin",            icon: "👑", label: "Admin" },
        ].map(({ href, icon, label }) => (
          <Link key={href} href={href} className="card" style={{ textDecoration: "none" }}>
            <div className="card-body" style={{ textAlign: "center", padding: "14px" }}>
              <span style={{ fontSize: "1.3rem", display: "block", marginBottom: "4px" }}>{icon}</span>
              <p style={{ fontWeight: 600, fontSize: "0.78rem" }}>{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <h2 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: "12px" }}>🏆 Superuser App Features</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px", marginBottom: "32px" }}>
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

      {/* ── VERSION FOOTER (live from API) ────────────────────────────────── */}
      <div style={{
        padding: "14px 18px", borderRadius: "12px",
        background: "rgba(255,107,0,0.04)", border: "1px solid var(--border)",
        fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.8,
      }}>
        <strong style={{ color: "var(--text)" }}>
          Platform {versionInfo ? `v${versionInfo.version}` : "v2.0.0"}
        </strong>
        {" · 34 microservices · "}
        {versionInfo?.features ? versionInfo.features.slice(0, 3).join(" · ") : "Chat AI · Notification AI · Marketing AI"}
        {" · Built by DUNAZOE Engineering"}
        {versionInfo?.updated ? ` · Updated ${versionInfo.updated}` : ""}
        {" · "}<span style={{ fontFamily: "monospace", color: "#FF6B00" }}>{clock}</span>
      </div>
    </PageShell>
  );
}
