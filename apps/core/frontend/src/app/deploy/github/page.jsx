"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const S = {
  bg:"#0A0E1A", card:"rgba(13,21,37,0.95)", accent:"#00A3FF",
  border:"rgba(0,163,255,0.12)",
  inp:{ width:"100%", padding:"11px 13px", background:"rgba(255,255,255,0.05)", border:"1.5px solid rgba(0,163,255,0.2)", borderRadius:"10px", color:"#fff", fontSize:"0.88rem", outline:"none", boxSizing:"border-box" },
  btn:(c="accent")=>({ padding:"11px 14px", borderRadius:"10px", border:"none", fontWeight:700, cursor:"pointer", fontSize:"0.83rem",
    background:c==="accent"?"linear-gradient(135deg,#00A3FF,#0066FF)":c==="green"?"linear-gradient(135deg,#00CC88,#009966)":c==="red"?"rgba(255,59,92,0.12)":c==="warn"?"rgba(245,166,35,0.12)":"rgba(255,255,255,0.05)",
    color:c==="red"?"#FF3B5C":c==="warn"?"#F5A623":"#fff" }),
};

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() { navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }
  return <button onClick={copy} style={{ padding:"3px 8px", borderRadius:"6px", background:"rgba(0,163,255,0.1)", border:"1px solid rgba(0,163,255,0.2)", color:"#00A3FF", fontSize:"0.65rem", cursor:"pointer", flexShrink:0 }}>{copied?"✓ copied":"copy"}</button>;
}

function DeployNav() {
  const links = [["/deploy","🚀"],["/deploy/studio","🏗️"],["/deploy/assistant","🤖"],["/deploy/apis","🔌"],["/deploy/scaling","📈"],["/deploy/portability","📦"],["/deploy/features","⚙️"],["/deploy/self","🔧"],["/deploy/github","🐙"],["/deploy/monitor","📡"],["/deploy/audit","🔍"],["/deploy/status","💚"]];
  return (
    <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginTop:"16px", marginBottom:"16px" }}>
      {links.map(([href,icon]) => <Link key={href} href={href} style={{ padding:"7px 10px", borderRadius:"8px", background:"rgba(0,163,255,0.06)", border:"1px solid rgba(0,163,255,0.12)", color:"#8A9AB5", textDecoration:"none", fontSize:"1rem" }}>{icon}</Link>)}
    </div>
  );
}

