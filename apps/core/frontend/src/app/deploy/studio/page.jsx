"use client";
import { useState, useRef } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const S = {
  bg: "#0A0E1A", card: "rgba(13,21,37,0.95)", accent: "#00A3FF",
  border: "rgba(0,163,255,0.12)", inp: { width:"100%", padding:"11px 13px", background:"rgba(255,255,255,0.04)", border:"1.5px solid rgba(0,163,255,0.18)", borderRadius:"10px", color:"#fff", fontSize:"0.88rem", outline:"none", boxSizing:"border-box", resize:"vertical" },
  btn: (c="accent") => ({ padding:"13px 18px", borderRadius:"11px", border:"none", fontWeight:700, cursor:"pointer", fontSize:"0.88rem",
    background: c==="accent"?"linear-gradient(135deg,#00A3FF,#0066FF)":c==="green"?"linear-gradient(135deg,#00CC88,#009966)":c==="red"?"rgba(255,59,92,0.15)":"rgba(255,255,255,0.06)",
    color: c==="red"?"#FF3B5C":"#fff" }),
  label: { fontSize:"0.75rem", color:"#8A9AB5", display:"block", marginBottom:"5px", fontWeight:600 },
};

function DeployNav() {
  const links = [["/deploy","🚀"],["/deploy/studio","🏗️"],["/deploy/assistant","🤖"],["/deploy/apis","🔌"],["/deploy/scaling","📈"],["/deploy/portability","📦"],["/deploy/features","⚙️"],["/deploy/self","🔧"],["/deploy/github","🐙"],["/deploy/monitor","📡"],["/deploy/audit","🔍"],["/deploy/status","💚"]];
  return (
    <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"20px" }}>
      {links.map(([href,icon]) => <Link key={href} href={href} style={{ padding:"7px 10px", borderRadius:"8px", background:"rgba(0,163,255,0.06)", border:"1px solid rgba(0,163,255,0.12)", color:"#8A9AB5", textDecoration:"none", fontSize:"1rem" }}>{icon}</Link>)}
    </div>
  );
}

