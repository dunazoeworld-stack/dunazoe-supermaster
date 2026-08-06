"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://dunazoe.com";

const S = {
  bg:"#0A0E1A", card:"rgba(13,21,37,0.95)", accent:"#00A3FF",
  border:"rgba(0,163,255,0.12)",
  btn:(c="accent")=>({
    padding:"10px 14px", borderRadius:"10px", border:"none", fontWeight:700,
    cursor:"pointer", fontSize:"0.82rem",
    background:c==="accent"?"linear-gradient(135deg,#00A3FF,#0066FF)":
      c==="green"?"linear-gradient(135deg,#00CC88,#009966)":
      c==="red"?"rgba(255,59,92,0.15)":
      c==="warn"?"rgba(245,166,35,0.12)":"rgba(255,255,255,0.05)",
    color:c==="red"?"#FF3B5C":c==="warn"?"#F5A623":"#fff",
  }),
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
    { q:"What should I do next?", a:"1. Verify env secrets are all set (JWT_SECRET, DATABASE_URL, PAYSTACK_LSK)\n2. Run master audit — target: security≥90, reliability≥90\n3. Check GitHub integration is connected\n4. Deploy to staging — verify all 33 microservices respond\n5. Promote to production\n6. Start 72h post-deploy monitor" },
    { q:"Optimization advice", a:"Current architecture bottlenecks:\n• Add Redis caching for product catalog endpoints\n• Enable PgBouncer connection pooling\n• Configure Nginx rate limiting for auth routes\n• Enable CloudFront CDN for static assets\n• Monitor P95 latency — target <500ms" },
    { q:"Scaling advice", a:"DUNAZOE is microservices-ready. Scale path:\n1. Current: Single VPS (Contabo) — good for 0-10K users\n2. Next: Add Redis cluster + PostgreSQL replicas\n3. Future: Kubernetes / ECS for 100K+ users\n4. See /deploy/scaling for migration plans" },
    { q:"Estimated infrastructure cost", a:"Replit (current): ~$25/mo\nContabo VPS (4 cores, 8GB): ~$12/mo\nContabo VPS (8 cores, 30GB): ~$25/mo\nAWS ECS + RDS: ~$150-400/mo\nCloudflare (CDN + DNS): Free tier available" },
    { q:"API integration status", a:"Check /deploy/apis for live status of:\n• Paystack (payments)\n• OpenAI (AI features)\n• Cloudinary (uploads)\n• Supabase (if used)\n• SMTP (notifications)\n• GitHub (CI/CD)" },
  ],
  advanced: [
    { q:"What should I do next?", a:"1. Review deployment-ai-service audit thresholds (THRESHOLDS object)\n2. Check outbox_events for pending messages >100 (blocks reliability score)\n3. Verify reconciliation_runs last entry is 'passed'\n4. Check P95 latency in service_health_log — must be <500ms\n5. Validate all 33 services on ports 4001-4033 respond at /health\n6. Check docker-compose.yml service definitions\n7. Deploy: POST /deployment/deploy {version, environment, hosting_provider}" },
    { q:"Architecture decisions", a:"Frozen at v1.0.0-rc1 by CTO order.\n• Gateway: port 3000 (http-proxy-middleware)\n• Auth: JWT (RS256) — no fallback, throws on missing secret\n• DB: PostgreSQL with double-entry bookkeeping\n• Queue: outbox pattern (no RabbitMQ required in dev)\n• RBAC: role-based (user/vendor/admin/cto/super_admin)\n• Port map: auth:4001 … deployment-ai:4027 … activation:4033" },
    { q:"Debugging blocked audit", a:"Security score low:\n→ Check JWT_SECRET length ≥32 chars\n→ Remove placeholder values from env\n→ Set PAYSTACK_LSK (starts with sk_)\n\nReliability score low:\n→ Check outbox_events pending count\n→ Verify DB connectivity\n→ Run reconciliation\n\nScalability score low:\n→ Check files: nginx.conf, pgbouncer.ini, prometheus.yml\n→ Set REDIS_URL env var" },
    { q:"GitHub CI/CD pipeline", a:"Active at .github/workflows/ci.yml\nTriggers on: push to main\nSteps: install → lint → security audit → test → build → deploy\nWebhooks: POST /deployment/audit on merge\nRollback: POST /deployment/rollback {run_id, reason}" },
    { q:"Self-host checklist", a:"See /deploy/portability for full guide.\nRequired:\n• Docker 24+ and docker-compose\n• PostgreSQL 15+\n• Node.js 20+\n• Nginx (SSL termination)\n• All 15 env vars in .env.docker\nCommand: docker-compose up --build -d\nVerify: curl http://localhost:3000/health" },
  ],
};

