"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const STATUS_COLOR = { PASS:"#00CC88", FAIL:"#FF3B5C", WARN:"#F5A623" };

function HealthRow({ name, status, detail }) {
  const c = STATUS_COLOR[status] || "#8A9AB5";
  const icon = status==="PASS"?"✅":status==="FAIL"?"❌":"⚠️";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ fontSize:"1rem", flexShrink:0 }}>{icon}</span>
      <div style={{ flex:1 }}>
        <p style={{ margin:0, fontSize:"0.82rem", fontWeight:600, color:"#cdd5e0" }}>{name}</p>
        {detail && <p style={{ margin:0, fontSize:"0.68rem", color:"#3D4F6E" }}>{detail}</p>}
      </div>
      <span style={{ fontSize:"0.72rem", fontWeight:800, color:c, background:`${c}15`, padding:"3px 8px", borderRadius:"20px", border:`1px solid ${c}33` }}>{status}</span>
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

export default function HealthPage() {
  const [data, setData]       = useState(null);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed]   = useState(false);
  const [token, setToken]     = useState("");
  const [live, setLive]       = useState(true);
  const inp = { width:"100%", padding:"11px 13px", background:"rgba(255,255,255,0.05)", border:"1.5px solid rgba(0,163,255,0.2)", borderRadius:"10px", color:"#fff", fontSize:"0.9rem", outline:"none", boxSizing:"border-box" };

  useEffect(() => {
    const t = localStorage.getItem("dunazoe_token");
    if (t) { setToken(t); setAuthed(true); load(t); }
  }, []);

  const load = useCallback(async (t) => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/deployment/health/detailed`, { headers:{ Authorization:`Bearer ${t||token}` } });
      const d = await r.json();
      if (d.success) setData(d); else setError(d.error || "Failed");
    } catch { setError("Cannot reach deployment service."); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    if (!authed || !token) return;
    if (!live) return;
    const id = setInterval(() => load(token), 30000);
    return () => clearInterval(id);
  }, [authed, token, live, load]);

  async function login(e) {
    e.preventDefault(); setError(""); setLoading(true);
    const f = new FormData(e.target);
    try {
      const r = await fetch(`${API}/auth/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email:f.get("email"), password:f.get("password") }) });
      const d = await r.json();
      if (!d.success || !["admin","super_admin","cto"].includes(d.role)) { setError(d.error || "Admin only"); return; }
      localStorage.setItem("dunazoe_token", d.token);
      setToken(d.token); setAuthed(true); load(d.token);
    } catch { setError("Connection failed."); }
    finally { setLoading(false); }
  }

  if (!authed) return (
    <div style={{ minHeight:"100vh", background:"#0A0E1A", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }}>
      <div style={{ width:"100%", maxWidth:"360px", background:"linear-gradient(145deg,#0D1525,#0A1020)", border:"1px solid rgba(0,163,255,0.2)", borderRadius:"20px", padding:"32px" }}>
        <div style={{ textAlign:"center", marginBottom:"20px" }}>
          <Link href="/"><Image src="/assets/dunazoe-logo.jpg" alt="DUNAZOE" width={52} height={52} style={{ borderRadius:"12px" }} /></Link>
          <h1 style={{ marginTop:"10px", fontSize:"1.2rem", fontWeight:800, background:"linear-gradient(135deg,#00A3FF,#0066FF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>Deep Health</h1>
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

  const overall = data?.overall;
  const oc = STATUS_COLOR[overall] || "#8A9AB5";

  return (
    <div style={{ minHeight:"100vh", background:"#0A0E1A", padding:"16px 14px 80px", maxWidth:"500px", margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"18px" }}>
        <Link href="/deploy"><Image src="/assets/dunazoe-logo.jpg" alt="" width={36} height={36} style={{ borderRadius:"8px" }} /></Link>
        <div style={{ flex:1 }}>
          <h1 style={{ fontSize:"1rem", fontWeight:800, margin:0, background:"linear-gradient(135deg,#00A3FF,#0066FF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>Deep Health Check</h1>
          <p style={{ fontSize:"0.65rem", color:"#3D4F6E", margin:0 }}>All services · auto-refresh 30s</p>
        </div>
        <div style={{ display:"flex", gap:"6px" }}>
          <button onClick={() => load(token)} disabled={loading} style={{ padding:"6px 10px", borderRadius:"8px", background:"rgba(0,163,255,0.1)", border:"1px solid rgba(0,163,255,0.2)", color:"#00A3FF", fontSize:"0.72rem", fontWeight:700, cursor:"pointer" }}>↺</button>
          <button onClick={() => setLive(l => !l)} style={{ padding:"6px 10px", borderRadius:"8px", background:live?"rgba(0,204,136,0.1)":"rgba(255,255,255,0.04)", border:`1px solid ${live?"rgba(0,204,136,0.3)":"rgba(255,255,255,0.08)"}`, color:live?"#00CC88":"#3D4F6E", fontSize:"0.72rem", fontWeight:700, cursor:"pointer" }}>{live?"⏸":"▶"}</button>
        </div>
      </div>

      {data && (
        <div style={{ background:`${oc}0D`, border:`1px solid ${oc}33`, borderRadius:"14px", padding:"13px 16px", marginBottom:"14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <p style={{ margin:0, fontWeight:800, color:oc, fontSize:"1.05rem" }}>{overall}</p>
            <p style={{ margin:0, fontSize:"0.7rem", color:"#3D4F6E" }}>{data.summary.passed} PASS · {data.summary.warned} WARN · {data.summary.failed} FAIL · {data.summary.total} total</p>
          </div>
          {loading && <div style={{ width:"14px", height:"14px", border:"2px solid rgba(0,163,255,0.2)", borderTopColor:"#00A3FF", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />}
        </div>
      )}

      {error && <div style={{ background:"rgba(255,59,92,0.08)", border:"1px solid rgba(255,59,92,0.25)", borderRadius:"10px", padding:"10px", marginBottom:"12px", fontSize:"0.8rem", color:"#FF3B5C" }}>⚠️ {error}</div>}
      {loading && !data && <div style={{ textAlign:"center", padding:"40px", color:"#3D4F6E" }}>Running health checks…</div>}

      {data && (
        <div style={{ background:"rgba(13,21,37,0.9)", border:"1px solid rgba(0,163,255,0.08)", borderRadius:"14px", padding:"14px 16px" }}>
          <p style={{ fontSize:"0.68rem", color:"#3D4F6E", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", margin:"0 0 4px" }}>Service Health</p>
          {data.checks.map((c,i) => <HealthRow key={i} name={c.name} status={c.status} detail={c.detail} />)}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <DeployNav />
    </div>
  );
}
