"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const POLL_INTERVAL = 30;
const MAX_HISTORY = 20;

function MetricCard({ label, value, unit, icon, color, sub }) {
  return (
    <div style={{ flex: 1, background: "rgba(13,21,37,0.9)", border: `1px solid ${color}22`, borderRadius: "14px", padding: "14px 12px", textAlign: "center" }}>
      <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>{icon}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 900, color, lineHeight: 1 }}>{value ?? "—"}</div>
      <div style={{ fontSize: "0.62rem", color: "#3D4F6E", marginTop: "2px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>{unit}</div>
      {sub != null && <div style={{ fontSize: "0.75rem", color: "#8A9AB5", marginTop: "4px" }}>{sub}</div>}
      <div style={{ fontSize: "0.68rem", color: "#3D4F6E", marginTop: "6px" }}>{label}</div>
    </div>
  );
}

function TimelineRow({ entry, index, total }) {
  const age   = Math.round((Date.now() - entry.ts) / 1000);
  const color = entry.status.includes("HEALTHY") ? "#00CC88"
              : entry.status.includes("MONITORING") ? "#F5A623" : "#FF3B5C";
  const barW  = Math.max(4, Math.min(100, 100 - (index / total) * 60));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}` }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "99px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${barW}%`, background: color, borderRadius: "99px", opacity: 0.7 }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: "12px", fontSize: "0.72rem", color: "#8A9AB5", flexShrink: 0 }}>
        <span>⚠️ {entry.errors}</span>
        <span>📦 {entry.orders}</span>
        <span>💳 {entry.payments}</span>
        <span style={{ color: "#3D4F6E", fontSize: "0.65rem" }}>{age < 60 ? `${age}s ago` : `${Math.round(age/60)}m ago`}</span>
      </div>
    </div>
  );
}

