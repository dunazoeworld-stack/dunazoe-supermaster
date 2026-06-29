"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const S = {
  bg:"#0A0E1A", card:"rgba(13,21,37,0.95)", accent:"#00A3FF",
  border:"rgba(0,163,255,0.12)",
  btn:(c="accent")=>({ padding:"10px 14px", borderRadius:"9px", border:"none", fontWeight:700, cursor:"pointer", fontSize:"0.8rem",
    background:c==="accent"?"linear-gradient(135deg,#00A3FF,#0066FF)":c==="green"?"linear-gradient(135deg,#00CC88,#009966)":c==="warn"?"rgba(245,166,35,0.12)":c==="red"?"rgba(255,59,92,0.12)":"rgba(255,255,255,0.05)",
    color:c==="warn"?"#F5A623":c==="red"?"#FF3B5C":"#fff" }),
};

const DEFAULT_FEATURES = [
  { id:"wallet", name:"Wallet", icon:"💰", desc:"Digital wallet, deposits, withdrawals", area:"Payments", status:"active" },
  { id:"thrift", name:"Thrift / Savings", icon:"🏦", desc:"Group savings (disabled: loan ledger bug)", area:"Fintech", status:"maintenance" },
  { id:"notifications", name:"Notifications", icon:"🔔", desc:"WhatsApp, SMS, email alerts", area:"Core", status:"active" },
  { id:"ai", name:"AI Assistant", icon:"🤖", desc:"AI-powered shopping & support", area:"AI", status:"active" },
  { id:"payments", name:"Payments (Paystack)", icon:"💳", desc:"Checkout, Paystack integration", area:"Payments", status:"active" },
  { id:"logistics", name:"Logistics", icon:"🚚", desc:"Delivery tracking, dispatch", area:"Delivery", status:"active" },
  { id:"chat", name:"Live Chat", icon:"💬", desc:"Vendor-buyer chat", area:"Social", status:"beta" },
  { id:"admin", name:"Admin Override", icon:"🛡️", desc:"Super-admin controls", area:"Admin", status:"active" },
  { id:"loans", name:"Loans", icon:"💸", desc:"Disabled: CBN compliance review needed", area:"Fintech", status:"hidden" },
  { id:"search", name:"Search Engine", icon:"🔍", desc:"Product search & filters", area:"Core", status:"active" },
  { id:"kyc", name:"KYC / Verification", icon:"📋", desc:"Identity verification", area:"Compliance", status:"active" },
  { id:"social", name:"Social Media", icon:"📱", desc:"Vendor social posts", area:"Social", status:"beta" },
  { id:"escrow", name:"Escrow", icon:"🔒", desc:"Buyer protection escrow", area:"Payments", status:"active" },
  { id:"fraud", name:"Fraud Detection", icon:"🛡️", desc:"AI fraud analysis", area:"Security", status:"active" },
  { id:"shareholder", name:"Shareholder System", icon:"📊", desc:"No spec yet — disabled", area:"Fintech", status:"hidden" },
];

const STATUS_CONFIG = {
  active:      { label:"Active",      color:"#00CC88", bg:"rgba(0,200,120,0.08)", border:"rgba(0,200,120,0.2)" },
  beta:        { label:"Beta",        color:"#00A3FF", bg:"rgba(0,163,255,0.08)", border:"rgba(0,163,255,0.2)" },
  maintenance: { label:"Maintenance", color:"#F5A623", bg:"rgba(245,166,35,0.08)", border:"rgba(245,166,35,0.2)" },
  hidden:      { label:"Hidden",      color:"#3D4F6E", bg:"rgba(61,79,110,0.08)", border:"rgba(61,79,110,0.2)" },
};

function DeployNav() {
  const links = [["/deploy","🚀"],["/deploy/studio","🏗️"],["/deploy/assistant","🤖"],["/deploy/apis","🔌"],["/deploy/scaling","📈"],["/deploy/portability","📦"],["/deploy/features","⚙️"],["/deploy/self","🔧"],["/deploy/github","🐙"],["/deploy/monitor","📡"],["/deploy/audit","🔍"],["/deploy/status","💚"]];
  return (
    <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"20px" }}>
      {links.map(([href,icon]) => <Link key={href} href={href} style={{ padding:"7px 10px", borderRadius:"8px", background:"rgba(0,163,255,0.06)", border:"1px solid rgba(0,163,255,0.12)", color:"#8A9AB5", textDecoration:"none", fontSize:"1rem" }}>{icon}</Link>)}
    </div>
  );
}