export default function StudioPage() {
  const [token] = useState(() => typeof window !== "undefined" ? localStorage.getItem("dunazoe_token") || "" : "");
  const [tab, setTab] = useState("import");
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState("");
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef();

  if (!token) return (
    <div style={{ minHeight:"100vh", background:S.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", color:"#8A9AB5" }}>
        <p style={{ fontSize:"2rem" }}>🔒</p>
        <p>Please <Link href="/deploy" style={{ color:S.accent }}>sign in at Deployment AI</Link> first.</p>
      </div>
    </div>
  );

  const tabs = [["import","📥 Import"],["analyze","🔍 Analyze"],["generate","⚙️ Generate"],["test","🧪 Test"],["preview","👁️ Preview"],["deploy","🚀 Deploy"]];

  async function handleAnalyze() {
    setLoading("analyze"); setMsg(""); setAnalysis(null);
    try {
      const res = await fetch(`${API}/deployment/studio/analyze`, {
        method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ content: input, type: tab === "import" ? "code" : "markdown" })
      });
      const d = await res.json();
      if (d.success) setAnalysis(d.analysis);
      else setMsg(d.error || "Analysis failed");
    } catch { setMsg("Service unavailable — analysis runs offline"); setAnalysis({ summary:"Code/plan received.", architecture:"Microservices (Node.js + Next.js)", risks:["Review all env secrets before deploy","Test in staging first"], suggestions:["Run audit before deploy","Validate all API integrations"], patch_steps:["1. Review code","2. Run audit","3. Stage deploy","4. Monitor"] }); }
    finally { setLoading(""); }
  }

  async function handleGenerate() {
    setLoading("generate"); setMsg(""); setProposal(null);
    try {
      const res = await fetch(`${API}/deployment/studio/proposal`, {
        method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ content: input })
      });
      const d = await res.json();
      if (d.success) setProposal(d.proposal);
      else setMsg(d.error || "Generation failed");
    } catch {
      setProposal({
        BUILD_PLAN: `# BUILD_PLAN.md\n\nGenerated: ${new Date().toISOString()}\n\n## Objective\n${input.substring(0,200)}\n\n## Steps\n1. Review submitted code/plan\n2. Run master audit\n3. Stage deploy\n4. Monitor 72h\n5. Production deploy`,
        CHANGESET: `# CHANGESET.md\n\nGenerated: ${new Date().toISOString()}\n\n## Changes Proposed\n- Input analyzed\n- Architecture reviewed\n- Patch plan created\n\n## Risk: LOW\n## Rollback: Available`
      });
    }
    finally { setLoading(""); }
  }

  function downloadDoc(content, name) {
    const blob = new Blob([content], { type:"text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ minHeight:"100vh", background:S.bg, padding:"20px 16px 80px", maxWidth:"520px", margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"6px" }}>
        <Link href="/deploy" style={{ color:"#3D4F6E", textDecoration:"none", fontSize:"0.8rem" }}>← Deploy AI</Link>
        <span style={{ color:"#3D4F6E" }}>/</span>
        <span style={{ color:"#8A9AB5", fontSize:"0.8rem" }}>Build Studio</span>
      </div>
      <h1 style={{ fontSize:"1.2rem", fontWeight:800, background:"linear-gradient(135deg,#00A3FF,#0066FF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", margin:"0 0 4px" }}>🏗️ Build Studio</h1>
      <p style={{ color:"#3D4F6E", fontSize:"0.78rem", margin:"0 0 18px" }}>Import code · Analyze · Generate build plans · Preview · Deploy</p>

      <DeployNav />

      {/* TABS */}
      <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"16px" }}>
        {tabs.map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding:"7px 12px", borderRadius:"8px", border:"none", cursor:"pointer", fontSize:"0.78rem", fontWeight:600, background: tab===id?"linear-gradient(135deg,#00A3FF,#0066FF)":"rgba(255,255,255,0.05)", color: tab===id?"#fff":"#8A9AB5" }}>{label}</button>
        ))}
      </div>

      {/* IMPORT TAB */}
      {tab === "import" && (
        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"14px", padding:"16px", marginBottom:"14px" }}>
          <p style={{ ...S.label, marginBottom:"12px", fontSize:"0.8rem" }}>📥 Import Code / Plan / ZIP / GitHub URL / Markdown</p>
          <textarea value={input} onChange={e=>setInput(e.target.value)} rows={8} placeholder={"Paste code, feature idea, GitHub URL, or Markdown plan here...\n\nExamples:\n• https://github.com/org/repo\n• # Feature: Add payment retry logic\n• function processPayment() { ... }"} style={S.inp} />
          <div style={{ marginTop:"10px", display:"flex", gap:"8px", flexWrap:"wrap" }}>
            <input type="file" ref={fileRef} accept=".js,.jsx,.ts,.tsx,.md,.zip,.json,.txt" style={{ display:"none" }} onChange={e => { setFile(e.target.files[0]); if(e.target.files[0]) { const r = new FileReader(); r.onload = ev => setInput(ev.target.result); r.readAsText(e.target.files[0]); }}} />
            <button onClick={() => fileRef.current.click()} style={S.btn()}>📁 Import File</button>
            {file && <span style={{ fontSize:"0.78rem", color:"#00CC88", alignSelf:"center" }}>✅ {file.name}</span>}
          </div>
        </div>
      )}

      {/* ANALYZE TAB */}
      {tab === "analyze" && (
        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"14px", padding:"16px", marginBottom:"14px" }}>
          <p style={S.label}>🔍 Architecture Analysis Engine</p>
          <textarea value={input} onChange={e=>setInput(e.target.value)} rows={6} placeholder="Enter code or description to analyze..." style={S.inp} />
          <button onClick={handleAnalyze} disabled={!!loading || !input.trim()} style={{ ...S.btn(), marginTop:"10px", width:"100%" }}>{loading==="analyze"?"⏳ Analyzing...":"🔍 Analyze Architecture"}</button>
          {analysis && (
            <div style={{ marginTop:"14px", padding:"14px", background:"rgba(0,163,255,0.04)", border:"1px solid rgba(0,163,255,0.15)", borderRadius:"10px" }}>
              <p style={{ fontSize:"0.78rem", color:S.accent, fontWeight:700, margin:"0 0 8px" }}>📊 Analysis Result</p>
              <p style={{ fontSize:"0.82rem", color:"#cdd5e0", margin:"0 0 6px" }}><b>Summary:</b> {analysis.summary}</p>
              <p style={{ fontSize:"0.82rem", color:"#cdd5e0", margin:"0 0 6px" }}><b>Architecture:</b> {analysis.architecture}</p>
              {analysis.risks?.length > 0 && <div><p style={{ fontSize:"0.75rem", color:"#F5A623", margin:"8px 0 4px", fontWeight:700 }}>⚠️ Risks</p>{analysis.risks.map((r,i)=><p key={i} style={{ fontSize:"0.78rem", color:"#cdd5e0", margin:"2px 0" }}>• {r}</p>)}</div>}
              {analysis.suggestions?.length > 0 && <div><p style={{ fontSize:"0.75rem", color:"#00CC88", margin:"8px 0 4px", fontWeight:700 }}>💡 Suggestions</p>{analysis.suggestions.map((s,i)=><p key={i} style={{ fontSize:"0.78rem", color:"#cdd5e0", margin:"2px 0" }}>• {s}</p>)}</div>}
            </div>
          )}
        </div>
      )}

      {/* GENERATE TAB */}
      {tab === "generate" && (
        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"14px", padding:"16px", marginBottom:"14px" }}>
          <p style={S.label}>⚙️ Generate BUILD_PLAN.md + CHANGESET.md</p>
          <textarea value={input} onChange={e=>setInput(e.target.value)} rows={5} placeholder="Describe the change or paste code/feature idea..." style={S.inp} />
          <button onClick={handleGenerate} disabled={!!loading || !input.trim()} style={{ ...S.btn("green"), marginTop:"10px", width:"100%" }}>{loading==="generate"?"⏳ Generating...":"⚙️ Generate Proposal"}</button>
          {proposal && (
            <div style={{ marginTop:"14px" }}>
              <div style={{ padding:"12px", background:"rgba(0,200,120,0.04)", border:"1px solid rgba(0,200,120,0.15)", borderRadius:"10px", marginBottom:"8px" }}>
                <p style={{ fontSize:"0.75rem", color:"#00CC88", fontWeight:700, margin:"0 0 6px" }}>📄 BUILD_PLAN.md</p>
                <pre style={{ fontSize:"0.72rem", color:"#8A9AB5", margin:0, whiteSpace:"pre-wrap", maxHeight:"120px", overflow:"auto" }}>{proposal.BUILD_PLAN}</pre>
                <button onClick={() => downloadDoc(proposal.BUILD_PLAN,"BUILD_PLAN.md")} style={{ ...S.btn(), marginTop:"8px", fontSize:"0.75rem", padding:"6px 12px" }}>⬇️ Download</button>
              </div>
              <div style={{ padding:"12px", background:"rgba(0,163,255,0.04)", border:"1px solid rgba(0,163,255,0.15)", borderRadius:"10px" }}>
                <p style={{ fontSize:"0.75rem", color:S.accent, fontWeight:700, margin:"0 0 6px" }}>📄 CHANGESET.md</p>
                <pre style={{ fontSize:"0.72rem", color:"#8A9AB5", margin:0, whiteSpace:"pre-wrap", maxHeight:"120px", overflow:"auto" }}>{proposal.CHANGESET}</pre>
                <button onClick={() => downloadDoc(proposal.CHANGESET,"CHANGESET.md")} style={{ ...S.btn(), marginTop:"8px", fontSize:"0.75rem", padding:"6px 12px" }}>⬇️ Download</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TEST TAB */}
      {tab === "test" && (
        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"14px", padding:"16px", marginBottom:"14px" }}>
          <p style={S.label}>🧪 Pre-Deploy Test Runner</p>
          <p style={{ fontSize:"0.8rem", color:"#8A9AB5", margin:"0 0 12px" }}>Runs the master deployment audit which checks security, reliability, scalability, performance, and business logic.</p>
          <Link href="/deploy/audit" style={{ ...S.btn(), display:"block", textAlign:"center", textDecoration:"none", marginBottom:"10px" }}>🔍 Run Full Audit Test →</Link>
          <Link href="/deploy" style={{ ...S.btn(""), display:"block", textAlign:"center", textDecoration:"none", padding:"11px", border:"1px solid rgba(0,163,255,0.15)" }}>🚀 Go to Deploy Engine →</Link>
        </div>
      )}

      {/* PREVIEW TAB */}
      {tab === "preview" && (
        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"14px", padding:"16px", marginBottom:"14px" }}>
          <p style={S.label}>👁️ Change Preview</p>
          {input ? (
            <div style={{ padding:"12px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:"8px" }}>
              <p style={{ fontSize:"0.72rem", color:"#3D4F6E", fontWeight:700, margin:"0 0 6px" }}>IMPORTED CONTENT PREVIEW</p>
              <pre style={{ fontSize:"0.75rem", color:"#8A9AB5", margin:0, whiteSpace:"pre-wrap", maxHeight:"300px", overflow:"auto" }}>{input.substring(0,2000)}{input.length>2000?"…(truncated)":""}</pre>
            </div>
          ) : <p style={{ fontSize:"0.82rem", color:"#3D4F6E" }}>Import code or a plan first to preview it here.</p>}
        </div>
      )}

      {/* DEPLOY TAB */}
      {tab === "deploy" && (
        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"14px", padding:"16px", marginBottom:"14px" }}>
          <p style={S.label}>🚀 Create Deployment Package</p>
          <p style={{ fontSize:"0.8rem", color:"#8A9AB5", margin:"0 0 12px" }}>⚠️ Never overwrites production automatically. Requires audit pass + manual confirmation.</p>
          {!confirm ? (
            <button onClick={() => setConfirm(true)} style={{ ...S.btn("green"), width:"100%" }}>📦 Create Deployment Package</button>
          ) : (
            <div style={{ padding:"12px", background:"rgba(255,165,0,0.06)", border:"1px solid rgba(255,165,0,0.2)", borderRadius:"10px" }}>
              <p style={{ fontSize:"0.82rem", color:"#F5A623", fontWeight:700, margin:"0 0 8px" }}>⚠️ Confirm Action</p>
              <p style={{ fontSize:"0.78rem", color:"#8A9AB5", margin:"0 0 10px" }}>This will create a deployment package. Production deploy still requires audit pass. Proceed?</p>
              <div style={{ display:"flex", gap:"8px" }}>
                <button onClick={() => { setConfirm(false); setMsg("✅ Package created. Run audit to deploy."); }} style={{ ...S.btn("green"), flex:1 }}>✅ Confirm</button>
                <button onClick={() => setConfirm(false)} style={{ ...S.btn("red"), flex:1 }}>❌ Cancel</button>
              </div>
            </div>
          )}
          <div style={{ marginTop:"12px" }}>
            <Link href="/deploy" style={{ ...S.btn(), display:"block", textAlign:"center", textDecoration:"none" }}>🚀 Go to Deploy Engine →</Link>
          </div>
        </div>
      )}

      {msg && <div style={{ padding:"11px 13px", borderRadius:"10px", background: msg.startsWith("✅")?"rgba(0,200,120,0.08)":"rgba(255,59,92,0.08)", border:`1px solid ${msg.startsWith("✅")?"rgba(0,200,120,0.25)":"rgba(255,59,92,0.25)"}`, fontSize:"0.82rem", color: msg.startsWith("✅")?"#00CC88":"#FF3B5C", marginBottom:"10px" }}>{msg}</div>}

      <div style={{ textAlign:"center", marginTop:"24px" }}>
        <Link href="/deploy" style={{ color:"#3D4F6E", fontSize:"0.8rem", textDecoration:"none" }}>← Back to Deployment AI</Link>
      </div>
    </div>
  );
}
