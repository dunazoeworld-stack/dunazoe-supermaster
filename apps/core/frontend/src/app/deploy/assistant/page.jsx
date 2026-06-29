"use client";
import { useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const S = {
  bg:"#0A0E1A", card:"rgba(13,21,37,0.95)", accent:"#00A3FF",
  border:"rgba(0,163,255,0.12)",
  btn:(c="accent")=>({ padding:"12px 16px", borderRadius:"10px", border:"none", fontWeight:700, cursor:"pointer", fontSize:"0.85rem", width:"100%", marginBottom:"8px",
    background:c==="accent"?"linear-gradient(135deg,#00A3FF,#0066FF)":c==="green"?"linear-gradient(135deg,#00CC88,#009966)":"rgba(255,255,255,0.05)",
    color:"#fff" }),
};

function DeployNav() {
  const links = [["/deploy","🚀"],["/deploy/studio","🏗️"],["/deploy/assistant","🤖"],["/deploy/apis","🔌"],["/deploy/scaling","📈"],["/deploy/portability","📦"],["/deploy/features","⚙️"],["/deploy/self","🔧"],["/deploy/github","🐙"],["/deploy/monitor","📡"],["/deploy/audit","🔍"],["/deploy/status","💚"]];
  return (
    <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"20px" }}>
      {links.map(([href,icon]) => <Link key={href} href={href} style={{ padding:"7px 10px", borderRadius:"8px", background:"rgba(0,163,255,0.06)", border:"1px solid rgba(0,163,255,0.12)", color:"#8A9AB5", textDecoration:"none", fontSize:"1rem" }}>{icon}</Link>)}
    </div>
  );
}

const GUIDES = {
  beginner: [
    { q:"What should I do next?", a:"1. Run a Deployment Audit (🔍 Audit tab)\n2. Review all scores — they must all be green\n3. If green: press DEPLOY\n4. If red: read the blocked reasons and contact your tech team\n5. After deploy: monitor for 72 hours" },
    { q:"What is a deployment audit?", a:"It is a safety check. DUNAZOE's AI checks:\n• Security (no weak passwords, secrets are set)\n• Reliability (all services are healthy)\n• Performance (app is fast)\n• Scalability (can handle many users)\n\nAll must score above 85-90 before you can deploy." },
    { q:"What does BLOCKED mean?", a:"It means the system is not ready to go live. There is at least one problem. Read the blocked reasons — they tell you exactly what to fix. Do not try to bypass this." },
    { q:"How do I rollback?", a:"If something goes wrong after deploying:\n1. Go to the Deploy page\n2. Press Rollback\n3. Confirm the action\n4. The system will restore the previous version automatically." },
    { q:"What is the risk of deploying now?", a:"If all audit scores are green ✅: LOW risk.\nIf any score is red ❌: HIGH risk — do not deploy.\nAlways deploy to staging first, then production." },
  ],
  intermediate: [
    { q:"What should I do next?", a:"1. Verify env secrets are all set (JWT_SECRET, DATABASE_URL, PAYSTACK_SECRET_KEY)\n2. Run master audit — target: security≥90, reliability≥90\n3. Check GitHub integration is connected\n4. Deploy to staging — verify all 33 microservices respond\n5. Promote to production\n6. Start 72h post-deploy monitor" },
    { q:"Optimization advice", a:"Current architecture bottlenecks:\n• Add Redis caching for product catalog endpoints\n• Enable PgBouncer connection pooling\n• Configure Nginx rate limiting for auth routes\n• Enable CloudFront CDN for static assets\n• Monitor P95 latency — target <500ms" },
    { q:"Scaling advice", a:"DUNAZOE is microservices-ready. Scale path:\n1. Current: Single VPS (Contabo) — good for 0-10K users\n2. Next: Add Redis cluster + PostgreSQL replicas\n3. Future: Kubernetes / ECS for 100K+ users\n4. See /deploy/scaling for migration plans" },
    { q:"Estimated infrastructure cost", a:"Replit (current): ~$25/mo\nContabo VPS (4 cores, 8GB): ~$12/mo\nContabo VPS (8 cores, 30GB): ~$25/mo\nAWS ECS + RDS: ~$150-400/mo\nCloudflare (CDN + DNS): Free tier available" },
    { q:"API integration status", a:"Check /deploy/apis for live status of:\n• Paystack (payments)\n• OpenAI (AI features)\n• Cloudinary (uploads)\n• Supabase (if used)\n• SMTP (notifications)\n• GitHub (CI/CD)" },
  ],
  advanced: [
    { q:"What should I do next?", a:"1. Review deployment-ai-service audit thresholds (THRESHOLDS object)\n2. Check outbox_events for pending messages >100 (blocks reliability score)\n3. Verify reconciliation_runs last entry is 'passed'\n4. Check P95 latency in service_health_log — must be <500ms\n5. Validate all 33 services on ports 4001-4033 respond at /health\n6. Check docker-compose.yml service definitions\n7. Deploy: POST /deployment/deploy {version, environment, hosting_provider}" },
    { q:"Architecture decisions", a:"Frozen at v1.0.0-rc1 by CTO order.\n• Gateway: port 3000 (http-proxy-middleware)\n• Auth: JWT (RS256) — no fallback, throws on missing secret\n• DB: PostgreSQL with double-entry bookkeeping\n• Queue: outbox pattern (no RabbitMQ required in dev)\n• RBAC: role-based (user/vendor/admin/cto/super_admin)\n• Port map: auth:4001 … deployment-ai:4027 … activation:4033" },
    { q:"Debugging blocked audit", a:"Security score low:\n→ Check JWT_SECRET length ≥32 chars\n→ Remove placeholder values from env\n→ Set PAYSTACK_SECRET_KEY (starts with sk_)\n\nReliability score low:\n→ Check outbox_events pending count\n→ Verify DB connectivity\n→ Run reconciliation\n\nScalability score low:\n→ Check files: nginx.conf, pgbouncer.ini, prometheus.yml\n→ Set REDIS_URL env var" },
    { q:"GitHub CI/CD pipeline", a:"Active at .github/workflows/ci.yml\nTriggers on: push to main\nSteps: install → lint → security audit → test → build → deploy\nWebhooks: POST /deployment/audit on merge\nRollback: POST /deployment/rollback {run_id, reason}" },
    { q:"Self-host checklist", a:"See /deploy/portability for full guide.\nRequired:\n• Docker 24+ and docker-compose\n• PostgreSQL 15+\n• Node.js 20+\n• Nginx (SSL termination)\n• All 15 env vars in .env.docker\nCommand: docker-compose up --build -d\nVerify: curl http://localhost:3000/health" },
  ],
};

