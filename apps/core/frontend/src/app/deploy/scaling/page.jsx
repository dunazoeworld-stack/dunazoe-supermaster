"use client";
import { useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const S = {
  bg:"#0A0E1A", card:"rgba(13,21,37,0.95)", accent:"#00A3FF",
  border:"rgba(0,163,255,0.12)",
  btn:(c="accent")=>({ padding:"12px 16px", borderRadius:"10px", border:"none", fontWeight:700, cursor:"pointer", fontSize:"0.85rem",
    background:c==="accent"?"linear-gradient(135deg,#00A3FF,#0066FF)":c==="green"?"linear-gradient(135deg,#00CC88,#009966)":c==="warn"?"rgba(245,166,35,0.12)":"rgba(255,255,255,0.05)",
    color:c==="warn"?"#F5A623":"#fff" }),
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

export default function ScalingPage() {
  const [token] = useState(() => typeof window !== "undefined" ? localStorage.getItem("dunazoe_token") || "" : "");
  const [selected, setSelected] = useState(null);
  const [plan, setPlan] = useState(null);
  const [confirm, setConfirm] = useState(null);
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
    <div style={{ minHeight:"100vh", background:S.bg, padding:"20px 16px 80px", maxWidth:"520px", margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"6px" }}>
        <Link href="/deploy" style={{ color:"#3D4F6E", textDecoration:"none", fontSize:"0.8rem" }}>← Deploy AI</Link>
        <span style={{ color:"#3D4F6E" }}>/</span>
        <span style={{ color:"#8A9AB5", fontSize:"0.8rem" }}>Scale Migration Center</span>
      </div>
      <h1 style={{ fontSize:"1.2rem", fontWeight:800, background:"linear-gradient(135deg,#00A3FF,#0066FF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", margin:"0 0 4px" }}>📈 Scale Migration Center</h1>
      <p style={{ color:"#3D4F6E", fontSize:"0.78rem", margin:"0 0 18px" }}>Plan external provider transitions safely — with compatibility scores and rollback</p>

      <DeployNav />

      <div style={{ background:"rgba(245,166,35,0.06)", border:"1px solid rgba(245,166,35,0.2)", borderRadius:"12px", padding:"12px 14px", marginBottom:"16px" }}>
        <p style={{ fontSize:"0.78rem", color:"#F5A623", fontWeight:600, margin:0 }}>⚠️ Advisory Mode — All migration plans are guidance only. Never execute in production without full staging validation and data backup.</p>
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