// ── Operation definitions ─────────────────────────────────────────────────────
const OPERATIONS = [
  {
    id:"build", icon:"🔨", label:"Build", risk:"LOW",
    desc:"Compile frontend, verify TypeScript, run linter",
    what:"Runs: npm run build — compiles Next.js, checks for errors",
    recovery:"If build fails: check console for TypeScript or import errors",
    modes:["manual","assisted","auto"],
    endpoint:"/deployment/build",
  },
  {
    id:"test", icon:"🧪", label:"Test", risk:"LOW",
    desc:"Run automated test suite and security audit",
    what:"Runs: npm test + dependency audit + lint checks",
    recovery:"If tests fail: review failed test names in the report",
    modes:["manual","assisted"],
    endpoint:"/deployment/audit",
  },
  {
    id:"fix", icon:"🔧", label:"AI Fix", risk:"LOW",
    desc:"AI analyses audit results and suggests targeted patches",
    what:"Reads audit report → generates specific fix instructions for each blocked item",
    recovery:"Fixes are advisory — review before applying",
    modes:["assisted","auto"],
    endpoint:"/deployment/assistant/guide",
  },
  {
    id:"run", icon:"▶️", label:"Run", risk:"LOW",
    desc:"Start all 33 microservices and frontend dev server",
    what:"Starts services on ports 4001-4033 + Next.js on 5000",
    recovery:"If service won't start: check /deploy/monitor for port conflicts",
    modes:["manual","assisted","auto"],
    endpoint:"/deployment/run",
  },
  {
    id:"deploy", icon:"🚀", label:"Deploy", risk:"MEDIUM",
    desc:"Deploy to staging environment — requires audit score ≥85",
    what:"Builds, uploads, and deploys to staging. Runs health checks after deploy.",
    recovery:"Rollback available immediately if health checks fail",
    modes:["manual","assisted"],
    endpoint:"/deployment/deploy",
  },
  {
    id:"publish", icon:"🌍", label:"Publish", risk:"HIGH",
    desc:"Promote staging to production — IRREVERSIBLE without rollback",
    what:"Switches production traffic to the new build. DNS propagation may take 5-30 min.",
    recovery:"Rollback: go to /deploy and press Rollback — restores previous version",
    modes:["manual"],
    endpoint:"/deployment/promote",
  },
  {
    id:"rollback", icon:"⏪", label:"Rollback", risk:"MEDIUM",
    desc:"Restore the previous working production build",
    what:"Reverts frontend and services to the last known-good deployment",
    recovery:"If rollback fails: contact tech team immediately — do not redeploy",
    modes:["manual","assisted"],
    endpoint:"/deployment/rollback",
  },
];

