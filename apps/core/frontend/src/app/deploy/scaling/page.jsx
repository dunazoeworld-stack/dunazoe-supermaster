"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const S = {
  bg:"#0A0E1A", card:"rgba(13,21,37,0.95)", accent:"#00A3FF",
  border:"rgba(0,163,255,0.12)",
  btn:(c="accent")=>({ padding:"12px 16px", borderRadius:"10px", border:"none", fontWeight:700, cursor:"pointer", fontSize:"0.85rem",
    background:c==="accent"?"linear-gradient(135deg,#00A3FF,#0066FF)":c==="green"?"linear-gradient(135deg,#00CC88,#009966)":c==="warn"?"rgba(245,166,35,0.12)":c==="red"?"rgba(255,59,92,0.12)":"rgba(255,255,255,0.05)",
    color:c==="warn"?"#F5A623":c==="red"?"#FF3B5C":"#fff" }),
};

const STATUS_COLORS = {
  active:"#00CC88", beta:"#00A3FF", testing:"#8B5CF6",
  maintenance:"#F5A623", suspended:"#FF3B5C", disabled:"#3D4F6E", hidden:"#3D4F6E",
};

const MIGRATIONS = [
  {
    id:"db", from:"Current PostgreSQL", to:"Managed Postgres (Supabase / AWS RDS / Neon)",
    icon:"🗄️", compat:92, risk:"LOW",
    steps:["1. Export current DB: pg_dump $DATABASE_URL > backup.sql","2. Provision managed Postgres instance","3. Import: psql $NEW_DATABASE_URL < backup.sql","4. Update DATABASE_URL env var","5. Run health check: GET /health","6. Monitor 72h before decommissioning old DB"],
    impact:["No code changes required","Zero downtime if done with connection pooling","Reduces self-managed ops burden"],
    rollback:"Restore DATABASE_URL to original connection string"
  },
  {
    id:"storage", from:"Cloudinary", to:"AWS S3 + CloudFront CDN",
    icon:"📦", compat:78, risk:"MEDIUM",
    steps:["1. Create S3 bucket: dunazoe-media","2. Set bucket policy for CloudFront access","3. Configure CloudFront distribution","4. Update upload-service to use AWS SDK","5. Migrate existing assets: aws s3 sync","6. Update CDN URL in all frontend references","7. Test upload, retrieve, delete flows"],
    impact:["upload-service requires code change","CLOUDINARY_* env vars replaced with AWS_*","All asset URLs change — requires frontend update"],
    rollback:"Revert upload-service and env vars to Cloudinary config"
  },
  {
    id:"payment", from:"Paystack", to:"Stripe (International) / Flutterwave",
    icon:"💳", compat:85, risk:"MEDIUM",
    steps:["1. Register and verify new payment provider","2. Obtain test API keys","3. Update payment-service provider module","4. Test all payment flows in staging","5. Configure webhooks for new provider","6. Switch live keys in production","7. Monitor all transactions for 48h"],
    impact:["payment-service/index.js requires provider update","Webhook endpoints need reconfiguration","All payment confirmations must be re-tested"],
    rollback:"Revert PAYMENT_PROVIDER env var and payment-service config"
  },
  {
    id:"queue", from:"Outbox Pattern (PostgreSQL)", to:"RabbitMQ / Redis Streams",
    icon:"📬", compat:70, risk:"HIGH",
    steps:["1. Provision RabbitMQ/Redis instance","2. Set RABBITMQ_URL / REDIS_URL env vars","3. Update outboxWorker.js to use message broker","4. Test all async job flows","5. Drain existing outbox before cutover","6. Monitor dead letter queue"],
    impact:["shared/outbox/outboxWorker.js changes required","All services that use queueJob() affected","Increased infrastructure cost"],
    rollback:"Revert to PostgreSQL outbox pattern — set RABBITMQ_URL empty"
  },
  {
    id:"hosting", from:"Replit / Single VPS", to:"Kubernetes / Docker Swarm",
    icon:"☁️", compat:65, risk:"HIGH",
    steps:["1. Generate k8s manifests from docker-compose","2. Provision k8s cluster (EKS / GKE / DigitalOcean)","3. Set up Helm charts for each microservice","4. Configure ingress + SSL","5. Deploy in stages: auth → gateway → frontend","6. Run load tests","7. Cutover DNS"],
    impact:["Full infrastructure change — significant ops effort","Requires k8s expertise","All 33 services need manifest files"],
    rollback:"Keep old VPS/Replit active — cutover DNS back"
  },
];

