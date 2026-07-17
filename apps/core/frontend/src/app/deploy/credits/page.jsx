"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

function DeployNav() {
  const links = [["/deploy","🚀"],["/deploy/monitor","📡"],["/deploy/status","💚"],["/deploy/logs","📋"],["/deploy/releases","🏷️"],["/deploy/github","🐙"],["/deploy/credits","⚡"],["/deploy/checklist","✅"]];
  return (
    <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginTop:"20px" }}>
      {links.map(([href,icon]) => <Link key={href} href={href} style={{ padding:"8px 12px", borderRadius:"8px", background:"rgba(0,163,255,0.06)", border:"1px solid rgba(0,163,255,0.12)", color:"#8A9AB5", textDecoration:"none", fontSize:"1rem" }}>{icon}</Link>)}
    </div>
  );
}

export default function CreditsPage() {
  const [data, setData]       = useState(null);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed]   = useState(false);
  const [token, setToken]     = useState("");
  const inp = { width:"100%", padding:"11px 13px", background:"rgba(255,255,255,0.05)", border:"1.5px solid rgba(0,163,255,0.2)", borderRadius:"10px", color:"#fff", fontSize:"0.9rem", outline:"none", boxSizing:"border-box" };

  useEffect(() => {
    const t = localStorage.getItem("dunazoe_token");
    if (t) { setToken(t); setAuthed(true); load(t); }
  }, []);

  async function load(t) {
    setLoading(true);
    try {
      const r = await fetch(`${API}/deployment/credits`, { headers:{ Authorization:`Bearer ${t||token}` } });
      const d = await r.json();
      if (d.success) setData(d); else setError(d.error || "Failed");
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
      setToken(d.token); setAuthed(true); load(d.token);
    } catch { setError("Connection failed."); }
    finally { setLoading(false); }
  }

  if (!authed) return (
    <div style={{ minHeight:"100vh", background:"#0A0E1A", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }}>
      <div style={{ width:"100%", maxWidth:"360px", background:"linear-gradient(145deg,#0D1525,#0A1020)", border:"1px solid rgba(0,163,255,0.2)", borderRadius:"20px", padding:"32px" }}>
        <div style={{ textAlign:"center", marginBottom:"20px" }}>
          <Link href="/"><Image src="/assets/dunazoe-logo.jpg" alt="DUNAZOE" width={52} height={52} style={{ borderRadius:"12px" }} /></Link>
          <h1 style={{ marginTop:"10px", fontSize:"1.2rem", fontWeight:800, background:"linear-gradient(135deg,#00A3FF,#0066FF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>Credit Usage</h1>
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

  return (
    <div style={{ minHeight:"100vh", background:"#0A0E1A", padding:"16px 14px 80px", maxWidth:"500px", margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"18px" }}>
        <Link href="/deploy"><Image src="/assets/dunazoe-logo.jpg" alt="" width={36} height={36} style={{ borderRadius:"8px" }} /></Link>
        <div style={{ flex:1 }}>
          <h1 style={{ fontSize:"1rem", fontWeight:800, margin:0, background:"linear-gradient(135deg,#00A3FF,#0066FF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>Credit Usage</h1>
          <p style={{ fontSize:"0.65rem", color:"#3D4F6E", margin:0 }}>{data?.mode || "LOW_CREDIT_MODE"}</p>
        </div>
        <button onClick={() => load(token)} disabled={loading} style={{ padding:"6px 12px", borderRadius:"8px", background:"rgba(0,163,255,0.1)", border:"1px solid rgba(0,163,255,0.2)", color:"#00A3FF", fontSize:"0.72rem", fontWeight:700, cursor:"pointer" }}>↺</button>
      </div>

      {data && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"10px", marginBottom:"14px" }}>
            {[
              { label:"Running", value:data.services_running, unit:"services", color:"#00CC88" },
              { label:"Standby", value:data.services_standby, unit:"services", color:"#F5A623" },
              { label:"RAM Saved", value:`${data.ram_saved_mb}MB`, unit:"freed", color:"#00A3FF" },
            ].map(({ label,value,unit,color },i) => (
              <div key={i} style={{ background:"rgba(13,21,37,0.9)", border:`1px solid ${color}22`, borderRadius:"12px", padding:"12px 10px", textAlign:"center" }}>
                <p style={{ margin:0, fontSize:"1.3rem", fontWeight:900, color }}>{value}</p>
                <p style={{ margin:0, fontSize:"0.6rem", color:"#3D4F6E", fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase" }}>{unit}</p>
                <p style={{ margin:0, fontSize:"0.68rem", color:"#8A9AB5", marginTop:"2px" }}>{label}</p>
              </div>
            ))}
          </div>

          <div style={{ background:"rgba(13,21,37,0.9)", border:"1px solid rgba(0,163,255,0.08)", borderRadius:"14px", padding:"14px 16px", marginBottom:"12px" }}>
            <p style={{ fontSize:"0.68rem", color:"#3D4F6E", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", margin:"0 0 10px" }}>Active Optimizations</p>
            {data.optimizations?.map((opt,i) => (
              <div key={i} style={{ display:"flex", gap:"8px", padding:"7px 0", borderBottom:"1px solid rgba(255,255,255,0.04)", alignItems:"flex-start" }}>
                <span style={{ color:"#00CC88", fontSize:"0.8rem" }}>✓</span>
                <span style={{ fontSize:"0.78rem", color:"#cdd5e0" }}>{opt}</span>
              </div>
            ))}
          </div>

          <div style={{ background:"rgba(0,163,255,0.04)", border:"1px solid rgba(0,163,255,0.15)", borderRadius:"10px", padding:"12px 14px" }}>
            <p style={{ margin:0, fontSize:"0.78rem", color:"#8A9AB5" }}>Target: <strong style={{ color:"#00A3FF" }}>{data.target}</strong> · Audit runs this session: <strong style={{ color:"#00A3FF" }}>{data.audit_runs}</strong></p>
          </div>
        </>
      )}

      {error && <div style={{ background:"rgba(255,59,92,0.08)", border:"1px solid rgba(255,59,92,0.25)", borderRadius:"10px", padding:"10px", marginBottom:"12px", fontSize:"0.8rem", color:"#FF3B5C" }}>⚠️ {error}</div>}

      <DeployNav />
    </div>
  );
}