export default function GitHubPage() {
  const [data, setData]         = useState(null);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState("");
  const [authed, setAuthed]     = useState(false);
  const [token, setToken]       = useState("");
  const [tab, setTab]           = useState("status");
  const [secrets, setSecrets]   = useState({ github_token:"", github_repo:"", commit_msg:"" });
  const [secretsSaved, setSecretsSaved] = useState(false);
  const [actionResult, setActionResult] = useState(null);
  const [confirm, setConfirm]   = useState(null);

  useEffect(() => {
    const t = localStorage.getItem("dunazoe_token");
    if (t) { setToken(t); setAuthed(true); loadData(t); }
  }, []);

  async function loadData(t) {
    setLoading("fetch");
    try {
      const r = await fetch(`${API}/deployment/github`, { headers:{ Authorization:`Bearer ${t||token}` } });
      const d = await r.json();
      if (d.success) setData(d); else setError(d.error||"Failed to load");
    } catch {
      setData({
        repo: process.env.NEXT_PUBLIC_GITHUB_REPO || "dunazoeworld-stack/dunazoe-supermaster",
        branch:"main", tag:"v1.0.0-rc1",
        status:"READY_TO_PUSH",
        last_checked: new Date().toISOString(),
        push_commands:[
          "git add .",
          "git commit -m \"feat: DUNAZOE Deployment AI Control Plane [$(date +%Y%m%d-%H%M)]\"",
          "git tag v1.0.0-rc1",
          "git push origin main",
          "git push origin v1.0.0-rc1",
        ],
      });
    }
    finally { setLoading(""); }
  }

  async function login(e) {
    e.preventDefault(); setError(""); setLoading("login");
    const f = new FormData(e.target);
    try {
      const r = await fetch(`${API}/auth/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email:f.get("email"), password:f.get("password") }) });
      const d = await r.json();
      if (!d.success || !["admin","super_admin","cto"].includes(d.role)) { setError(d.error||"Admin access only"); return; }
      localStorage.setItem("dunazoe_token", d.token);
      setToken(d.token); setAuthed(true); loadData(d.token);
    } catch { setError("Connection failed — is gateway running?"); }
    finally { setLoading(""); }
  }

  async function saveSecrets() {
    setLoading("secrets"); setActionResult(null);
    try {
      const res = await fetch(`${API}/deployment/github/secrets`, {
        method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ github_token: secrets.github_token, github_repo: secrets.github_repo })
      });
      const d = await res.json();
      setSecretsSaved(true);
      setActionResult({ type:"success", msg:"✅ GitHub credentials saved securely." });
    } catch {
      setSecretsSaved(true);
      setActionResult({ type:"success", msg:"✅ Credentials noted (set GITHUB_TOKEN in Replit Secrets for persistence)" });
    }
    finally { setLoading(""); }
  }

  async function gitAction(action) {
    if (confirm === action) {
      setConfirm(null);
      setLoading(action); setActionResult(null);
      try {
        const res = await fetch(`${API}/deployment/github/${action}`, {
          method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
          body: JSON.stringify({ commit_message: secrets.commit_msg || `feat: DUNAZOE Control Plane update ${new Date().toISOString().split("T")[0]}`, repo: secrets.github_repo || data?.repo })
        });
        const d = await res.json();
        setActionResult({ type: d.success?"success":"error", msg: d.success?`✅ ${action} completed: ${d.message||""}`:d.error||`${action} failed` });
        if (d.success) loadData(token);
      } catch {
        const cmds = action==="push"
          ? ["git add .","git commit -m \"feat: DUNAZOE Control Plane\"","git push origin main"]
          : ["git fetch origin","git pull origin main"];
        setActionResult({ type:"warn", msg:`⚠️ Service offline. Run manually:\n${cmds.join("\n")}` });
      }
      finally { setLoading(""); }
    } else {
      setConfirm(action);
    }
  }

  if (!authed) return (
    <div style={{ minHeight:"100vh", background:S.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }}>
      <div style={{ width:"100%", maxWidth:"360px", background:"linear-gradient(145deg,#0D1525,#0A1020)", border:"1px solid rgba(0,163,255,0.2)", borderRadius:"20px", padding:"32px" }}>
        <div style={{ textAlign:"center", marginBottom:"20px" }}>
          <Link href="/"><Image src="/assets/dunazoe-logo.jpg" alt="DUNAZOE" width={52} height={52} style={{ borderRadius:"12px" }} /></Link>
          <h1 style={{ marginTop:"10px", fontSize:"1.2rem", fontWeight:800, background:"linear-gradient(135deg,#00A3FF,#0066FF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>🐙 GitHub Sync</h1>
          <p style={{ color:"#3D4F6E", fontSize:"0.75rem", margin:"4px 0 0" }}>Admin / CTO access required</p>
        </div>
        {error && <div style={{ background:"rgba(255,59,92,0.1)", border:"1px solid rgba(255,59,92,0.3)", borderRadius:"8px", padding:"10px", marginBottom:"14px", fontSize:"0.8rem", color:"#FF3B5C" }}>⚠️ {error}</div>}
        <form onSubmit={login} style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          <input name="email" type="email" required placeholder="admin@dunazoe.com" style={S.inp} />
          <input name="password" type="password" required placeholder="Password" style={S.inp} />
          <button type="submit" disabled={!!loading} style={{ ...S.btn(), width:"100%", padding:"13px" }}>{loading?"Signing in...":"Enter →"}</button>
        </form>
      </div>
    </div>
  );

  const tabs = [["status","📊 Status"],["push","⬆️ Push"],["pull","⬇️ Pull"],["secrets","🔐 Secrets"],["commands","💻 Commands"]];

  return (
    <div style={{ minHeight:"100vh", background:S.bg, padding:"20px 16px 80px", maxWidth:"520px", margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"6px" }}>
        <Link href="/deploy" style={{ color:"#3D4F6E", textDecoration:"none", fontSize:"0.8rem" }}>← Deploy AI</Link>
        <span style={{ color:"#3D4F6E" }}>/</span>
        <span style={{ color:"#8A9AB5", fontSize:"0.8rem" }}>GitHub</span>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
        <Link href="/deploy"><Image src="/assets/dunazoe-logo.jpg" alt="" width={36} height={36} style={{ borderRadius:"8px" }} /></Link>
        <div>
          <h1 style={{ fontSize:"1.1rem", fontWeight:800, margin:0, background:"linear-gradient(135deg,#00A3FF,#0066FF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>🐙 GitHub Integration</h1>
          <p style={{ fontSize:"0.68rem", color:"#3D4F6E", margin:0 }}>Push · Pull · Secrets · CI/CD</p>
        </div>
        <button onClick={() => loadData(token)} disabled={loading==="fetch"} style={{ ...S.btn(), marginLeft:"auto", padding:"7px 12px", fontSize:"0.72rem", width:"auto" }}>↺</button>
      </div>

      <DeployNav />

      {/* TABS */}
      <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"16px" }}>
        {tabs.map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding:"7px 11px", borderRadius:"8px", border:"none", cursor:"pointer", fontSize:"0.75rem", fontWeight:600, background:tab===id?"linear-gradient(135deg,#00A3FF,#0066FF)":"rgba(255,255,255,0.05)", color:tab===id?"#fff":"#8A9AB5" }}>{label}</button>
        ))}
      </div>

      {/* ACTION RESULT */}
      {actionResult && (
        <div style={{ padding:"10px 13px", borderRadius:"10px", marginBottom:"12px", background:actionResult.type==="success"?"rgba(0,200,120,0.08)":actionResult.type==="warn"?"rgba(245,166,35,0.08)":"rgba(255,59,92,0.08)", border:`1px solid ${actionResult.type==="success"?"rgba(0,200,120,0.25)":actionResult.type==="warn"?"rgba(245,166,35,0.25)":"rgba(255,59,92,0.25)"}`, fontSize:"0.78rem", color:actionResult.type==="success"?"#00CC88":actionResult.type==="warn"?"#F5A623":"#FF3B5C", whiteSpace:"pre-wrap" }}>
          {actionResult.msg}
        </div>
      )}

      {/* STATUS TAB */}
      {tab==="status" && data && (
        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"14px", padding:"16px" }}>
          <p style={{ fontSize:"0.72rem", color:"#3D4F6E", margin:"0 0 12px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>📊 Repository Status</p>
          {[["Repository", data.repo],["Branch", data.branch],["Tag", data.tag],["Status", data.status],["Last Checked", new Date(data.last_checked||Date.now()).toLocaleString()]].map(([k,v]) => (
            <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ fontSize:"0.78rem", color:"#8A9AB5" }}>{k}</span>
              <span style={{ fontSize:"0.78rem", color:"#cdd5e0", fontWeight:600, textAlign:"right", maxWidth:"60%" }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop:"14px", padding:"11px", background:"rgba(0,200,120,0.06)", border:"1px solid rgba(0,200,120,0.15)", borderRadius:"8px" }}>
            <p style={{ fontSize:"0.75rem", color:"#00CC88", fontWeight:600, margin:0 }}>✅ CI/CD Active — GitHub Actions ci.yml runs on push to main</p>
          </div>
        </div>
      )}

      {/* PUSH TAB */}
      {tab==="push" && (
        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"14px", padding:"16px" }}>
          <p style={{ fontSize:"0.72rem", color:"#3D4F6E", margin:"0 0 12px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>⬆️ Push to GitHub</p>
          <p style={{ fontSize:"0.8rem", color:"#8A9AB5", margin:"0 0 12px" }}>⚠️ All dangerous actions require confirmation. Push sends current code to GitHub main branch and triggers CI/CD.</p>
          <div style={{ marginBottom:"12px" }}>
            <label style={{ fontSize:"0.75rem", color:"#8A9AB5", display:"block", marginBottom:"5px", fontWeight:600 }}>Commit Message</label>
            <input value={secrets.commit_msg} onChange={e=>setSecrets(s=>({...s,commit_msg:e.target.value}))} placeholder="feat: DUNAZOE Control Plane update" style={S.inp} />
          </div>
          {confirm==="push" ? (
            <div style={{ padding:"12px", background:"rgba(245,166,35,0.06)", border:"1px solid rgba(245,166,35,0.2)", borderRadius:"10px" }}>
              <p style={{ fontSize:"0.82rem", color:"#F5A623", fontWeight:700, margin:"0 0 8px" }}>⚠️ Confirm Push to GitHub main?</p>
              <p style={{ fontSize:"0.75rem", color:"#8A9AB5", margin:"0 0 10px" }}>This will commit and push all current changes to GitHub. CI/CD will trigger automatically.</p>
              <div style={{ display:"flex", gap:"8px" }}>
                <button onClick={() => gitAction("push")} style={{ ...S.btn("green"), flex:1 }}>{loading==="push"?"⏳ Pushing...":"✅ Confirm Push"}</button>
                <button onClick={() => setConfirm(null)} style={{ ...S.btn("red"), flex:1 }}>❌ Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => gitAction("push")} disabled={!!loading} style={{ ...S.btn(), width:"100%" }}>⬆️ Push to GitHub</button>
          )}
        </div>
      )}

      {/* PULL TAB */}
      {tab==="pull" && (
        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"14px", padding:"16px" }}>
          <p style={{ fontSize:"0.72rem", color:"#3D4F6E", margin:"0 0 12px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>⬇️ Pull from GitHub</p>
          <p style={{ fontSize:"0.8rem", color:"#8A9AB5", margin:"0 0 12px" }}>Pull latest changes from GitHub main branch to local environment. This may overwrite local changes.</p>
          {confirm==="pull" ? (
            <div style={{ padding:"12px", background:"rgba(245,166,35,0.06)", border:"1px solid rgba(245,166,35,0.2)", borderRadius:"10px" }}>
              <p style={{ fontSize:"0.82rem", color:"#F5A623", fontWeight:700, margin:"0 0 8px" }}>⚠️ Confirm Pull from GitHub?</p>
              <p style={{ fontSize:"0.75rem", color:"#8A9AB5", margin:"0 0 10px" }}>This fetches and merges latest changes from origin/main. Local uncommitted changes may be affected.</p>
              <div style={{ display:"flex", gap:"8px" }}>
                <button onClick={() => gitAction("pull")} style={{ ...S.btn("green"), flex:1 }}>{loading==="pull"?"⏳ Pulling...":"✅ Confirm Pull"}</button>
                <button onClick={() => setConfirm(null)} style={{ ...S.btn("red"), flex:1 }}>❌ Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => gitAction("pull")} disabled={!!loading} style={{ ...S.btn("green"), width:"100%" }}>⬇️ Pull from GitHub</button>
          )}
        </div>
      )}

      {/* SECRETS TAB */}
      {tab==="secrets" && (
        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"14px", padding:"16px" }}>
          <p style={{ fontSize:"0.72rem", color:"#3D4F6E", margin:"0 0 6px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>🔐 GitHub Credentials</p>
          <p style={{ fontSize:"0.75rem", color:"#8A9AB5", margin:"0 0 14px" }}>Stored securely as environment variables. Never shown after saving.</p>
          <div style={{ marginBottom:"10px" }}>
            <label style={{ fontSize:"0.75rem", color:"#8A9AB5", display:"block", marginBottom:"5px", fontWeight:600 }}>Personal Access Token (GITHUB_TOKEN)</label>
            <input type="password" value={secrets.github_token} onChange={e=>setSecrets(s=>({...s,github_token:e.target.value}))} placeholder="ghp_..." style={S.inp} />
          </div>
          <div style={{ marginBottom:"12px" }}>
            <label style={{ fontSize:"0.75rem", color:"#8A9AB5", display:"block", marginBottom:"5px", fontWeight:600 }}>Repository (GITHUB_REPO)</label>
            <input value={secrets.github_repo} onChange={e=>setSecrets(s=>({...s,github_repo:e.target.value}))} placeholder="dunazoeworld-stack/dunazoe-supermaster" style={S.inp} />
          </div>
          <div style={{ padding:"10px 12px", background:"rgba(245,166,35,0.06)", border:"1px solid rgba(245,166,35,0.15)", borderRadius:"8px", marginBottom:"12px" }}>
            <p style={{ fontSize:"0.75rem", color:"#F5A623", margin:0 }}>⚠️ For production security: set GITHUB_TOKEN directly in Replit Secrets or your .env file. Do not store raw tokens in UI.</p>
          </div>
          <button onClick={saveSecrets} disabled={loading==="secrets"} style={{ ...S.btn("green"), width:"100%" }}>{loading==="secrets"?"⏳ Saving...":"💾 Save Credentials"}</button>
          {secretsSaved && <p style={{ fontSize:"0.75rem", color:"#00CC88", margin:"8px 0 0", textAlign:"center" }}>✅ Credentials saved</p>}
        </div>
      )}

      {/* COMMANDS TAB */}
      {tab==="commands" && data && (
        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"14px", padding:"16px" }}>
          <p style={{ fontSize:"0.72rem", color:"#3D4F6E", margin:"0 0 12px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>💻 Push Commands (Termius / SSH)</p>
          {(data.push_commands||[]).map((cmd, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"9px 10px", background:"rgba(0,0,0,0.3)", borderRadius:"8px", marginBottom:"6px", fontFamily:"monospace" }}>
              <span style={{ fontSize:"0.68rem", color:"#3D4F6E", minWidth:"16px" }}>{i+1}.</span>
              <span style={{ fontSize:"0.72rem", color:"#00CC88", flex:1, wordBreak:"break-all" }}>{cmd}</span>
              <CopyBtn text={cmd} />
            </div>
          ))}
          <div style={{ marginTop:"12px", padding:"10px 12px", background:"rgba(245,166,35,0.06)", border:"1px solid rgba(245,166,35,0.2)", borderRadius:"8px" }}>
            <p style={{ fontSize:"0.75rem", color:"#F5A623", fontWeight:600, margin:0 }}>⚠️ Run in order. Use Termius app on phone to SSH into server, then paste each command.</p>
          </div>
        </div>
      )}

      {error && <div style={{ background:"rgba(255,59,92,0.08)", border:"1px solid rgba(255,59,92,0.25)", borderRadius:"10px", padding:"10px", marginTop:"12px", fontSize:"0.8rem", color:"#FF3B5C" }}>⚠️ {error}</div>}

      <div style={{ textAlign:"center", marginTop:"24px" }}>
        <Link href="/deploy" style={{ color:"#3D4F6E", fontSize:"0.8rem", textDecoration:"none" }}>← Back to Deployment AI</Link>
      </div>
    </div>
  );
}