export default function AssistantPage() {
  const [token] = useState(() => typeof window !== "undefined" ? localStorage.getItem("dunazoe_token") || "" : "");
  const [mode, setMode] = useState("beginner");
  const [active, setActive] = useState(null);
  const [stepGuide, setStepGuide] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!token) return (
    <div style={{ minHeight:"100vh", background:S.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", color:"#8A9AB5" }}>
        <p style={{ fontSize:"2rem" }}>🔒</p>
        <p>Please <Link href="/deploy" style={{ color:S.accent }}>sign in at Deployment AI</Link> first.</p>
      </div>
    </div>
  );

  async function generateStepGuide() {
    setLoading(true); setStepGuide(null);
    try {
      const res = await fetch(`${API}/deployment/assistant/guide`, { headers:{ Authorization:`Bearer ${token}` } });
      const d = await res.json();
      if (d.success) setStepGuide(d.guide);
      else throw new Error();
    } catch {
      setStepGuide(`# STEP_GUIDE.md\n\nGenerated: ${new Date().toISOString()}\nMode: ${mode.toUpperCase()}\n\n## What To Do Next\n\n1. ✅ Verify all environment secrets are set\n2. 🔍 Run Deployment Audit at /deploy/audit\n3. 📊 Ensure all scores ≥ threshold\n4. 🚀 Deploy to staging first\n5. ✅ Verify staging health\n6. 🚀 Deploy to production\n7. 📡 Monitor for 72 hours at /deploy/monitor\n\n## Warnings\n- Never deploy with a blocked audit\n- Always test in staging before production\n- Keep a rollback plan ready\n\n## Rollback\n- Go to /deploy and press Rollback\n- Or: POST /deployment/rollback {run_id, reason}`);
    }
    finally { setLoading(false); }
  }

  function downloadGuide() {
    const blob = new Blob([stepGuide], { type:"text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "STEP_GUIDE.md"; a.click();
  }

  const guides = GUIDES[mode] || GUIDES.beginner;

  return (
    <div style={{ minHeight:"100vh", background:S.bg, padding:"20px 16px 80px", maxWidth:"520px", margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"6px" }}>
        <Link href="/deploy" style={{ color:"#3D4F6E", textDecoration:"none", fontSize:"0.8rem" }}>← Deploy AI</Link>
        <span style={{ color:"#3D4F6E" }}>/</span>
        <span style={{ color:"#8A9AB5", fontSize:"0.8rem" }}>Operator Assistant</span>
      </div>
      <h1 style={{ fontSize:"1.2rem", fontWeight:800, background:"linear-gradient(135deg,#00A3FF,#0066FF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", margin:"0 0 4px" }}>🤖 Operator Assistant</h1>
      <p style={{ color:"#3D4F6E", fontSize:"0.78rem", margin:"0 0 18px" }}>Your intelligent deployment guide — warnings, advice, and step-by-step help</p>

      <DeployNav />

      {/* MODE SELECTOR */}
      <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"14px", padding:"14px", marginBottom:"14px" }}>
        <p style={{ fontSize:"0.72rem", color:"#3D4F6E", margin:"0 0 10px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>Experience Mode</p>
        <div style={{ display:"flex", gap:"8px" }}>
          {["beginner","intermediate","advanced"].map(m => (
            <button key={m} onClick={()=>{ setMode(m); setActive(null); }} style={{ flex:1, padding:"9px", borderRadius:"9px", border:"none", cursor:"pointer", fontSize:"0.78rem", fontWeight:700, background:mode===m?"linear-gradient(135deg,#00A3FF,#0066FF)":"rgba(255,255,255,0.04)", color:mode===m?"#fff":"#8A9AB5", textTransform:"capitalize" }}>{m}</button>
          ))}
        </div>
        <p style={{ fontSize:"0.72rem", color:"#3D4F6E", margin:"10px 0 0" }}>
          {mode==="beginner"?"CEO / non-technical operator mode — plain language, step-by-step":mode==="intermediate"?"DevOps / team lead mode — system-aware guidance":"CTO / engineer mode — full technical context"}
        </p>
      </div>

      {/* Q&A */}
      <div style={{ marginBottom:"16px" }}>
        {guides.map((item, i) => (
          <div key={i} style={{ background:S.card, border:`1px solid ${active===i?"rgba(0,163,255,0.3)":S.border}`, borderRadius:"12px", marginBottom:"8px", overflow:"hidden" }}>
            <button onClick={() => setActive(active===i?null:i)} style={{ width:"100%", padding:"13px 14px", background:"transparent", border:"none", cursor:"pointer", textAlign:"left", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:"0.85rem", color:active===i?"#00A3FF":"#cdd5e0", fontWeight:600 }}>{item.q}</span>
              <span style={{ color:"#3D4F6E", fontSize:"0.9rem" }}>{active===i?"▲":"▼"}</span>
            </button>
            {active===i && (
              <div style={{ padding:"0 14px 13px" }}>
                <pre style={{ fontSize:"0.8rem", color:"#8A9AB5", margin:0, whiteSpace:"pre-wrap", lineHeight:1.7, fontFamily:"inherit" }}>{item.a}</pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* GENERATE STEP GUIDE */}
      <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"14px", padding:"16px", marginBottom:"14px" }}>
        <p style={{ fontSize:"0.72rem", color:"#3D4F6E", margin:"0 0 10px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>📄 Generate STEP_GUIDE.md</p>
        <p style={{ fontSize:"0.8rem", color:"#8A9AB5", margin:"0 0 12px" }}>Download a personalized operator step guide for current mode: <b style={{ color:"#00A3FF" }}>{mode}</b></p>
        <button onClick={generateStepGuide} disabled={loading} style={S.btn()}>{loading?"⏳ Generating...":"📄 Generate Step Guide"}</button>
        {stepGuide && (
          <div style={{ marginTop:"10px" }}>
            <pre style={{ fontSize:"0.72rem", color:"#8A9AB5", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:"8px", padding:"10px", maxHeight:"150px", overflow:"auto", whiteSpace:"pre-wrap" }}>{stepGuide}</pre>
            <button onClick={downloadGuide} style={{ ...S.btn("green"), marginTop:"8px" }}>⬇️ Download STEP_GUIDE.md</button>
          </div>
        )}
      </div>

      {/* QUICK LINKS */}
      <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"14px", padding:"14px" }}>
        <p style={{ fontSize:"0.72rem", color:"#3D4F6E", margin:"0 0 10px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>⚡ Quick Actions</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
          {[["/deploy/audit","🔍 Run Audit"],["/deploy/monitor","📡 Monitor"],["/deploy/apis","🔌 API Status"],["/deploy/features","⚙️ Features"],["/deploy/self","🔧 Self Mgmt"],["/deploy","🚀 Deploy"]].map(([href,label]) => (
            <Link key={href} href={href} style={{ padding:"10px", borderRadius:"9px", background:"rgba(0,163,255,0.04)", border:"1px solid rgba(0,163,255,0.1)", color:"#8A9AB5", textDecoration:"none", fontSize:"0.78rem", fontWeight:600, textAlign:"center" }}>{label}</Link>
          ))}
        </div>
      </div>

      <div style={{ textAlign:"center", marginTop:"24px" }}>
        <Link href="/deploy" style={{ color:"#3D4F6E", fontSize:"0.8rem", textDecoration:"none" }}>← Back to Deployment AI</Link>
      </div>
    </div>
  );
}
