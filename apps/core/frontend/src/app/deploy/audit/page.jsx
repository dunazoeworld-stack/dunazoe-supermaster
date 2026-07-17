"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const THRESHOLDS = { security:90, reliability:90, scalability:85, performance:85, readiness:90 };

function ScoreBar({ label, score, threshold }) {
  const pct   = Math.min(100, score || 0);
  const pass  = score >= threshold;
  const color = score >= threshold ? "#00A3FF" : score >= threshold - 10 ? "#F5A623" : "#FF3B5C";
  return (
    <div style={{ marginBottom:"12px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"5px" }}>
        <span style={{ fontSize:"0.8rem", color:"#8A9AB5", fontWeight:600 }}>{label}</span>
        <span style={{ fontSize:"0.8rem", fontWeight:800, color }}>{score ?? "—"}/100 {pass ? "✅" : "❌"}</span>
      </div>
      <div style={{ height:"5px", background:"rgba(255,255,255,0.06)", borderRadius:"99px", overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:"99px", transition:"width 0.8s ease" }} />
      </div>
    </div>
  );
}

function DeployNav() {
  const links = [["/deploy","🚀"],["/deploy/monitor","📡"],["/deploy/status","💚"],["/deploy/logs","📋"],["/deploy/releases","🏷️"],["/deploy/github","🐙"],["/deploy/credits","⚡"],["/deploy/checklist","✅"]];
  return (
    <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginTop:"20px" }}>
      {links.map(([href,icon]) => <Link key={href} href={href} style={{ padding:"8px 12px", borderRadius:"8px", background:"rgba(0,163,255,0.06)", border:"1px solid rgba(0,163,255,0.12)", color:"#8A9AB5", textDecoration:"none", fontSize:"1rem" }}>{icon}</Link>)}
    </div>
  );
}

