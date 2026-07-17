"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const S = {
  bg:"#0A0E1A", card:"rgba(13,21,37,0.95)", accent:"#00A3FF",
  border:"rgba(0,163,255,0.12)",
  label:{ fontSize:"0.75rem", color:"#8A9AB5", display:"block", marginBottom:"5px", fontWeight:600 },
  inp:{ width:"100%", padding:"11px 13px", background:"rgba(255,255,255,0.04)", border:"1.5px solid rgba(0,163,255,0.18)", borderRadius:"10px", color:"#fff", fontSize:"0.85rem", outline:"none", boxSizing:"border-box" },
  btn:(c="accent")=>({ padding:"11px 14px", borderRadius:"9px", border:"none", fontWeight:700, cursor:"pointer", fontSize:"0.82rem",
    background:c==="accent"?"linear-gradient(135deg,#00A3FF,#0066FF)":c==="green"?"linear-gradient(135deg,#00CC88,#009966)":c==="red"?"rgba(255,59,92,0.12)":"rgba(255,255,255,0.05)",
    color:c==="red"?"#FF3B5C":"#fff" }),
};

const PROVIDERS = [
  { id:"paystack", name:"Paystack", icon:"💳", desc:"Nigerian payment gateway", fields:[{key:"PAYSTACK_SECRET_KEY",label:"Secret Key",placeholder:"sk_live_..."}], docs:"https://paystack.com/docs" },
  { id:"stripe", name:"Stripe", icon:"💰", desc:"Global payment gateway", fields:[{key:"STRIPE_SECRET_KEY",label:"Secret Key",placeholder:"sk_live_..."}], docs:"https://stripe.com/docs" },
  { id:"openai", name:"OpenAI", icon:"🤖", desc:"AI features (GPT-4, etc)", fields:[{key:"OPENAI_API_KEY",label:"API Key",placeholder:"sk-..."}], docs:"https://platform.openai.com" },
  { id:"cloudinary", name:"Cloudinary", icon:"☁️", desc:"Media upload & CDN", fields:[{key:"CLOUDINARY_CLOUD_NAME",label:"Cloud Name",placeholder:"dunazoe"},{key:"CLOUDINARY_API_KEY",label:"API Key",placeholder:"..."},{key:"CLOUDINARY_API_SECRET",label:"API Secret",placeholder:"..."}], docs:"https://cloudinary.com/docs" },
  { id:"supabase", name:"Supabase", icon:"🗄️", desc:"Managed Postgres (optional)", fields:[{key:"SUPABASE_URL",label:"Project URL",placeholder:"https://xxx.supabase.co"},{key:"SUPABASE_KEY",label:"Anon Key",placeholder:"eyJ..."}], docs:"https://supabase.com/docs" },
  { id:"smtp", name:"SMTP / Email", icon:"📧", desc:"Email notifications", fields:[{key:"SMTP_HOST",label:"Host",placeholder:"smtp.gmail.com"},{key:"SMTP_USER",label:"User",placeholder:"notify@dunazoe.com"},{key:"SMTP_PASS",label:"Password",placeholder:"..."}], docs:"" },
  { id:"namecheap", name:"Namecheap", icon:"🌐", desc:"Domain & DNS", fields:[{key:"NAMECHEAP_API_KEY",label:"API Key",placeholder:"..."},{key:"NAMECHEAP_USER",label:"Username",placeholder:"..."}], docs:"https://www.namecheap.com/support/api" },
  { id:"github", name:"GitHub", icon:"🐙", desc:"CI/CD & source control", fields:[{key:"GITHUB_TOKEN",label:"Personal Access Token",placeholder:"ghp_..."},{key:"GITHUB_REPO",label:"Repository",placeholder:"org/dunazoe-supermaster"}], docs:"https://docs.github.com" },
];

function DeployNav() {
  const links = [["/deploy","🚀"],["/deploy/studio","🏗️"],["/deploy/assistant","🤖"],["/deploy/apis","🔌"],["/deploy/scaling","📈"],["/deploy/portability","📦"],["/deploy/features","⚙️"],["/deploy/self","🔧"],["/deploy/github","🐙"],["/deploy/monitor","📡"],["/deploy/audit","🔍"],["/deploy/status","💚"]];
  return (
    <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"20px" }}>
      {links.map(([href,icon]) => <Link key={href} href={href} style={{ padding:"7px 10px", borderRadius:"8px", background:"rgba(0,163,255,0.06)", border:"1px solid rgba(0,163,255,0.12)", color:"#8A9AB5", textDecoration:"none", fontSize:"1rem" }}>{icon}</Link>)}
    </div>
  );
}