function Countdown({ seconds, total }) {
  const pct = ((total - seconds) / total) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div style={{ flex: 1, height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "99px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "rgba(0,163,255,0.5)", borderRadius: "99px", transition: "width 1s linear" }} />
      </div>
      <span style={{ fontSize: "0.72rem", color: "#3D4F6E", flexShrink: 0 }}>next in {seconds}s</span>
    </div>
  );
}

export default function MonitorPage() {
  const [token,    setToken]    = useState(null);
  const [data,     setData]     = useState(null);
  const [history,  setHistory]  = useState([]);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [countdown,setCountdown]= useState(POLL_INTERVAL);
  const [lastPoll, setLastPoll] = useState(null);
  const [live,     setLive]     = useState(true);
  const timerRef = useRef(null);
  const cdRef    = useRef(null);

  useEffect(() => {
    const t = localStorage.getItem("dunazoe_token");
    if (t) setToken(t);
  }, []);

  const poll = useCallback(async (t) => {
    const tok = t || token;
    if (!tok) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API}/deployment/monitor`, { headers: { Authorization: `Bearer ${tok}` } });
      const json = await res.json();
      if (!json.success) { setError("Monitor endpoint returned error."); return; }
      setData(json);
      setError("");
      setLastPoll(new Date());
      setHistory(prev => [{
        ts:       Date.now(),
        status:   json.monitor_status,
        errors:   json.last_hour?.service_errors ?? 0,
        orders:   json.last_hour?.new_orders      ?? 0,
        payments: json.last_hour?.successful_payments ?? 0,
      }, ...prev].slice(0, MAX_HISTORY));
    } catch (_) {
      setError("Cannot reach deployment service. Is it running?");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    poll(token);
    timerRef.current = setInterval(() => {
      if (live) { poll(); setCountdown(POLL_INTERVAL); }
    }, POLL_INTERVAL * 1000);
    cdRef.current = setInterval(() => {
      setCountdown(c => c > 1 ? c - 1 : POLL_INTERVAL);
    }, 1000);
    return () => { clearInterval(timerRef.current); clearInterval(cdRef.current); };
  }, [token, live, poll]);

  const errors   = data?.last_hour?.service_errors       ?? null;
  const orders   = data?.last_hour?.new_orders            ?? null;
  const payments = data?.last_hour?.successful_payments   ?? null;
  const status   = data?.monitor_status ?? "—";
  const isHealthy   = status.includes("HEALTHY");
  const isMonitor   = status.includes("MONITORING");
  const statusColor = isHealthy ? "#00CC88" : isMonitor ? "#F5A623" : "#FF3B5C";
  const statusBg    = isHealthy ? "rgba(0,204,136,0.08)" : isMonitor ? "rgba(245,166,35,0.08)" : "rgba(255,59,92,0.08)";

  const inp = { width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(0,163,255,0.2)", borderRadius: "10px", color: "#fff", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" };

  if (!token) return (
    <div style={{ minHeight: "100vh", background: "#0A0E1A", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: "360px", background: "linear-gradient(145deg,#0D1525,#0A1020)", border: "1px solid rgba(0,163,255,0.2)", borderRadius: "24px", padding: "36px" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <Link href="/"><Image src="/assets/dunazoe-logo.jpg" alt="DUNAZOE" width={56} height={56} style={{ borderRadius: "12px" }} /></Link>
          <h1 style={{ marginTop: "10px", fontSize: "1.2rem", fontWeight: 800, background: "linear-gradient(135deg,#00A3FF,#0066FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Production Monitor</h1>
          <p style={{ color: "#8A9AB5", fontSize: "0.8rem" }}>Admin access required</p>
        </div>
        <form onSubmit={async e => {
          e.preventDefault(); setError("");
          const f = new FormData(e.target);
          try {
            const r = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: f.get("email"), password: f.get("password") }) });
            const d = await r.json();
            if (!d.success || !["admin","super_admin","cto"].includes(d.role)) { setError(d.error || "Admin only"); return; }
            localStorage.setItem("dunazoe_token", d.token);
            setToken(d.token);
          } catch (_) { setError("Connection failed"); }
        }} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {error && <div style={{ background: "rgba(255,59,92,0.1)", border: "1px solid rgba(255,59,92,0.3)", borderRadius: "8px", padding: "10px", fontSize: "0.8rem", color: "#FF3B5C" }}>⚠️ {error}</div>}
          <div><label style={{ fontSize: "0.76rem", color: "#8A9AB5", display: "block", marginBottom: "4px" }}>Email</label><input name="email" type="email" required placeholder="admin@dunazoe.com" style={inp} /></div>
          <div><label style={{ fontSize: "0.76rem", color: "#8A9AB5", display: "block", marginBottom: "4px" }}>Password</label><input name="password" type="password" required placeholder="••••••••" style={inp} /></div>
          <button type="submit" style={{ padding: "12px", borderRadius: "10px", background: "linear-gradient(135deg,#00A3FF,#0066FF)", border: "none", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Enter Monitor →</button>
        </form>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0A0E1A", padding: "16px 14px 80px", maxWidth: "500px", margin: "0 auto" }}>

      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
        <Link href="/deploy"><Image src="/assets/dunazoe-logo.jpg" alt="" width={36} height={36} style={{ borderRadius: "8px" }} /></Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "1rem", fontWeight: 800, margin: 0, background: "linear-gradient(135deg,#00A3FF,#0066FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Production Monitor</h1>
          <p style={{ fontSize: "0.65rem", color: "#3D4F6E", margin: 0 }}>Live health · auto-refresh every {POLL_INTERVAL}s</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => { poll(); setCountdown(POLL_INTERVAL); }} style={{ padding: "6px 12px", borderRadius: "8px", background: "rgba(0,163,255,0.1)", border: "1px solid rgba(0,163,255,0.2)", color: "#00A3FF", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}>↺ Now</button>
          <button onClick={() => setLive(l => !l)} style={{ padding: "6px 10px", borderRadius: "8px", background: live ? "rgba(0,204,136,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${live ? "rgba(0,204,136,0.3)" : "rgba(255,255,255,0.08)"}`, color: live ? "#00CC88" : "#3D4F6E", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}>{live ? "⏸" : "▶"}</button>
        </div>
      </div>

      {/* STATUS BADGE */}
      <div style={{ background: statusBg, border: `1px solid ${statusColor}33`, borderRadius: "16px", padding: "16px 18px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "14px" }}>
        <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: statusColor, boxShadow: `0 0 12px ${statusColor}`, flexShrink: 0, animation: isHealthy ? "none" : "pulse 2s infinite" }} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: "1.05rem", color: statusColor }}>{status || "Connecting…"}</p>
          <p style={{ margin: 0, fontSize: "0.76rem", color: "#8A9AB5", marginTop: "2px" }}>{data?.ceo_view?.message || "Waiting for data…"}</p>
        </div>
        {loading && <div style={{ width: "16px", height: "16px", border: "2px solid rgba(0,163,255,0.2)", borderTopColor: "#00A3FF", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
      </div>

      {/* COUNTDOWN */}
      <div style={{ marginBottom: "16px" }}>
        <Countdown seconds={countdown} total={POLL_INTERVAL} />
      </div>

      {/* METRIC CARDS */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        <MetricCard label="Service Errors" value={errors} unit="last hour" icon="⚠️"
          color={errors === 0 ? "#00CC88" : errors > 5 ? "#FF3B5C" : "#F5A623"}
          sub={errors === 0 ? "All clear" : errors > 5 ? "Alert!" : "Watch"} />
        <MetricCard label="New Orders" value={orders} unit="last hour" icon="📦"
          color="#00A3FF" sub={orders > 0 ? `~${orders}/hr` : "None yet"} />
        <MetricCard label="Payments OK" value={payments} unit="last hour" icon="💳"
          color={payments > 0 ? "#00CC88" : "#8A9AB5"}
          sub={payments > 0 ? "Processing" : "Awaiting"} />
      </div>

      {/* ERROR BANNER */}
      {error && <div style={{ background: "rgba(255,59,92,0.08)", border: "1px solid rgba(255,59,92,0.25)", borderRadius: "10px", padding: "10px 12px", marginBottom: "14px", fontSize: "0.8rem", color: "#FF3B5C" }}>⚠️ {error}</div>}

      {/* LAST POLL TIME */}
      {lastPoll && (
        <p style={{ fontSize: "0.68rem", color: "#3D4F6E", textAlign: "right", margin: "0 0 12px" }}>
          Last updated: {lastPoll.toLocaleTimeString("en-NG")}
        </p>
      )}

      {/* TIMELINE */}
      <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(0,163,255,0.08)", borderRadius: "14px", padding: "14px 14px 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <p style={{ margin: 0, fontSize: "0.68rem", color: "#3D4F6E", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Health Timeline</p>
          <p style={{ margin: 0, fontSize: "0.65rem", color: "#3D4F6E" }}>{history.length} readings</p>
        </div>
        {history.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px", color: "#3D4F6E", fontSize: "0.8rem" }}>
            Collecting data… first reading in progress
          </div>
        ) : history.map((entry, i) => (
          <TimelineRow key={entry.ts} entry={entry} index={i} total={history.length} />
        ))}
      </div>

      {/* QUICK ACTIONS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "16px" }}>
        <Link href="/deploy" style={{ padding: "12px", borderRadius: "12px", background: "rgba(0,163,255,0.06)", border: "1px solid rgba(0,163,255,0.15)", color: "#00A3FF", textDecoration: "none", fontWeight: 700, fontSize: "0.82rem", textAlign: "center" }}>← Deployment AI</Link>
        <a href={`${API}/deployment/monitor`} target="_blank" rel="noreferrer" style={{ padding: "12px", borderRadius: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#8A9AB5", textDecoration: "none", fontWeight: 700, fontSize: "0.82rem", textAlign: "center" }}>Raw JSON ↗</a>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  );
}