export default function AuditPage() {
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed]   = useState(false);
  const [token, setToken]     = useState("");
  const [env, setEnv]         = useState("production");
  const [provider, setProvider] = useState("replit");
  const inp = { width:"100%", padding:"11px 13px", background:"rgba(255,255,255,0.05)", border:"1.5px solid rgba(0,163,255,0.2)", borderRadius:"10px", color:"#fff", fontSize:"0.9rem", outline:"none", boxSizing:"border-box" };
  const sel = { ...inp, cursor:"pointer" };

  useEffect(() => {
    const t = localStorage.getItem("dunazoe_token");
    if (t) { setToken(t); setAuthed(true); }
  }, []);

  async function runAudit() {
    setError(""); setLoading(true); setResult(null);
    try {
      const r = await fetch(`${API}/deployment/audit`, { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`}, body:JSON.stringify({ version:"1.0.0-rc1", environment:env, hosting_provider:provider }) });
      const d = await r.json();
      if (d.success) setResult(d); else setError(d.error || "Audit failed");
    } catch { setError("Cannot reach deployment service."); }
    finally { setLoading(false); }
  }

  async function login(e) {
    e.preventDefault(); setError(""); setLoading(true);
    const f = new FormData(e.target);
    try {
      const r = await fetch(`${API}/auth/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email:f.get("email"), password:f.get("password") }) });
      const d = await r.json();
      if (!d.success || !["admin","super_admin","cto"].includes(d.role)) { setError(d.error || "Admin only"); return; }
      localStorage.setItem("dunazoe_token", d.token);
      setToken(d.token); setAuthed(true);
    } catch { setError("Connection failed."); }
    finally { setLoading(false); }
  }

  if (!authed) return (
    <div style={{ minHeight:"100vh", background:"#0A0E1A", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }}>
      <div style={{ width:"100%", maxWidth:"360px", background:"linear-gradient(145deg,#0D1525,#0A1020)", border:"1px solid rgba(0,163,255,0.2)", borderRadius:"20px", padding:"32px" }}>
        <div style={{ textAlign:"center", marginBottom:"20px" }}>
          <Link href="/"><Image src="/assets/dunazoe-logo.jpg" alt="DUNAZOE" width={52} height={52} style={{ borderRadius:"12px" }} /></Link>
          <h1 style={{ marginTop:"10px", fontSize:"1.2rem", fontWeight:800, background:"linear-gradient(135deg,#00A3FF,#0066FF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>Deploy Audit</h1>
        </div>
        {error && <div style={{ background:"rgba(255,59,92,0.1)", border:"1px solid rgba(255,59,92,0.3)", borderRadius:"8px", padding:"10px", marginBottom:"14px", fontSize:"0.8rem", color:"#FF3B5C" }}>⚠️ {error}</div>}
        <form onSubmit={login} style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          <input name="email" type="email" required placeholder="admin@dunazoe.com" style={inp} />
          <input name="password" type="password" required placeholder="Password" style={inp} />
          <button type="submit" disabled={loading} style={{ padding:"12px", borderRadius:"10px", background:"linear-gradient(135deg,#00A3FF,#0066FF)", border:"none", color:"#fff", fontWeight:700, cursor:"pointer" }}>{loading?"...":"Enter →"}</button>
        </form>
      </div>
    </div>
  );

  const approved = result?.approved;
  const scores   = result?.scores || {};

  return (
    <div style={{ minHeight:"100vh", background:"#0A0E1A", padding:"16px 14px 80px", maxWidth:"500px", margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"18px" }}>
        <Link href="/deploy"><Image src="/assets/dunazoe-logo.jpg" alt="" width={36} height={36} style={{ borderRadius:"8px" }} /></Link>
        <div style={{ flex:1 }}>
          <h1 style={{ fontSize:"1rem", fontWeight:800, margin:0, background:"linear-gradient(135deg,#00A3FF,#0066FF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>Deployment Audit</h1>
          <p style={{ fontSize:"0.65rem", color:"#3D4F6E", margin:0 }}>5-gate quality review</p>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"14px" }}>
        <div><label style={{ fontSize:"0.72rem", color:"#8A9AB5", display:"block", marginBottom:"4px" }}>Environment</label>
          <select value={env} onChange={e => setEnv(e.target.value)} style={sel}>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
          </select></div>
        <div><label style={{ fontSize:"0.72rem", color:"#8A9AB5", display:"block", marginBottom:"4px" }}>Host</label>
          <select value={provider} onChange={e => setProvider(e.target.value)} style={sel}>
            <option value="replit">Replit</option>
            <option value="contabo">Contabo</option>
          </select></div>
      </div>

      {error && <div style={{ background:"rgba(255,59,92,0.08)", border:"1px solid rgba(255,59,92,0.25)", borderRadius:"10px", padding:"10px", marginBottom:"12px", fontSize:"0.8rem", color:"#FF3B5C" }}>⚠️ {error}</div>}

      <button onClick={runAudit} disabled={loading} style={{ width:"100%", padding:"15px", borderRadius:"14px", background:loading?"rgba(0,163,255,0.3)":"linear-gradient(135deg,#00A3FF,#0066FF)", border:"none", color:"#fff", fontWeight:800, fontSize:"1rem", cursor:loading?"not-allowed":"pointer", marginBottom:"14px", boxShadow:loading?"none":"0 0 24px rgba(0,163,255,0.3)" }}>
        {loading ? "⏳ Running Audit..." : "🔍 Run Audit"}
      </button>

      {result && (
        <div style={{ background:"rgba(13,21,37,0.95)", border:`1px solid ${approved?"rgba(0,163,255,0.35)":"rgba(255,59,92,0.35)"}`, borderRadius:"14px", padding:"16px", marginBottom:"14px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"16px" }}>
            <span style={{ fontSize:"2rem" }}>{approved?"✅":"🔴"}</span>
            <div>
              <p style={{ margin:0, fontWeight:800, color:approved?"#00A3FF":"#FF3B5C" }}>{result.ceo_summary?.headline}</p>
              <p style={{ margin:0, fontSize:"0.76rem", color:"#8A9AB5", marginTop:"2px" }}>{result.ceo_summary?.explanation?.substring(0,100)}…</p>
            </div>
          </div>
          <ScoreBar label="Security"    score={scores.security}    threshold={THRESHOLDS.security} />
          <ScoreBar label="Reliability" score={scores.reliability} threshold={THRESHOLDS.reliability} />
          <ScoreBar label="Scalability" score={scores.scalability} threshold={THRESHOLDS.scalability} />
          <ScoreBar label="Performance" score={scores.performance} threshold={THRESHOLDS.performance} />
          <ScoreBar label="Readiness"   score={scores.readiness}   threshold={THRESHOLDS.readiness} />
          {!approved && result.blocked_reasons?.length > 0 && (
            <div style={{ marginTop:"12px", padding:"10px", background:"rgba(255,59,92,0.06)", borderRadius:"8px", border:"1px solid rgba(255,59,92,0.2)" }}>
              {result.blocked_reasons.map((r,i) => <p key={i} style={{ fontSize:"0.76rem", color:"#FF3B5C", margin:"2px 0" }}>• {r}</p>)}
            </div>
          )}
          {approved && (
            <Link href="/deploy" style={{ display:"block", marginTop:"12px", padding:"12px", borderRadius:"10px", background:"linear-gradient(135deg,#00CC88,#00A36B)", color:"#fff", fontWeight:800, textAlign:"center", textDecoration:"none" }}>
              🚀 Go to Deploy →
            </Link>
          )}
        </div>
      )}

      <DeployNav />
    </div>
  );
}