export default function APIsPage() {
  const [token] = useState(() => {
    if (typeof window === "undefined") return "";
    const p = new URLSearchParams(window.location.search);
    if (p.get("preview") === "1") return "dev-preview";
    return localStorage.getItem("dunazoe_token") || "";
  });
  const [selected, setSelected] = useState(null);
  const [values, setValues] = useState({});
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState("");
  const [msg, setMsg] = useState({});
  const [apiMap, setApiMap] = useState(null);

  if (!token) return (
    <div style={{ minHeight:"100vh", background:S.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", color:"#8A9AB5" }}>
        <p style={{ fontSize:"2rem" }}>🔒</p>
        <p>Please <Link href="/deploy" style={{ color:S.accent }}>sign in at Deployment AI</Link> first.</p>
      </div>
    </div>
  );

  async function validateAPI(provider) {
    setLoading(provider.id); setMsg(m=>({...m,[provider.id]:""}));
    try {
      const res = await fetch(`${API}/deployment/apis/validate`, {
        method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ provider: provider.id, secrets: values[provider.id] || {} })
      });
      const d = await res.json();
      setStatus(s=>({...s,[provider.id]:d.valid?"connected":d.error||"failed"}));
      setMsg(m=>({...m,[provider.id]:d.valid?"✅ Connected & validated":d.error||"❌ Validation failed"}));
    } catch {
      const hasCreds = provider.fields.every(f => (values[provider.id]||{})[f.key]);
      setStatus(s=>({...s,[provider.id]:hasCreds?"configured":"missing"}));
      setMsg(m=>({...m,[provider.id]:hasCreds?"✅ Credentials saved (validate when service online)":"⚠️ Enter credentials to connect"}));
    }
    finally { setLoading(""); }
  }

  async function generateApiMap() {
    setApiMap(null);
    const map = PROVIDERS.map(p => `## ${p.icon} ${p.name}\n- Status: ${status[p.id]||"unknown"}\n- Purpose: ${p.desc}\n- Docs: ${p.docs||"N/A"}\n- Fields: ${p.fields.map(f=>f.key).join(", ")}`).join("\n\n");
    const content = `# API_MAP.md\n\nGenerated: ${new Date().toISOString()}\nPlatform: DUNAZOE v1.0.0-rc1\n\n${map}\n\n## Notes\n- All secrets stored in environment variables\n- Never hardcode API keys in source code\n- Rotate keys quarterly or after any suspected breach`;
    setApiMap(content);
  }

  function downloadApiMap() {
    const blob = new Blob([apiMap], { type:"text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "API_MAP.md"; a.click();
  }

  const getStatusColor = (id) => {
    const s = status[id];
    if (!s || s==="unknown") return "#3D4F6E";
    if (s==="connected" || s==="configured") return "#00CC88";
    if (s==="missing") return "#F5A623";
    return "#FF3B5C";
  };

  const getStatusIcon = (id) => {
    const s = status[id];
    if (!s || s==="unknown") return "⚪";
    if (s==="connected") return "✅";
    if (s==="configured") return "🟡";
    if (s==="missing") return "⚠️";
    return "❌";
  };

  return (
    <div style={{ minHeight:"100vh", background:S.bg, padding:"20px 16px 80px", maxWidth:"520px", margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"6px" }}>
        <Link href="/deploy" style={{ color:"#3D4F6E", textDecoration:"none", fontSize:"0.8rem" }}>← Deploy AI</Link>
        <span style={{ color:"#3D4F6E" }}>/</span>
        <span style={{ color:"#8A9AB5", fontSize:"0.8rem" }}>API Control Center</span>
      </div>
      <h1 style={{ fontSize:"1.2rem", fontWeight:800, background:"linear-gradient(135deg,#00A3FF,#0066FF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", margin:"0 0 4px" }}>🔌 API Control Center</h1>
      <p style={{ color:"#3D4F6E", fontSize:"0.78rem", margin:"0 0 18px" }}>Connect · Validate · Monitor all external providers</p>

      <DeployNav />

      {/* PROVIDER CARDS */}
      {PROVIDERS.map(provider => (
        <div key={provider.id} style={{ background:S.card, border:`1px solid ${selected===provider.id?"rgba(0,163,255,0.3)":S.border}`, borderRadius:"14px", marginBottom:"10px", overflow:"hidden" }}>
          <button onClick={() => setSelected(selected===provider.id?null:provider.id)}
            style={{ width:"100%", padding:"14px 16px", background:"transparent", border:"none", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:"10px" }}>
            <span style={{ fontSize:"1.5rem" }}>{provider.icon}</span>
            <div style={{ flex:1 }}>
              <p style={{ margin:0, fontSize:"0.9rem", fontWeight:700, color:"#cdd5e0" }}>{provider.name}</p>
              <p style={{ margin:0, fontSize:"0.72rem", color:"#3D4F6E" }}>{provider.desc}</p>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
              <span style={{ fontSize:"0.72rem", color:getStatusColor(provider.id), fontWeight:700 }}>{(status[provider.id]||"not configured").toUpperCase()}</span>
              <span>{getStatusIcon(provider.id)}</span>
              <span style={{ color:"#3D4F6E", fontSize:"0.8rem" }}>{selected===provider.id?"▲":"▼"}</span>
            </div>
          </button>

          {selected===provider.id && (
            <div style={{ padding:"0 16px 16px", borderTop:"1px solid rgba(255,255,255,0.04)" }}>
              {provider.fields.map(field => (
                <div key={field.key} style={{ marginBottom:"10px" }}>
                  <label style={S.label}>{field.label} <span style={{ color:"#3D4F6E", fontWeight:400 }}>({field.key})</span></label>
                  <input type="password" placeholder={field.placeholder} value={(values[provider.id]||{})[field.key]||""}
                    onChange={e => setValues(v=>({...v,[provider.id]:{...(v[provider.id]||{}),[field.key]:e.target.value}}))}
                    style={S.inp} />
                </div>
              ))}

              {msg[provider.id] && (
                <div style={{ padding:"9px 12px", borderRadius:"8px", background: msg[provider.id].startsWith("✅")?"rgba(0,200,120,0.08)":"rgba(245,166,35,0.08)", border:`1px solid ${msg[provider.id].startsWith("✅")?"rgba(0,200,120,0.2)":"rgba(245,166,35,0.2)"}`, fontSize:"0.78rem", color:msg[provider.id].startsWith("✅")?"#00CC88":"#F5A623", marginBottom:"10px" }}>{msg[provider.id]}</div>
              )}

              <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                <button onClick={() => validateAPI(provider)} disabled={loading===provider.id} style={{ ...S.btn(), flex:1 }}>{loading===provider.id?"⏳ Validating...":"🔗 Connect & Validate"}</button>
                {provider.docs && <a href={provider.docs} target="_blank" rel="noreferrer" style={{ ...S.btn(""), padding:"10px 12px", textDecoration:"none", textAlign:"center" }}>📖 Docs</a>}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* API MAP GENERATOR */}
      <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"14px", padding:"16px", marginTop:"6px" }}>
        <p style={{ fontSize:"0.72rem", color:"#3D4F6E", margin:"0 0 10px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>📄 Generate API_MAP.md</p>
        <button onClick={generateApiMap} style={{ ...S.btn("green"), width:"100%", marginBottom: apiMap?"8px":"0" }}>📄 Generate API Map</button>
        {apiMap && (
          <div>
            <pre style={{ fontSize:"0.72rem", color:"#8A9AB5", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:"8px", padding:"10px", maxHeight:"140px", overflow:"auto", whiteSpace:"pre-wrap", margin:"0 0 8px" }}>{apiMap}</pre>
            <button onClick={downloadApiMap} style={{ ...S.btn(), width:"100%" }}>⬇️ Download API_MAP.md</button>
          </div>
        )}
      </div>

      <div style={{ textAlign:"center", marginTop:"24px" }}>
        <Link href="/deploy" style={{ color:"#3D4F6E", fontSize:"0.8rem", textDecoration:"none" }}>← Back to Deployment AI</Link>
      </div>
    </div>
  );
}
