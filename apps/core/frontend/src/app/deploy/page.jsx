"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "../../components/ThemeProvider";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const SCORE_THRESHOLDS = { security: 90, reliability: 90, scalability: 85, performance: 85, readiness: 90 };

function ScoreBar({ label, score, threshold }) {
  const pct = Math.min(100, score || 0);
  const pass = score >= threshold;
  const color = score >= threshold ? "#FF6B00" : score >= threshold - 10 ? "#F5A623" : "#FF3B5C";
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
        <span style={{ fontSize: "0.82rem", color: "#8A9AB5", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: "0.82rem", fontWeight: 800, color }}>{score ?? "—"}/100 {pass ? "✅" : "❌"}</span>
      </div>
      <div style={{ height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "99px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "99px", transition: "width 0.8s ease" }} />
      </div>
    </div>
  );
}

function StepCard({ num, text }) {
  const [done, setDone] = useState(false);
  return (
    <div onClick={() => setDone(d => !d)} style={{ display: "flex", gap: "12px", padding: "12px 14px", background: done ? "rgba(255,107,0,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${done ? "rgba(255,107,0,0.3)" : "rgba(255,255,255,0.07)"}`, borderRadius: "10px", cursor: "pointer", marginBottom: "8px", transition: "all 0.2s" }}>
      <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: done ? "linear-gradient(135deg,#FF6B00,#FF4500)" : "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.72rem", fontWeight: 800, color: done ? "#fff" : "#3D4F6E" }}>{done ? "✓" : num}</div>
      <span style={{ fontSize: "0.85rem", color: done ? "#8A9AB5" : "#cdd5e0", lineHeight: 1.5, textDecoration: done ? "line-through" : "none" }}>{text}</span>
    </div>
  );
}

export default function DeployPage() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deployLoading, setDeployLoading] = useState(false);
  const [deployResult, setDeployResult] = useState(null);
  const [error, setError] = useState("");
  const [env, setEnv] = useState("production");
  const [provider, setProvider] = useState("contabo");
  const [version] = useState("1.0.0-rc1");
  const logRef = useRef(null);
  const [activeCenter, setActiveCenter] = useState(null); // null | "fix" | "payment" | "ai" | "delivery"
  const [payHealth, setPayHealth]   = useState(null);
  const [centerLoading, setCenterLoading] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("dunazoe_token");
    if (t) { setToken(t); setAuthed(true); loadStatus(t); }
  }, []);

  async function loadStatus(t) {
    try {
      const res = await fetch(`${API}/deployment/status`, { headers: { Authorization: `Bearer ${t}` } });
      const d = await res.json();
      if (d.success) setStatusData(d);
    } catch (_) {}
  }

  async function loadPaymentHealth() {
    setCenterLoading(true);
    try {
      const res = await fetch(`${API}/payments/health`);
      const d   = await res.json();
      setPayHealth(d);
    } catch (_) { setPayHealth({ error: "Health endpoint unreachable" }); }
    finally { setCenterLoading(false); }
  }

  function openCenter(name) {
    setActiveCenter(prev => prev === name ? null : name);
    if (name === "payment") loadPaymentHealth();
  }

  async function handleLogin(e) {
    e.preventDefault(); setError(""); setLoading(true);
    const form = new FormData(e.target);
    try {
      const res = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      const d = await res.json();
      if (!d.success) { setError(d.error || "Login failed"); return; }
      if (!["admin", "super_admin", "cto"].includes(d.role)) { setError("Admin access required for deployments."); return; }
      localStorage.setItem("dunazoe_token", d.token);
      setToken(d.token); setAuthed(true);
      loadStatus(d.token);
    } catch (_) { setError("Connection failed."); }
    finally { setLoading(false); }
  }

  async function runAudit() {
    setError(""); setLoading(true); setAuditResult(null); setDeployResult(null);
    try {
      const res = await fetch(`${API}/deployment/audit`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ version, environment: env, hosting_provider: provider }) });
      const d = await res.json();
      if (!d.success) { setError(d.error || "Audit failed"); return; }
      setAuditResult(d);
      loadStatus(token);
    } catch (_) { setError("Audit request failed. Is the deployment service running?"); }
    finally { setLoading(false); }
  }

  async function runDeploy() {
    if (!auditResult?.approved) return;
    setError(""); setDeployLoading(true);
    try {
      const res = await fetch(`${API}/deployment/deploy`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ version, environment: env, hosting_provider: provider }) });
      const d = await res.json();
      setDeployResult(d);
      if (!d.success) setError(d.error || "Deploy call failed");
      else loadStatus(token);
    } catch (_) { setError("Deploy request failed."); }
    finally { setDeployLoading(false); }
  }

  const approved = auditResult?.approved;
  const scores = auditResult?.scores || {};
  const inp = { width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,107,0,0.2)", borderRadius: "10px", color: "#fff", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" };
  const sel = { ...inp, cursor: "pointer" };

  if (!authed) return (
    <div style={{ minHeight: "100vh", background: "#0A0E1A", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: "380px", background: "linear-gradient(145deg,#0D1525,#0A1020)", border: "1px solid rgba(255,107,0,0.2)", borderRadius: "24px", padding: "36px", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <Link href="/"><Image src="/assets/dunazoe-logo.jpg" alt="DUNAZOE" width={60} height={60} style={{ borderRadius: "14px", boxShadow: "0 0 24px rgba(255,107,0,0.4)" }} /></Link>
          <h1 style={{ marginTop: "12px", fontSize: "1.4rem", fontWeight: 800, background: "linear-gradient(135deg,#FF6B00,#FF4500)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>🚀 Deployment AI</h1>
          <p style={{ color: "#8A9AB5", fontSize: "0.82rem", marginTop: "4px" }}>Admin / CTO access required</p>
        </div>
        {error && <div style={{ background: "rgba(255,59,92,0.1)", border: "1px solid rgba(255,59,92,0.3)", borderRadius: "10px", padding: "10px 12px", marginBottom: "16px", fontSize: "0.83rem", color: "#FF3B5C" }}>⚠️ {error}</div>}
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div><label style={{ fontSize: "0.78rem", color: "#8A9AB5", display: "block", marginBottom: "5px" }}>Admin Email</label><input name="email" type="email" autoComplete="email" required placeholder="admin@dunazoe.com" style={inp} /></div>
          <div><label style={{ fontSize: "0.78rem", color: "#8A9AB5", display: "block", marginBottom: "5px" }}>Password</label><input name="password" type="password" autoComplete="current-password" required placeholder="••••••••" style={inp} /></div>
          <button type="submit" disabled={loading} style={{ padding: "13px", borderRadius: "12px", background: "linear-gradient(135deg,#FF6B00,#FF4500)", border: "none", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: "0.95rem" }}>{loading ? "Signing in..." : "Enter Deployment AI →"}</button>
        </form>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0A0E1A", padding: "20px 16px 80px", maxWidth: "520px", margin: "0 auto" }}>
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <Link href="/"><Image src="/assets/dunazoe-logo.jpg" alt="" width={40} height={40} style={{ borderRadius: "10px" }} /></Link>
        <div>
          <h1 style={{ fontSize: "1.1rem", fontWeight: 800, background: "linear-gradient(135deg,#FF6B00,#FF4500)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", margin: 0 }}>🚀 Deployment AI</h1>
          <p style={{ fontSize: "0.72rem", color: "#3D4F6E", margin: 0 }}>v{version} — One-tap deploy from phone</p>
        </div>
        <div style={{ marginLeft: "auto", fontSize: "0.7rem", color: "#FF6B00", background: "rgba(255,107,0,0.08)", padding: "4px 10px", borderRadius: "20px", border: "1px solid rgba(255,107,0,0.2)" }}>🟠 ADMIN</div>
      </div>

      {/* LAST DEPLOY STATUS */}
      {statusData?.recent_deployments?.length > 0 && (
        <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,107,0,0.1)", borderRadius: "14px", padding: "14px 16px", marginBottom: "20px" }}>
          <p style={{ fontSize: "0.72rem", color: "#3D4F6E", margin: "0 0 8px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Last Deployment</p>
          {statusData.recent_deployments.slice(0, 1).map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "1.4rem" }}>{r.color_code.startsWith("GREEN") ? "✅" : "🔴"}</span>
              <div>
                <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: r.color_code.startsWith("GREEN") ? "#FF6B00" : "#FF3B5C" }}>{r.status} — {r.environment}</p>
                <p style={{ margin: 0, fontSize: "0.72rem", color: "#3D4F6E" }}>v{r.version} · {new Date(r.deployed_at).toLocaleDateString("en-NG")}</p>
              </div>
              <div style={{ marginLeft: "auto", fontSize: "1.3rem", fontWeight: 800, color: r.scores?.readiness >= 90 ? "#FF6B00" : "#F5A623" }}>{r.scores?.readiness ?? "—"}<span style={{ fontSize: "0.65rem", color: "#3D4F6E" }}>/100</span></div>
            </div>
          ))}
        </div>
      )}

      {/* DEPLOY CONFIG */}
      <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,107,0,0.1)", borderRadius: "14px", padding: "16px", marginBottom: "16px" }}>
        <p style={{ fontSize: "0.72rem", color: "#3D4F6E", margin: "0 0 12px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Deploy Config</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div><label style={{ fontSize: "0.75rem", color: "#8A9AB5", display: "block", marginBottom: "5px" }}>Environment</label>
            <select value={env} onChange={e => setEnv(e.target.value)} style={sel}>
              <option value="production">Production</option>
              <option value="staging">Staging</option>
            </select></div>
          <div><label style={{ fontSize: "0.75rem", color: "#8A9AB5", display: "block", marginBottom: "5px" }}>Host Provider</label>
            <select value={provider} onChange={e => setProvider(e.target.value)} style={sel}>
              <option value="contabo">Contabo VPS</option>
              <option value="replit">Replit</option>
              <option value="aws">AWS</option>
              <option value="digitalocean">DigitalOcean</option>
            </select></div>
        </div>
      </div>

      {/* ERROR */}
      {error && <div style={{ background: "rgba(255,59,92,0.1)", border: "1px solid rgba(255,59,92,0.3)", borderRadius: "10px", padding: "12px", marginBottom: "16px", fontSize: "0.83rem", color: "#FF3B5C" }}>⚠️ {error}</div>}

      {/* AUDIT BUTTON */}
      <button onClick={runAudit} disabled={loading} style={{ width: "100%", padding: "16px", borderRadius: "14px", background: loading ? "rgba(255,107,0,0.3)" : "linear-gradient(135deg,#FF6B00,#FF4500)", border: "none", color: "#fff", fontWeight: 800, fontSize: "1.05rem", cursor: loading ? "not-allowed" : "pointer", marginBottom: "12px", boxShadow: loading ? "none" : "0 0 24px rgba(255,107,0,0.35)", letterSpacing: "0.02em" }}>
        {loading ? "⏳ Running Audit..." : "🔍 Run Deployment Audit"}
      </button>

      {/* AUDIT RESULTS */}
      {auditResult && (
        <div style={{ background: "rgba(13,21,37,0.95)", border: `1px solid ${approved ? "rgba(255,107,0,0.35)" : "rgba(255,59,92,0.35)"}`, borderRadius: "14px", padding: "18px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
            <span style={{ fontSize: "2.2rem" }}>{approved ? "✅" : "🔴"}</span>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: "1rem", color: approved ? "#FF6B00" : "#FF3B5C" }}>{auditResult.ceo_summary?.headline}</p>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "#8A9AB5", marginTop: "2px" }}>{auditResult.ceo_summary?.explanation?.substring(0, 100)}…</p>
            </div>
          </div>
          <ScoreBar label="Security" score={scores.security} threshold={SCORE_THRESHOLDS.security} />
          <ScoreBar label="Reliability" score={scores.reliability} threshold={SCORE_THRESHOLDS.reliability} />
          <ScoreBar label="Scalability" score={scores.scalability} threshold={SCORE_THRESHOLDS.scalability} />
          <ScoreBar label="Performance" score={scores.performance} threshold={SCORE_THRESHOLDS.performance} />
          <ScoreBar label="Readiness" score={scores.readiness} threshold={SCORE_THRESHOLDS.readiness} />
          {!approved && auditResult.blocked_reasons?.length > 0 && (
            <div style={{ marginTop: "14px", padding: "12px", background: "rgba(255,59,92,0.06)", borderRadius: "10px", border: "1px solid rgba(255,59,92,0.2)" }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#FF3B5C", margin: "0 0 6px" }}>BLOCKED REASONS</p>
              {auditResult.blocked_reasons.map((r, i) => <p key={i} style={{ fontSize: "0.78rem", color: "#FF3B5C", margin: "2px 0" }}>• {r}</p>)}
            </div>
          )}
        </div>
      )}

      {/* DEPLOY BUTTON */}
      <button onClick={runDeploy} disabled={!approved || deployLoading} style={{ width: "100%", padding: "18px", borderRadius: "14px", background: !approved ? "rgba(255,255,255,0.05)" : deployLoading ? "rgba(0,200,120,0.3)" : "linear-gradient(135deg,#00CC88,#00A36B)", border: !approved ? "1px solid rgba(255,255,255,0.08)" : "none", color: !approved ? "#3D4F6E" : "#fff", fontWeight: 800, fontSize: "1.1rem", cursor: !approved ? "not-allowed" : "pointer", marginBottom: "16px", boxShadow: approved ? "0 0 28px rgba(0,200,120,0.35)" : "none", letterSpacing: "0.02em", transition: "all 0.3s" }}>
        {deployLoading ? "⏳ Deploying..." : approved ? "🚀 DEPLOY TO PRODUCTION" : "🔒 Audit Must Pass First"}
      </button>

      {/* DEPLOY RESULT — STEP GUIDE */}
      {deployResult?.success && deployResult.steps && (
        <div style={{ background: "rgba(0,200,120,0.04)", border: "1px solid rgba(0,200,120,0.2)", borderRadius: "14px", padding: "18px", marginBottom: "16px" }}>
          <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#00CC88", margin: "0 0 14px", letterSpacing: "0.06em", textTransform: "uppercase" }}>🚀 Deployment Steps — Tap each to mark done</p>
          {deployResult.steps.map((step, i) => <StepCard key={i} num={i + 1} text={step} />)}
          <div style={{ marginTop: "14px", padding: "10px 12px", background: "rgba(0,200,120,0.08)", borderRadius: "8px" }}>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#00CC88", fontWeight: 600 }}>⏱ 72-hour monitoring has started. Check <code style={{ background: "rgba(0,200,120,0.15)", padding: "1px 5px", borderRadius: "4px" }}>GET /deployment/monitor</code></p>
          </div>
        </div>
      )}

      {/* PHONE GUIDE */}
      <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,107,0,0.08)", borderRadius: "14px", padding: "16px", marginBottom: "16px" }}>
        <p style={{ fontSize: "0.72rem", color: "#3D4F6E", margin: "0 0 12px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>📱 Phone Deploy Guide (Contabo)</p>
        {[
          "Open Termius app → connect your Contabo VPS (IP + root password)",
          "Run: apt update -y && apt install docker.io docker-compose git -y",
          "Run: git clone https://github.com/dunazoeworld-stack/dunazoe-supermaster",
          "Run: cd dunazoe-supermaster && cp apps/core/.env.example apps/core/.env.docker",
          "Edit .env.docker — fill in DATABASE_URL, JWT_SECRET and all secrets",
          "Run: cd apps/core && docker-compose up --build -d",
          "Verify: docker-compose ps (all containers show 'Up')",
          "Test: curl http://localhost:3000/health → should return {status:'ok'}",
          "Open Namecheap → Advanced DNS → A Record @ → Contabo IP",
          "Run Certbot: certbot --nginx -d dunazoe.com -d www.dunazoe.com",
          "Open dunazoe.com in browser — you are LIVE ✅"
        ].map((step, i) => <StepCard key={i} num={i + 1} text={step} />)}
      </div>

      {/* ── OPERATIONS CENTERS ─────────────────────────────────────── */}
      <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,107,0,0.1)", borderRadius: "14px", padding: "14px 16px", marginBottom: "16px" }}>
        <p style={{ fontSize: "0.72rem", color: "#3D4F6E", margin: "0 0 10px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>⚙️ Operations Centers</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: activeCenter ? "12px" : 0 }}>
          {[
            { id: "fix",      icon: "🔧", label: "Fix Center",     desc: "Known issues + 1-click fixes" },
            { id: "payment",  icon: "💳", label: "Payment Center", desc: "Gateway & webhook status" },
            { id: "ai",       icon: "🤖", label: "AI Center",      desc: "Product AI & vision status" },
            { id: "delivery", icon: "🚚", label: "Delivery Center",desc: "Self + courier + intl status" },
          ].map(c => (
            <button key={c.id} onClick={() => openCenter(c.id)} style={{
              padding: "10px 8px", borderRadius: "10px", cursor: "pointer",
              background: activeCenter === c.id ? "rgba(255,107,0,0.1)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${activeCenter === c.id ? "rgba(255,107,0,0.4)" : "rgba(255,255,255,0.07)"}`,
              color: activeCenter === c.id ? "#FF6B00" : "#8A9AB5",
              textAlign: "left", transition: "all 0.2s",
            }}>
              <div style={{ fontSize: "1.2rem", marginBottom: "2px" }}>{c.icon}</div>
              <div style={{ fontSize: "0.78rem", fontWeight: 700 }}>{c.label}</div>
              <div style={{ fontSize: "0.68rem", color: activeCenter === c.id ? "#FF6B00" : "#3D4F6E", marginTop: "1px" }}>{c.desc}</div>
            </button>
          ))}
        </div>

        {/* ── Fix Center Panel ── */}
        {activeCenter === "fix" && (
          <div style={{ borderTop: "1px solid rgba(255,107,0,0.15)", paddingTop: "12px" }}>
            {[
              { icon: "🔧", prob: "Vendor edit/delete returns 403/500", cause: "PUT handler now added to /api/products/[id]", solution: "Deploy latest code", fixed: true },
              { icon: "💡", prob: "Theme doesn't switch in light mode", cause: "Missing data-theme CSS selectors", solution: "ThemeProvider + [data-theme] CSS added", fixed: true },
              { icon: "🆔", prob: "ORD-ORD double prefix on orders", cause: "ID already had ORD- prefix before padding", solution: "Strip prefix before padding — fixed in orders/page.jsx", fixed: true },
              { icon: "💱", prob: "Stripe charges wrong amount (NGN as USD)", cause: "No NGN→USD conversion before Stripe call", solution: "Live exchange rate conversion added", fixed: true },
              { icon: "🖼️", prob: "OG image not showing when shared", cause: "type: 'og:type' typo in layout.jsx", solution: "Fixed to type: 'website' + API_BASE URL fixed", fixed: true },
              { icon: "📱", prob: "Cart buttons misaligned on mobile", cause: "Inline grid with minWidth: 240px on summary", solution: "cart-layout CSS class stacks on ≤640px", fixed: true },
            ].map((item, i) => (
              <div key={i} style={{ padding: "10px 12px", background: item.fixed ? "rgba(0,200,120,0.04)" : "rgba(255,59,92,0.04)", borderRadius: "8px", border: `1px solid ${item.fixed ? "rgba(0,200,120,0.2)" : "rgba(255,59,92,0.2)"}`, marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <span>{item.icon}</span>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#cdd5e0" }}>{item.prob}</span>
                  <span style={{ marginLeft: "auto", fontSize: "0.68rem", padding: "2px 7px", borderRadius: "6px", background: item.fixed ? "rgba(0,200,120,0.15)" : "rgba(255,59,92,0.15)", color: item.fixed ? "#00CC88" : "#FF3B5C", fontWeight: 700 }}>{item.fixed ? "✅ Fixed" : "⚠️ Open"}</span>
                </div>
                <p style={{ fontSize: "0.72rem", color: "#3D4F6E", margin: "0 0 2px" }}>Cause: {item.cause}</p>
                <p style={{ fontSize: "0.72rem", color: "#8A9AB5", margin: 0 }}>Fix: {item.solution}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Payment Center Panel ── */}
        {activeCenter === "payment" && (
          <div style={{ borderTop: "1px solid rgba(255,107,0,0.15)", paddingTop: "12px" }}>
            {centerLoading && <p style={{ color: "#8A9AB5", fontSize: "0.82rem" }}>⏳ Checking payment health…</p>}
            {payHealth && !centerLoading && (
              <>
                {[
                  { label: "Paystack", value: payHealth.paystack, ok: payHealth.paystack === "configured" },
                  { label: "Stripe",   value: payHealth.stripe,   ok: payHealth.stripe === "configured" },
                  { label: "Wallet Ledger", value: payHealth.wallet_ledger, ok: payHealth.wallet_ledger === "valid" },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: "0.82rem", color: "#8A9AB5" }}>{row.label}</span>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: row.ok ? "#00CC88" : "#FF3B5C" }}>{row.ok ? "🟢 " : "🔴 "}{row.value}</span>
                  </div>
                ))}
                <p style={{ fontSize: "0.72rem", color: "#3D4F6E", marginTop: "8px" }}>Webhook URL: <code style={{ color: "#FF6B00" }}>/api/payments/webhook</code></p>
                <p style={{ fontSize: "0.72rem", color: "#3D4F6E" }}>Verify URL: <code style={{ color: "#FF6B00" }}>/api/payments/verify</code></p>
                <p style={{ fontSize: "0.72rem", color: "#3D4F6E" }}>NGN→USD: <span style={{ color: "#00CC88" }}>🟢 Live via open.er-api.com</span></p>
              </>
            )}
          </div>
        )}

        {/* ── AI Center Panel ── */}
        {activeCenter === "ai" && (
          <div style={{ borderTop: "1px solid rgba(255,107,0,0.15)", paddingTop: "12px" }}>
            {[
              { label: "Product Vision AI", status: "OpenAI / xAI / Gemini → heuristic fallback", ok: true },
              { label: "Vision Endpoint",   status: "/api/ai/product-vision (POST, image_url)", ok: true },
              { label: "Listing Assistant", status: "/api/products/ai/assist (text-based)", ok: true },
              { label: "Marketing AI",      status: "/vendor/marketing page", ok: true },
              { label: "Logistics AI",      status: "/api/logistics/quote — all 36 NG states", ok: true },
              { label: "OpenAI Key",  status: process?.env?.OPENAI_API_KEY ? "Set ✅" : "Not set — heuristic fallback active", ok: false },
              { label: "xAI Key",     status: "Configure XAI_API_KEY in Deployment AI", ok: false },
              { label: "Gemini Key",  status: "Configure GEMINI_API_KEY in Deployment AI", ok: false },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", gap: "8px" }}>
                <span style={{ fontSize: "0.78rem", color: "#8A9AB5", flexShrink: 0 }}>{row.label}</span>
                <span style={{ fontSize: "0.75rem", color: row.ok ? "#00CC88" : "#F5A623", textAlign: "right" }}>{row.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Delivery Center Panel ── */}
        {activeCenter === "delivery" && (
          <div style={{ borderTop: "1px solid rgba(255,107,0,0.15)", paddingTop: "12px" }}>
            {[
              { label: "Self Delivery",      status: "🟢 Active — vendor sets zones in product listing", ok: true },
              { label: "DUNAZOE Express",    status: "🟢 /express/quote endpoint active", ok: true },
              { label: "Shipbubble",         status: "🟡 Configured (no API key = quote only)", ok: true },
              { label: "GIG Logistics",      status: "🟡 Configured (quote only)", ok: true },
              { label: "DHL International",  status: "🟡 Quote engine active — no live API key", ok: true },
              { label: "FedEx/UPS",          status: "🟡 Quote engine active — no live API key", ok: true },
              { label: "Checkout Detection", status: "🟢 Self-delivery message shown at checkout", ok: true },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", gap: "8px" }}>
                <span style={{ fontSize: "0.78rem", color: "#8A9AB5" }}>{row.label}</span>
                <span style={{ fontSize: "0.75rem", color: row.ok ? "#00CC88" : "#F5A623", textAlign: "right" }}>{row.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CONTROL PLANE NAV */}
      <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,107,0,0.08)", borderRadius: "14px", padding: "14px 16px", marginBottom: "16px" }}>
        <p style={{ fontSize: "0.72rem", color: "#3D4F6E", margin: "0 0 10px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>🎛️ Control Plane</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
          {[
            ["/deploy/studio","🏗️","Studio"],
            ["/deploy/assistant","🤖","Assistant"],
            ["/deploy/apis","🔌","APIs"],
            ["/deploy/scaling","📈","Scaling"],
            ["/deploy/portability","📦","Portability"],
            ["/deploy/features","⚙️","Features"],
            ["/deploy/self","🔧","Self Mgmt"],
            ["/deploy/github","🐙","GitHub"],
            ["/deploy/monitor","📡","Monitor"],
          ].map(([href, icon, label]) => (
            <Link key={href} href={href} style={{ padding: "9px 6px", borderRadius: "9px", background: "rgba(255,107,0,0.04)", border: "1px solid rgba(255,107,0,0.1)", color: "#8A9AB5", textDecoration: "none", fontSize: "0.72rem", fontWeight: 600, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
              <span style={{ fontSize: "1rem" }}>{icon}</span>
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* BACK LINK */}
      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <Link href="/" style={{ color: "#3D4F6E", fontSize: "0.82rem", textDecoration: "none", marginRight: "16px" }}>← Back to DUNAZOE</Link>
        <Link href="/ops" style={{ color: "#FF6B00", fontSize: "0.82rem", textDecoration: "none" }}>🛸 Operator Cockpit →</Link>
      </div>
    </div>
  );
}