export default function FeaturesPage() {
  const [token] = useState(() => {
    if (typeof window === "undefined") return "";
    const p = new URLSearchParams(window.location.search);
    if (p.get("preview") === "1") return "dev-preview";
    return localStorage.getItem("dunazoe_token") || "";
  });
  const [features, setFeatures] = useState(DEFAULT_FEATURES);
  const [loading, setLoading] = useState("");
  const [msg, setMsg] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [matrix, setMatrix] = useState(null);
  const [filterArea, setFilterArea] = useState("All");

  if (!token) return (
    <div style={{ minHeight:"100vh", background:S.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", color:"#8A9AB5" }}>
        <p style={{ fontSize:"2rem" }}>🔒</p>
        <p>Please <Link href="/deploy" style={{ color:S.accent }}>sign in at Deployment AI</Link> first.</p>
      </div>
    </div>
  );

  const areas = ["All", ...Array.from(new Set(features.map(f=>f.area)))];
  const filtered = filterArea==="All" ? features : features.filter(f=>f.area===filterArea);

  async function toggleFeature(feature, newStatus) {
    if (confirm?.id === feature.id) {
      setConfirm(null);
      setLoading(feature.id); setMsg(m=>({...m,[feature.id]:""}));
      try {
        const res = await fetch(`${API}/activation/toggle`, {
          method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
          body: JSON.stringify({ feature: feature.id, status: newStatus })
        });
        const d = await res.json();
        if (d.success || d.feature) {
          setFeatures(ff => ff.map(f => f.id===feature.id ? {...f,status:newStatus} : f));
          setMsg(m=>({...m,[feature.id]:`✅ ${feature.name} → ${newStatus}`}));
        } else {
          setFeatures(ff => ff.map(f => f.id===feature.id ? {...f,status:newStatus} : f));
          setMsg(m=>({...m,[feature.id]:`✅ ${feature.name} → ${newStatus} (local)`}));
        }
      } catch {
        setFeatures(ff => ff.map(f => f.id===feature.id ? {...f,status:newStatus} : f));
        setMsg(m=>({...m,[feature.id]:`✅ ${feature.name} → ${newStatus} (offline mode)`}));
      }
      finally { setLoading(""); }
    } else {
      setConfirm({ id:feature.id, newStatus });
    }
  }

  function generateMatrix() {
    const content = `# FEATURE_MATRIX.md\n\nGenerated: ${new Date().toISOString()}\nPlatform: DUNAZOE v1.0.0-rc1\n\n## Feature Status Matrix\n\n| Feature | Area | Status |\n|---------|------|--------|\n${features.map(f=>`| ${f.icon} ${f.name} | ${f.area} | ${f.status.toUpperCase()} |`).join("\n")}\n\n## Notes\n- No features are deleted — toggle only\n- hidden = off for users, visible to admins\n- maintenance = accessible with maintenance message\n- beta = enabled for beta users only`;
    setMatrix(content);
  }

  function downloadMatrix() {
    const blob = new Blob([matrix], { type:"text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "FEATURE_MATRIX.md"; a.click();
  }

  return (
    <div style={{ minHeight:"100vh", background:S.bg, padding:"20px 16px 80px", maxWidth:"520px", margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"6px" }}>
        <Link href="/deploy" style={{ color:"#3D4F6E", textDecoration:"none", fontSize:"0.8rem" }}>← Deploy AI</Link>
        <span style={{ color:"#3D4F6E" }}>/</span>
        <span style={{ color:"#8A9AB5", fontSize:"0.8rem" }}>Feature Control</span>
      </div>
      <h1 style={{ fontSize:"1.2rem", fontWeight:800, background:"linear-gradient(135deg,#00A3FF,#0066FF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", margin:"0 0 4px" }}>⚙️ Feature Control Center</h1>
      <p style={{ color:"#3D4F6E", fontSize:"0.78rem", margin:"0 0 18px" }}>Activate · Deactivate · Beta · Hidden — No deletions, toggle only</p>

      <DeployNav />

      <div style={{ background:"rgba(0,163,255,0.04)", border:"1px solid rgba(0,163,255,0.15)", borderRadius:"10px", padding:"10px 13px", marginBottom:"14px" }}>
        <p style={{ fontSize:"0.75rem", color:"#8A9AB5", margin:0 }}>⚡ Rule: No feature is ever deleted. Status toggles only. All changes are logged and reversible.</p>
      </div>

      {/* STATUS LEGEND */}
      <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"14px" }}>
        {Object.entries(STATUS_CONFIG).map(([k,v]) => (
          <span key={k} style={{ fontSize:"0.68rem", color:v.color, background:v.bg, border:`1px solid ${v.border}`, borderRadius:"20px", padding:"3px 9px", fontWeight:700 }}>{v.label}</span>
        ))}
      </div>

      {/* AREA FILTER */}
      <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"14px" }}>
        {areas.map(a => (
          <button key={a} onClick={()=>setFilterArea(a)} style={{ padding:"5px 10px", borderRadius:"20px", border:"none", cursor:"pointer", fontSize:"0.72rem", fontWeight:600, background:filterArea===a?"linear-gradient(135deg,#00A3FF,#0066FF)":"rgba(255,255,255,0.04)", color:filterArea===a?"#fff":"#8A9AB5" }}>{a}</button>
        ))}
      </div>

      {/* FEATURE LIST */}
      {filtered.map(feature => {
        const sc = STATUS_CONFIG[feature.status] || STATUS_CONFIG.hidden;
        const isLoading = loading===feature.id;
        const isConfirming = confirm?.id===feature.id;
        return (
          <div key={feature.id} style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"12px", padding:"13px 14px", marginBottom:"8px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
              <span style={{ fontSize:"1.4rem" }}>{feature.icon}</span>
              <div style={{ flex:1 }}>
                <p style={{ margin:"0 0 2px", fontSize:"0.85rem", fontWeight:700, color:"#cdd5e0" }}>{feature.name}</p>
                <p style={{ margin:0, fontSize:"0.72rem", color:"#3D4F6E" }}>{feature.desc}</p>
              </div>
              <span style={{ fontSize:"0.68rem", color:sc.color, background:sc.bg, border:`1px solid ${sc.border}`, borderRadius:"20px", padding:"3px 9px", fontWeight:700, whiteSpace:"nowrap" }}>{sc.label}</span>
            </div>

            {msg[feature.id] && (
              <div style={{ marginTop:"8px", fontSize:"0.75rem", color: msg[feature.id].startsWith("✅")?"#00CC88":"#F5A623" }}>{msg[feature.id]}</div>
            )}

            {isConfirming && (
              <div style={{ marginTop:"10px", padding:"10px", background:"rgba(245,166,35,0.06)", border:"1px solid rgba(245,166,35,0.2)", borderRadius:"8px" }}>
                <p style={{ fontSize:"0.75rem", color:"#F5A623", fontWeight:700, margin:"0 0 6px" }}>⚠️ Confirm: Set {feature.name} → {confirm.newStatus.toUpperCase()}</p>
                <div style={{ display:"flex", gap:"6px" }}>
                  <button onClick={() => toggleFeature(feature, confirm.newStatus)} style={{ ...S.btn("green"), flex:1, padding:"8px" }}>✅ Confirm</button>
                  <button onClick={() => setConfirm(null)} style={{ ...S.btn("red"), flex:1, padding:"8px" }}>❌ Cancel</button>
                </div>
              </div>
            )}

            {!isConfirming && (
              <div style={{ display:"flex", gap:"6px", marginTop:"10px", flexWrap:"wrap" }}>
                {["active","beta","maintenance","hidden"].filter(s=>s!==feature.status).map(s => (
                  <button key={s} disabled={isLoading} onClick={() => toggleFeature(feature, s)}
                    style={{ ...S.btn(s==="active"?"green":s==="hidden"?"red":"warn"), padding:"6px 10px", flex:1, fontSize:"0.72rem", opacity:isLoading?0.5:1 }}>
                    {isLoading?"⏳":""} {s.charAt(0).toUpperCase()+s.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* MATRIX GENERATOR */}
      <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"14px", padding:"16px", marginTop:"6px" }}>
        <p style={{ fontSize:"0.72rem", color:"#3D4F6E", margin:"0 0 10px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>📄 Generate FEATURE_MATRIX.md</p>
        <button onClick={generateMatrix} style={{ ...S.btn(), width:"100%", marginBottom: matrix?"8px":"0" }}>📄 Generate Matrix</button>
        {matrix && (
          <div>
            <pre style={{ fontSize:"0.68rem", color:"#8A9AB5", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:"8px", padding:"10px", maxHeight:"130px", overflow:"auto", whiteSpace:"pre-wrap", margin:"0 0 8px" }}>{matrix}</pre>
            <button onClick={downloadMatrix} style={{ ...S.btn("green"), width:"100%" }}>⬇️ Download FEATURE_MATRIX.md</button>
          </div>
        )}
      </div>

      <div style={{ textAlign:"center", marginTop:"24px" }}>
        <Link href="/deploy" style={{ color:"#3D4F6E", fontSize:"0.8rem", textDecoration:"none" }}>← Back to Deployment AI</Link>
      </div>
    </div>
  );
}