// ── App Preview Panel ─────────────────────────────────────────────────────────
function AppPreviewPanel({ previewUrl, setPreviewUrl }) {
  const [isMobile, setIsMobile] = useState(false);
  const [loading,  setLoading]  = useState(true);
  const iframeRef = useRef(null);

  function refresh() {
    setLoading(true);
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  }

  const displayUrl = previewUrl || SITE;

  return (
    <div style={{ background:S.card, border:"1px solid rgba(0,163,255,0.2)", borderRadius:"16px", overflow:"hidden", display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Toolbar */}
      <div style={{ padding:"10px 14px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
        <span style={{ fontSize:"0.75rem", fontWeight:700, color:"#3D4F6E", textTransform:"uppercase", letterSpacing:"0.06em", flexShrink:0 }}>🖥️ App Preview</span>
        <input
          value={previewUrl}
          onChange={e => setPreviewUrl(e.target.value)}
          placeholder={`${SITE}/products`}
          style={{ flex:1, minWidth:"120px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(0,163,255,0.15)", borderRadius:"7px", padding:"5px 10px", color:"#cdd5e0", fontSize:"0.75rem", outline:"none" }}
        />
        <button onClick={refresh} style={{ ...S.btn(""), padding:"5px 10px", fontSize:"0.75rem" }}>↻</button>
        <button onClick={() => setIsMobile(m => !m)} style={{ ...S.btn(isMobile?"accent":""), padding:"5px 10px", fontSize:"0.75rem" }}>
          {isMobile ? "📱" : "🖥️"}
        </button>
        <a href={displayUrl} target="_blank" rel="noopener noreferrer" style={{ ...S.btn("green"), padding:"5px 10px", fontSize:"0.75rem", textDecoration:"none" }}>↗</a>
      </div>

      {/* Preview iframe */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", background:"#060C18", padding:"12px", minHeight:"400px" }}>
        <div style={{
          width: isMobile ? "375px" : "100%",
          maxWidth: isMobile ? "375px" : "none",
          height: "480px",
          border: isMobile ? "8px solid #1A2540" : "none",
          borderRadius: isMobile ? "24px" : "0",
          overflow:"hidden",
          position:"relative",
          transition:"all 0.3s ease",
          boxShadow: isMobile ? "0 20px 60px rgba(0,0,0,0.5)" : "none",
        }}>
          {loading && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"#060C18", zIndex:2 }}>
              <span style={{ color:"#3D4F6E", fontSize:"0.8rem" }}>Loading preview…</span>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={displayUrl}
            style={{ width:"100%", height:"100%", border:"none", display:"block" }}
            onLoad={() => setLoading(false)}
            title="App Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>

      <div style={{ padding:"8px 14px", borderTop:"1px solid rgba(255,255,255,0.04)" }}>
        <p style={{ fontSize:"0.68rem", color:"#3D4F6E", margin:0 }}>
          Preview shows the running app. Enter any path to inspect. Mobile mode: 375px viewport.
        </p>
      </div>
    </div>
  );
}

// ── Operation Control Panel ───────────────────────────────────────────────────
function OperationsPanel({ token }) {
  const [mode,       setMode]       = useState("manual");
  const [confirm,    setConfirm]    = useState(null);   // op being confirmed
  const [running,    setRunning]    = useState(null);   // op in progress
  const [results,    setResults]    = useState({});     // { opId: { ok, msg } }

  async function execute(op) {
    setConfirm(null);
    setRunning(op.id);
    try {
      const r = await fetch(`${API}${op.endpoint}`, {
        method: "POST",
        headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ mode, triggered_by:"operator_assistant", timestamp: new Date().toISOString() }),
      });
      const d = await r.json().catch(() => ({}));
      const ok = r.ok || d.success;
      setResults(prev => ({ ...prev, [op.id]: {
        ok,
        msg: d.message || d.guide?.slice(0, 120) || (ok ? "✅ Operation completed" : `⚠️ ${d.error || "Service offline — operation queued"}`),
        ts: new Date().toLocaleTimeString("en-NG"),
      }}));
    } catch (_) {
      setResults(prev => ({ ...prev, [op.id]: { ok:false, msg:"⚠️ Service unreachable — check microservices are running", ts: new Date().toLocaleTimeString("en-NG") }}));
    }
    setRunning(null);
  }

  const RISK_COLOR = { LOW:"#00CC88", MEDIUM:"#F5A623", HIGH:"#FF3B5C" };

  return (
    <div style={{ background:S.card, border:"1px solid rgba(0,163,255,0.2)", borderRadius:"14px", padding:"14px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
        <p style={{ fontWeight:800, fontSize:"0.9rem", color:"#cdd5e0", margin:0 }}>⚙️ Operation Control</p>
        <div style={{ display:"flex", gap:"4px" }}>
          {["manual","assisted","auto"].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding:"4px 10px", borderRadius:"6px", border:"none", fontSize:"0.68rem",
              fontWeight:700, cursor:"pointer", textTransform:"capitalize",
              background: mode===m?"linear-gradient(135deg,#00A3FF,#0066FF)":"rgba(255,255,255,0.04)",
              color: mode===m?"#fff":"#3D4F6E",
            }}>{m}</button>
          ))}
        </div>
      </div>
      <p style={{ fontSize:"0.7rem", color:"#3D4F6E", margin:"0 0 12px" }}>
        {mode==="manual"?"Manual: you confirm every action before execution":
         mode==="assisted"?"Assisted: AI reviews and flags risks, you approve":
         "Auto: runs safe operations (LOW risk only) automatically"}
      </p>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px" }}>
        {OPERATIONS.filter(op => op.modes.includes(mode) || mode==="manual").map(op => {
          const result = results[op.id];
          const isRunning = running === op.id;
          const isConfirming = confirm === op.id;

          return (
            <div key={op.id} style={{
              background:"rgba(255,255,255,0.02)", border:`1px solid ${isConfirming?"rgba(245,166,35,0.4)":result ? (result.ok?"rgba(0,200,120,0.2)":"rgba(255,59,92,0.2)"):"rgba(255,255,255,0.06)"}`,
              borderRadius:"10px", padding:"10px",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"4px" }}>
                <span style={{ fontSize:"1rem" }}>{op.icon}</span>
                <span style={{ fontWeight:700, fontSize:"0.8rem", color:"#cdd5e0", flex:1 }}>{op.label}</span>
                <span style={{ fontSize:"0.6rem", fontWeight:700, color:RISK_COLOR[op.risk] }}>{op.risk}</span>
              </div>
              <p style={{ fontSize:"0.68rem", color:"#5A6A80", margin:"0 0 8px", lineHeight:1.4 }}>{op.desc}</p>

              {result && (
                <p style={{ fontSize:"0.68rem", color:result.ok?"#00CC88":"#F5A623", margin:"0 0 6px", lineHeight:1.4 }}>
                  {result.msg} <span style={{ color:"#3D4F6E" }}>({result.ts})</span>
                </p>
              )}

              {isConfirming ? (
                <div>
                  <p style={{ fontSize:"0.68rem", color:"#F5A623", margin:"0 0 6px" }}>
                    ⚠️ {op.what}
                  </p>
                  <p style={{ fontSize:"0.65rem", color:"#5A6A80", margin:"0 0 8px" }}>Recovery: {op.recovery}</p>
                  <div style={{ display:"flex", gap:"4px" }}>
                    <button onClick={() => execute(op)} style={{ ...S.btn("accent"), padding:"5px 10px", fontSize:"0.7rem", flex:1 }}>✅ Confirm</button>
                    <button onClick={() => setConfirm(null)} style={{ ...S.btn("red"), padding:"5px 10px", fontSize:"0.7rem" }}>✕</button>
                  </div>
                </div>
              ) : (
                <button
                  disabled={!!running}
                  onClick={() => op.risk==="HIGH" || mode!=="auto" ? setConfirm(op.id) : execute(op)}
                  style={{ ...S.btn(op.risk==="HIGH"?"red":op.risk==="MEDIUM"?"warn":"accent"), width:"100%", padding:"5px 10px", fontSize:"0.72rem", opacity: running ? 0.5 : 1 }}
                >
                  {isRunning ? "⏳ Running…" : `${op.icon} ${op.label}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AssistantPage() {
  const [token] = useState(() => typeof window !== "undefined" ? localStorage.getItem("dunazoe_token") || "" : "");
  const [mode, setMode] = useState("beginner");
  const [active, setActive] = useState(null);
  const [stepGuide, setStepGuide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(SITE);
  const [showPreview, setShowPreview] = useState(false);

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
    <div style={{ minHeight:"100vh", background:S.bg, padding:"20px 16px 80px" }}>
      <div style={{ maxWidth: showPreview ? "1400px" : "680px", margin:"0 auto" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"6px" }}>
          <Link href="/deploy" style={{ color:"#3D4F6E", textDecoration:"none", fontSize:"0.8rem" }}>← Deploy AI</Link>
          <span style={{ color:"#3D4F6E" }}>/</span>
          <span style={{ color:"#8A9AB5", fontSize:"0.8rem" }}>Operator Assistant</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"4px" }}>
          <h1 style={{ fontSize:"1.2rem", fontWeight:800, background:"linear-gradient(135deg,#00A3FF,#0066FF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", margin:0 }}>
            🤖 Operator Assistant
          </h1>
          <button onClick={() => setShowPreview(p => !p)} style={{ ...S.btn(showPreview?"accent":""), padding:"6px 14px", fontSize:"0.75rem" }}>
            {showPreview ? "▼ Hide Preview" : "🖥️ App Preview"}
          </button>
        </div>
        <p style={{ color:"#3D4F6E", fontSize:"0.78rem", margin:"0 0 14px" }}>
          Build · Test · Fix · Run · Deploy · Publish · Rollback — with AI guidance and live preview
        </p>

        <DeployNav />

        {/* Split layout when preview is open */}
        <div style={{ display: showPreview ? "grid" : "block", gridTemplateColumns: showPreview ? "420px 1fr" : "none", gap:"20px", alignItems:"start" }}>

          {/* LEFT COLUMN — AI Assistant */}
          <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>

            {/* Operations panel */}
            <OperationsPanel token={token} />

            {/* MODE SELECTOR */}
            <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"14px", padding:"14px" }}>
              <p style={{ fontSize:"0.72rem", color:"#3D4F6E", margin:"0 0 10px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>Experience Mode</p>
              <div style={{ display:"flex", gap:"8px", marginBottom:"10px" }}>
                {["beginner","intermediate","advanced"].map(m => (
                  <button key={m} onClick={()=>{ setMode(m); setActive(null); }} style={{ flex:1, padding:"9px", borderRadius:"9px", border:"none", cursor:"pointer", fontSize:"0.75rem", fontWeight:700, background:mode===m?"linear-gradient(135deg,#00A3FF,#0066FF)":"rgba(255,255,255,0.04)", color:mode===m?"#fff":"#8A9AB5", textTransform:"capitalize" }}>{m}</button>
                ))}
              </div>
              <p style={{ fontSize:"0.7rem", color:"#3D4F6E", margin:0 }}>
                {mode==="beginner"?"CEO / non-technical mode — plain language, step-by-step":mode==="intermediate"?"DevOps / team lead mode — system-aware guidance":"CTO / engineer mode — full technical context"}
              </p>
            </div>

            {/* Q&A */}
            <div>
              {guides.map((item, i) => (
                <div key={i} style={{ background:S.card, border:`1px solid ${active===i?"rgba(0,163,255,0.3)":S.border}`, borderRadius:"12px", marginBottom:"8px", overflow:"hidden" }}>
                  <button onClick={() => setActive(active===i?null:i)} style={{ width:"100%", padding:"12px 14px", background:"transparent", border:"none", cursor:"pointer", textAlign:"left", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:"0.83rem", color:active===i?"#00A3FF":"#cdd5e0", fontWeight:600 }}>{item.q}</span>
                    <span style={{ color:"#3D4F6E", fontSize:"0.9rem" }}>{active===i?"▲":"▼"}</span>
                  </button>
                  {active===i && (
                    <div style={{ padding:"0 14px 13px" }}>
                      <pre style={{ fontSize:"0.78rem", color:"#8A9AB5", margin:0, whiteSpace:"pre-wrap", lineHeight:1.7, fontFamily:"inherit" }}>{item.a}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* GENERATE STEP GUIDE */}
            <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"14px", padding:"14px" }}>
              <p style={{ fontSize:"0.72rem", color:"#3D4F6E", margin:"0 0 8px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>📄 Generate STEP_GUIDE.md</p>
              <button onClick={generateStepGuide} disabled={loading} style={{ ...S.btn(), width:"100%", marginBottom:"8px" }}>{loading?"⏳ Generating...":"📄 Generate Step Guide"}</button>
              {stepGuide && (
                <div>
                  <pre style={{ fontSize:"0.7rem", color:"#8A9AB5", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:"8px", padding:"10px", maxHeight:"120px", overflow:"auto", whiteSpace:"pre-wrap", margin:"0 0 8px" }}>{stepGuide}</pre>
                  <button onClick={downloadGuide} style={{ ...S.btn("green"), width:"100%" }}>⬇️ Download STEP_GUIDE.md</button>
                </div>
              )}
            </div>

            {/* QUICK LINKS */}
            <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"14px", padding:"14px" }}>
              <p style={{ fontSize:"0.72rem", color:"#3D4F6E", margin:"0 0 10px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>⚡ Quick Actions</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px" }}>
                {[["/deploy/audit","🔍 Audit"],["/deploy/monitor","📡 Monitor"],["/deploy/apis","🔌 APIs"],["/deploy/features","⚙️ Features"],["/deploy/scaling","📈 Scaling"],["/deploy","🚀 Deploy"]].map(([href,label]) => (
                  <Link key={href} href={href} style={{ padding:"9px", borderRadius:"9px", background:"rgba(0,163,255,0.04)", border:"1px solid rgba(0,163,255,0.1)", color:"#8A9AB5", textDecoration:"none", fontSize:"0.75rem", fontWeight:600, textAlign:"center" }}>{label}</Link>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN — App Preview (shown when toggled) */}
          {showPreview && (
            <div style={{ position:"sticky", top:"80px" }}>
              <AppPreviewPanel previewUrl={previewUrl} setPreviewUrl={setPreviewUrl} />
            </div>
          )}
        </div>

        <div style={{ textAlign:"center", marginTop:"24px" }}>
          <Link href="/deploy" style={{ color:"#3D4F6E", fontSize:"0.8rem", textDecoration:"none" }}>← Back to Deployment AI</Link>
        </div>
      </div>
    </div>
  );
}