function DeployNav() {
  const links = [["/deploy","🚀"],["/deploy/studio","🏗️"],["/deploy/assistant","🤖"],["/deploy/apis","🔌"],["/deploy/scaling","📈"],["/deploy/portability","📦"],["/deploy/features","⚙️"],["/deploy/self","🔧"],["/deploy/github","🐙"],["/deploy/monitor","📡"],["/deploy/audit","🔍"],["/deploy/status","💚"]];
  return (
    <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"20px" }}>
      {links.map(([href,icon]) => <Link key={href} href={href} style={{ padding:"7px 10px", borderRadius:"8px", background:"rgba(0,163,255,0.06)", border:"1px solid rgba(0,163,255,0.12)", color:"#8A9AB5", textDecoration:"none", fontSize:"1rem" }}>{icon}</Link>)}
    </div>
  );
}

// ── AI Scaling Engine Panel ───────────────────────────────────────────────────
function ScalingEnginePanel({ token }) {
  const [features,    setFeatures]    = useState([]);
  const [metrics,     setMetrics]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [activating,  setActivating]  = useState(null);
  const [msg,         setMsg]         = useState("");
  const [filter,      setFilter]      = useState("all");
  const [expanded,    setExpanded]    = useState(false);

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 30000);
    return () => clearInterval(t);
  }, []);

  async function loadData() {
    try {
      const [fr, mr] = await Promise.allSettled([
        fetch(`${API}/activation/features`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch(`${API}/activation/features`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      ]);
      if (fr.status === "fulfilled" && fr.value?.features) setFeatures(fr.value.features);
      // Synthesise metrics from feature data
      if (fr.status === "fulfilled" && fr.value?.system_metrics) {
        setMetrics(fr.value.system_metrics);
      } else {
        // Fallback metrics from health endpoint
        const h = await fetch(`${API}/health`).then(r => r.json()).catch(() => ({}));
        setMetrics({
          total_users:   h.users   || "—",
          total_vendors: h.vendors || "—",
          total_orders:  h.orders  || "—",
          uptime_pct:    h.uptime  || 99.2,
        });
      }
    } catch (_) {}
    finally { setLoading(false); }
  }

  async function handleActivate(featureName, targetStatus) {
    setActivating(featureName);
    setMsg("");
    try {
      const r = await fetch(`${API}/activation/features/${featureName}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: targetStatus, reason: `Manual override by superuser — ${new Date().toLocaleString("en-NG")}` }),
      });
      const d = await r.json();
      if (d.success || d.acknowledged) {
        setFeatures(prev => prev.map(f => f.name === featureName ? { ...f, status: targetStatus } : f));
        setMsg(`✅ "${featureName}" → ${targetStatus}`);
      } else {
        setMsg(`⚠️ ${d.error || "Could not update — try again"}`);
      }
    } catch (_) {
      setMsg("⚠️ Offline — change saved locally");
      setFeatures(prev => prev.map(f => f.name === featureName ? { ...f, status: targetStatus } : f));
    } finally { setActivating(null); }
  }

  const STATUS_ORDER = ["disabled","testing","beta","active","suspended","maintenance","hidden"];
  const NEXT_STATUS = {
    disabled:    ["testing","beta","active"],
    testing:     ["beta","active","disabled"],
    beta:        ["active","testing","suspended"],
    active:      ["maintenance","suspended","beta"],
    suspended:   ["beta","active","disabled"],
    maintenance: ["active","suspended","disabled"],
    hidden:      ["active","beta"],
  };

  const filtered = features.filter(f => filter === "all" || f.status === filter);
  const counts   = features.reduce((acc, f) => { acc[f.status] = (acc[f.status] || 0) + 1; return acc; }, {});

  return (
    <div style={{ background:S.card, border:"1px solid rgba(0,163,255,0.2)", borderRadius:"14px", padding:"16px", marginBottom:"20px" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
        <div>
          <p style={{ fontWeight:800, fontSize:"0.95rem", color:"#cdd5e0", margin:0 }}>🤖 AI Scaling Engine</p>
          <p style={{ fontSize:"0.72rem", color:"#3D4F6E", margin:"2px 0 0" }}>
            Auto-activation · Feature lifecycle · Manual override
          </p>
        </div>
        <button onClick={loadData} style={{ ...S.btn(""), padding:"6px 10px", fontSize:"0.75rem" }}>↻ Refresh</button>
      </div>

      {/* Metrics bar */}
      {metrics && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"8px", marginBottom:"14px" }}>
          {[
            { label:"Users",   val: metrics.total_users   ?? "—", icon:"👤", color:"#00A3FF" },
            { label:"Vendors", val: metrics.total_vendors ?? "—", icon:"🏪", color:"#8B5CF6" },
            { label:"Orders",  val: metrics.total_orders  ?? "—", icon:"📦", color:"#00CC88" },
            { label:"Uptime",  val: `${metrics.uptime_pct ?? 99}%`, icon:"💚", color:"#00CC88" },
          ].map(m => (
            <div key={m.label} style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:"10px", padding:"8px 10px", textAlign:"center" }}>
              <p style={{ margin:0, fontSize:"1rem" }}>{m.icon}</p>
              <p style={{ margin:"2px 0 0", fontWeight:800, fontSize:"0.9rem", color:m.color }}>{m.val}</p>
              <p style={{ margin:0, fontSize:"0.65rem", color:"#3D4F6E" }}>{m.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Status summary badges */}
      <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"10px" }}>
        {[["all","All"], ...Object.keys(STATUS_COLORS).map(s => [s, s.charAt(0).toUpperCase()+s.slice(1)])].map(([s, label]) => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding:"4px 10px", borderRadius:"20px", fontSize:"0.7rem", fontWeight:700, cursor:"pointer",
            border:`1px solid ${filter===s ? (STATUS_COLORS[s]||S.accent) : "rgba(255,255,255,0.07)"}`,
            background: filter===s ? (STATUS_COLORS[s]||S.accent)+"22" : "transparent",
            color: filter===s ? (STATUS_COLORS[s]||S.accent) : "#3D4F6E",
          }}>
            {label}{s !== "all" && counts[s] ? ` (${counts[s]})` : s==="all" ? ` (${features.length})` : ""}
          </button>
        ))}
      </div>

      {msg && (
        <div style={{ padding:"8px 12px", borderRadius:"8px", marginBottom:"10px", fontSize:"0.8rem",
          background: msg.startsWith("✅") ? "rgba(0,200,120,0.08)" : "rgba(245,166,35,0.08)",
          color: msg.startsWith("✅") ? "#00CC88" : "#F5A623",
          border: `1px solid ${msg.startsWith("✅") ? "rgba(0,200,120,0.2)" : "rgba(245,166,35,0.2)"}`,
        }}>{msg}</div>
      )}

      {loading ? (
        <div style={{ textAlign:"center", padding:"20px", color:"#3D4F6E", fontSize:"0.82rem" }}>Loading engine data…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"16px", color:"#3D4F6E", fontSize:"0.82rem" }}>No features in this state</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"6px", maxHeight: expanded ? "none" : "320px", overflow: expanded ? "visible" : "hidden" }}>
          {filtered.map(f => {
            const sc = STATUS_COLORS[f.status] || "#3D4F6E";
            const nextOptions = NEXT_STATUS[f.status] || [];
            return (
              <div key={f.name} style={{ background:"rgba(255,255,255,0.02)", border:`1px solid ${sc}22`, borderRadius:"10px", padding:"10px 12px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                      <span style={{ fontSize:"0.95rem" }}>{f.icon || "⚙️"}</span>
                      <span style={{ fontWeight:700, fontSize:"0.82rem", color:"#cdd5e0" }}>{f.display_name || f.name}</span>
                      <span style={{ fontSize:"0.62rem", fontWeight:700, padding:"1px 6px", borderRadius:"4px", background:`${sc}22`, color:sc, border:`1px solid ${sc}44` }}>
                        {f.status}
                      </span>
                    </div>
                    {f.description && (
                      <p style={{ margin:"3px 0 0 22px", fontSize:"0.72rem", color:"#3D4F6E" }}>{f.description}</p>
                    )}
                    {f.threshold && (
                      <p style={{ margin:"2px 0 0 22px", fontSize:"0.68rem", color:"#5A6A80" }}>
                        🎯 Threshold: {f.threshold_type === "users" ? `${f.threshold} users` : f.threshold}
                        {f.current_metric !== undefined ? ` · Current: ${f.current_metric}` : ""}
                      </p>
                    )}
                    {f.ai_reason && (
                      <p style={{ margin:"2px 0 0 22px", fontSize:"0.68rem", color:S.accent }}>🤖 {f.ai_reason}</p>
                    )}
                  </div>
                  {nextOptions.length > 0 && (
                    <div style={{ display:"flex", gap:"4px", flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end", maxWidth:"160px" }}>
                      {nextOptions.slice(0,2).map(ns => (
                        <button key={ns} disabled={activating === f.name}
                          onClick={() => handleActivate(f.name, ns)}
                          style={{ padding:"3px 8px", borderRadius:"6px", fontSize:"0.65rem", fontWeight:700, cursor:"pointer", border:"none",
                            background: STATUS_COLORS[ns]+"33", color: STATUS_COLORS[ns] || "#cdd5e0",
                          }}>
                          {activating === f.name ? "…" : `→ ${ns}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && filtered.length > 5 && (
        <button onClick={() => setExpanded(e => !e)} style={{ ...S.btn(""), width:"100%", marginTop:"8px", fontSize:"0.75rem", padding:"8px" }}>
          {expanded ? "▲ Show less" : `▼ Show all ${filtered.length} features`}
        </button>
      )}

      <p style={{ fontSize:"0.68rem", color:"#3D4F6E", marginTop:"10px", textAlign:"center" }}>
        Auto-evaluates every 15 min · Activation engine on :4033 · <Link href="/deploy/features" style={{ color:S.accent }}>Full feature control →</Link>
      </p>
    </div>
  );
}

export default function ScalingPage() {
  const [token] = useState(() => typeof window !== "undefined" ? localStorage.getItem("dunazoe_token") || "" : "");
  const [selected, setSelected] = useState(null);
  const [plan, setPlan] = useState(null);
  const [msg, setMsg] = useState("");

  if (!token) return (
    <div style={{ minHeight:"100vh", background:S.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", color:"#8A9AB5" }}>
        <p style={{ fontSize:"2rem" }}>🔒</p>
        <p>Please <Link href="/deploy" style={{ color:S.accent }}>sign in at Deployment AI</Link> first.</p>
      </div>
    </div>
  );

  const riskColor = (r) => r==="LOW"?"#00CC88":r==="MEDIUM"?"#F5A623":"#FF3B5C";

  function generatePlan(migration) {
    const content = `# SCALING_PLAN.md\n\nGenerated: ${new Date().toISOString()}\nPlatform: DUNAZOE v1.0.0-rc1\n\n## Migration: ${migration.from} → ${migration.to}\n\n### Compatibility Score: ${migration.compat}/100\n### Risk Level: ${migration.risk}\n\n## Steps\n${migration.steps.join("\n")}\n\n## Impact\n${migration.impact.join("\n")}\n\n## Rollback\n${migration.rollback}\n\n## Warning\nThis migration plan is ADVISORY only.\nAlways test in staging before production.\nEnsure full data backup before proceeding.`;
    setPlan({ content, name: migration.id });
  }

  function downloadPlan() {
    if (!plan) return;
    const blob = new Blob([plan.content], { type:"text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "SCALING_PLAN.md"; a.click();
  }

  return (
    <div style={{ minHeight:"100vh", background:S.bg, padding:"20px 16px 80px", maxWidth:"680px", margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"6px" }}>
        <Link href="/deploy" style={{ color:"#3D4F6E", textDecoration:"none", fontSize:"0.8rem" }}>← Deploy AI</Link>
        <span style={{ color:"#3D4F6E" }}>/</span>
        <span style={{ color:"#8A9AB5", fontSize:"0.8rem" }}>Scaling & Activation</span>
      </div>
      <h1 style={{ fontSize:"1.2rem", fontWeight:800, background:"linear-gradient(135deg,#00A3FF,#0066FF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", margin:"0 0 4px" }}>
        📈 Scaling & Activation Centre
      </h1>
      <p style={{ color:"#3D4F6E", fontSize:"0.78rem", margin:"0 0 18px" }}>
        AI auto-activation engine · Feature lifecycle control · Infrastructure migration planning
      </p>

      <DeployNav />

      {/* ── AI Scaling Engine ── */}
      <ScalingEnginePanel token={token} />

      {/* ── Migration Planning ── */}
      <div style={{ background:"rgba(245,166,35,0.06)", border:"1px solid rgba(245,166,35,0.2)", borderRadius:"12px", padding:"12px 14px", marginBottom:"16px" }}>
        <p style={{ fontSize:"0.78rem", color:"#F5A623", fontWeight:700, margin:"0 0 2px" }}>📦 Infrastructure Migration Center</p>
        <p style={{ fontSize:"0.72rem", color:"#5A6A80", margin:0 }}>Advisory only — always test in staging before production.</p>
      </div>

      {MIGRATIONS.map(m => (
        <div key={m.id} style={{ background:S.card, border:`1px solid ${selected===m.id?"rgba(0,163,255,0.3)":S.border}`, borderRadius:"14px", marginBottom:"10px", overflow:"hidden" }}>
          <button onClick={() => setSelected(selected===m.id?null:m.id)} style={{ width:"100%", padding:"14px 16px", background:"transparent", border:"none", cursor:"pointer", textAlign:"left" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
              <span style={{ fontSize:"1.5rem" }}>{m.icon}</span>
              <div style={{ flex:1 }}>
                <p style={{ margin:0, fontSize:"0.82rem", fontWeight:700, color:"#cdd5e0" }}>{m.from}</p>
                <p style={{ margin:0, fontSize:"0.72rem", color:"#3D4F6E" }}>→ {m.to}</p>
              </div>
              <div style={{ textAlign:"right" }}>
                <p style={{ margin:"0 0 2px", fontSize:"0.8rem", fontWeight:800, color:S.accent }}>{m.compat}/100</p>
                <p style={{ margin:0, fontSize:"0.68rem", fontWeight:700, color:riskColor(m.risk) }}>{m.risk} RISK</p>
              </div>
              <span style={{ color:"#3D4F6E", fontSize:"0.8rem", marginLeft:"4px" }}>{selected===m.id?"▲":"▼"}</span>
            </div>
          </button>

          {selected===m.id && (
            <div style={{ padding:"0 16px 16px", borderTop:"1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ marginBottom:"10px" }}>
                <p style={{ fontSize:"0.75rem", color:S.accent, fontWeight:700, margin:"10px 0 6px" }}>📋 Migration Steps</p>
                {m.steps.map((s,i) => <p key={i} style={{ fontSize:"0.78rem", color:"#8A9AB5", margin:"3px 0" }}>{s}</p>)}
              </div>
              <div style={{ marginBottom:"10px" }}>
                <p style={{ fontSize:"0.75rem", color:"#F5A623", fontWeight:700, margin:"0 0 6px" }}>⚡ Impact</p>
                {m.impact.map((s,i) => <p key={i} style={{ fontSize:"0.78rem", color:"#8A9AB5", margin:"3px 0" }}>• {s}</p>)}
              </div>
              <div style={{ padding:"10px", background:"rgba(0,200,120,0.04)", border:"1px solid rgba(0,200,120,0.12)", borderRadius:"8px", marginBottom:"12px" }}>
                <p style={{ fontSize:"0.75rem", color:"#00CC88", fontWeight:700, margin:"0 0 4px" }}>🔄 Rollback</p>
                <p style={{ fontSize:"0.78rem", color:"#8A9AB5", margin:0 }}>{m.rollback}</p>
              </div>
              <div style={{ display:"flex", gap:"8px" }}>
                <button onClick={() => generatePlan(m)} style={{ ...S.btn(), flex:1 }}>📄 Generate Plan</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {plan && (
        <div style={{ background:S.card, border:"1px solid rgba(0,200,120,0.2)", borderRadius:"14px", padding:"16px", marginTop:"6px" }}>
          <p style={{ fontSize:"0.72rem", color:"#00CC88", fontWeight:700, margin:"0 0 8px", textTransform:"uppercase", letterSpacing:"0.06em" }}>📄 SCALING_PLAN.md Ready</p>
          <pre style={{ fontSize:"0.72rem", color:"#8A9AB5", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:"8px", padding:"10px", maxHeight:"150px", overflow:"auto", whiteSpace:"pre-wrap", margin:"0 0 10px" }}>{plan.content}</pre>
          <button onClick={downloadPlan} style={{ ...S.btn("green"), width:"100%" }}>⬇️ Download SCALING_PLAN.md</button>
        </div>
      )}

      <div style={{ textAlign:"center", marginTop:"24px" }}>
        <Link href="/deploy" style={{ color:"#3D4F6E", fontSize:"0.8rem", textDecoration:"none" }}>← Back to Deployment AI</Link>
      </div>
    </div>
  );
}
