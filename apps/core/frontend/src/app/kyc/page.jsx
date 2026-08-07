"use client";
/**
 * DUNAZOE — KYC / Identity Verification Centre
 * Route: /kyc
 * - Shows current KYC level + withdrawal limits
 * - BVN/NIN identity verification (Level 1)
 * - ID document submission (Level 2 — manual review)
 * - Bank account management for withdrawals
 */
import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const NG_BANKS = [
  "Access Bank","Zenith Bank","GTBank","First Bank","UBA","Fidelity Bank",
  "Polaris Bank","Sterling Bank","Union Bank","Wema Bank","Keystone Bank",
  "Unity Bank","Heritage Bank","Jaiz Bank","Providus Bank","Titan Trust Bank",
  "Opay","Moniepoint","PalmPay","Kuda Bank","VFD Microfinance Bank","Carbon",
  "Rubies Bank","Coronation Merchant Bank","Stanbic IBTC","Standard Chartered",
  "Citibank Nigeria","Rand Merchant Bank","Nova Merchant Bank","Ecobank",
];

const LEVELS = [
  { level: 0, name: "Unverified",  color: "#FF3B5C", bg: "rgba(255,59,92,0.1)",    limits: "Wallet only — no deposits/withdrawals" },
  { level: 1, name: "Identity ✓", color: "#F59E0B", bg: "rgba(245,158,11,0.1)",   limits: "₦200,000 wallet & withdrawal limit" },
  { level: 2, name: "ID Verified", color: "#00A3FF", bg: "rgba(0,163,255,0.1)",   limits: "₦5,000,000 wallet & withdrawal limit" },
  { level: 3, name: "Full KYC",    color: "#00C896", bg: "rgba(0,200,150,0.1)",   limits: "Unlimited — international transfers enabled" },
];

function KYCContent() {
  const searchParams = useSearchParams();

  const [kyc,          setKyc]          = useState(null);
  const [accounts,     setAccounts]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  // Honour ?tab=bank (or any valid tab) from URL — e.g. linked from wallet page
  const [tab,          setTab]          = useState(() => {
    const t = searchParams?.get("tab");
    return (t === "bank" || t === "identity" || t === "status") ? t : "status";
  });

  // BVN/NIN form
  const [bvn,          setBvn]          = useState("");
  const [nin,          setNin]          = useState("");
  const [bvnLoading,   setBvnLoading]   = useState(false);
  const [bvnMsg,       setBvnMsg]       = useState({ type: "", text: "" });

  // Bank account form
  const [bankForm,     setBankForm]     = useState({ bank_name: "", account_number: "", account_name: "" });
  const [bankLoading,  setBankLoading]  = useState(false);
  const [bankMsg,      setBankMsg]      = useState({ type: "", text: "" });

  // ID submission
  const [idType,       setIdType]       = useState("national_id");
  const [idUrl,        setIdUrl]        = useState("");
  const [selfieUrl,    setSelfieUrl]    = useState("");
  const [idLoading,    setIdLoading]    = useState(false);
  const [idMsg,        setIdMsg]        = useState({ type: "", text: "" });

  const [kycUnavailable, setKycUnavailable] = useState(false);
  const [userRole,       setUserRole]       = useState("user");

  const token = typeof window !== "undefined" ? localStorage.getItem("dunazoe_token") || "" : "";

  useEffect(() => {
    // Determine role for tab defaults
    try {
      const u = JSON.parse(localStorage.getItem("dunazoe_user") || "{}");
      const r = u.role || "user";
      setUserRole(r);
      // Vendors start on identity tab; regular users start on bank tab
      const isVendor = ["vendor","direct_vendor","delivery_vendor"].includes(r);
      setTab(prev => {
        const urlTab = typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("tab") : null;
        if (urlTab && ["status","identity","bank"].includes(urlTab)) return urlTab;
        return isVendor ? "identity" : "bank";
      });
    } catch (_) {}

    if (!token) { setLoading(false); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    Promise.allSettled([
      fetch(`${API}/kyc/status`,        { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal }).then(r => r.json()),
      fetch(`${API}/kyc/bank-accounts`, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal }).then(r => r.json()),
    ]).then(([kycR, bankR]) => {
      clearTimeout(timer);
      if (kycR.status === "fulfilled" && kycR.value?.success !== false && !kycR.value?.error?.includes("unavailable")) {
        setKyc(kycR.value);
      } else if (kycR.status === "rejected" || kycR.value?.error?.includes("unavailable")) {
        setKycUnavailable(true);
      }
      if (bankR.status === "fulfilled" && bankR.value?.accounts) setAccounts(bankR.value.accounts);
    }).catch(() => {
      clearTimeout(timer);
      setKycUnavailable(true);
    }).finally(() => setLoading(false));

    return () => { ctrl.abort(); clearTimeout(timer); };
  }, [token]);

  async function submitBVN(e) {
    e.preventDefault();
    if (!bvn && !nin) { setBvnMsg({ type: "error", text: "Enter your BVN or NIN." }); return; }
    if (bvn && !/^\d{11}$/.test(bvn)) { setBvnMsg({ type: "error", text: "BVN must be exactly 11 digits." }); return; }
    if (nin && !/^\d{11}$/.test(nin)) { setBvnMsg({ type: "error", text: "NIN must be exactly 11 digits." }); return; }
    setBvnLoading(true); setBvnMsg({ type: "", text: "" });
    try {
      const res = await fetch(`${API}/kyc/verify-bvn`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bvn: bvn || undefined, nin: nin || undefined }),
      });
      const d = await res.json();
      if (d.success) {
        setBvnMsg({ type: "success", text: d.message || "Identity verified! Level 1 unlocked." });
        setKyc(prev => ({ ...prev, kyc_level: 1, status: "verified" }));
        setBvn(""); setNin("");
      } else {
        setBvnMsg({ type: "error", text: d.error || "Verification failed. Please try again." });
      }
    } catch (_) { setBvnMsg({ type: "error", text: "Connection error. Please try again." }); }
    finally { setBvnLoading(false); }
  }

  async function submitID(e) {
    e.preventDefault();
    if (!idUrl || !selfieUrl) { setIdMsg({ type: "error", text: "Both document URL and selfie URL are required." }); return; }
    setIdLoading(true); setIdMsg({ type: "", text: "" });
    try {
      const res = await fetch(`${API}/kyc/submit-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gov_id_type: idType, gov_id_url: idUrl, selfie_url: selfieUrl }),
      });
      const d = await res.json();
      if (d.success) {
        setIdMsg({ type: "success", text: d.message || "Submitted for review. Typically 24–48 hours." });
        setKyc(prev => ({ ...prev, status: "submitted" }));
      } else {
        setIdMsg({ type: "error", text: d.error || "Submission failed." });
      }
    } catch (_) { setIdMsg({ type: "error", text: "Connection error. Please try again." }); }
    finally { setIdLoading(false); }
  }

  async function addBankAccount(e) {
    e.preventDefault();
    const { bank_name, account_number, account_name } = bankForm;
    if (!bank_name || !account_number || !account_name) {
      setBankMsg({ type: "error", text: "All fields are required." }); return;
    }
    if (!/^\d{10}$/.test(account_number)) {
      setBankMsg({ type: "error", text: "Account number must be exactly 10 digits." }); return;
    }
    setBankLoading(true); setBankMsg({ type: "", text: "" });
    try {
      const res = await fetch(`${API}/kyc/bank-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bank_name, account_number, account_name }),
      });
      const d = await res.json();
      if (d.success) {
        setBankMsg({ type: "success", text: d.message || "Bank account added. 48-hour cooling-off period applies." });
        setAccounts(prev => [...prev, d.bank_account]);
        setBankForm({ bank_name: "", account_number: "", account_name: "" });
      } else {
        setBankMsg({ type: "error", text: d.error || "Failed to add account." });
      }
    } catch (_) { setBankMsg({ type: "error", text: "Connection error. Please try again." }); }
    finally { setBankLoading(false); }
  }

  const currentLevel = kyc?.kyc_level ?? 0;
  const levelInfo    = LEVELS[currentLevel] || LEVELS[0];

  const isVendor = ["vendor","direct_vendor","delivery_vendor"].includes(userRole);
  // Vendors see all 3 tabs (full KYC). Regular users see identity + bank only (no status dashboard needed).
  const TABS = isVendor
    ? [
        { id: "status",   icon: "📋", label: "KYC Status" },
        { id: "identity", icon: "🪪", label: "Verify Identity" },
        { id: "bank",     icon: "🏦", label: "Bank Account" },
      ]
    : [
        { id: "bank",     icon: "🏦", label: "Bank Account" },
        { id: "identity", icon: "🪪", label: "Identity Verification" },
      ];

  return (
    <PageShell title="KYC Verification" icon="🛡️" authRequired={true}
      subtitle="Verify your identity to unlock withdrawal limits"
      breadcrumb={[{ href: "/wallet", label: "Wallet" }, { label: "KYC Verification" }]}>

      {/* Tab navigation */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 16px", borderRadius: "10px", border: "none", cursor: "pointer",
            fontWeight: 600, fontSize: "0.85rem",
            background: tab === t.id ? "var(--dz-gradient)" : "var(--surface)",
            color: tab === t.id ? "#fff" : "var(--text-secondary)",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {kycUnavailable && (
        <div className="alert alert-warning" style={{ marginBottom: "16px" }}>
          ⚠️ <strong>KYC service is temporarily unavailable.</strong> Identity verification is paused.
          You can still add or view your bank accounts below.
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}><div className="dz-spinner" /></div>
      ) : (

        /* ── KYC STATUS TAB ─────────────────────────── */
        tab === "status" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Level Badge */}
            <div className="card" style={{ border: `1.5px solid ${levelInfo.color}40`, background: levelInfo.bg }}>
              <div className="card-body">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>Current KYC Level</p>
                    <p style={{ fontSize: "1.8rem", fontWeight: 900, color: levelInfo.color }}>Level {currentLevel}</p>
                    <p style={{ fontSize: "0.88rem", fontWeight: 700, color: levelInfo.color }}>{levelInfo.name}</p>
                  </div>
                  <div style={{ fontSize: "3rem" }}>
                    {currentLevel === 0 ? "❌" : currentLevel === 1 ? "⚡" : currentLevel === 2 ? "🔵" : "✅"}
                  </div>
                </div>
                <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "8px" }}>
                  📊 {levelInfo.limits}
                </p>
                {kyc?.status === "submitted" && (
                  <p style={{ fontSize: "0.78rem", color: "var(--warning)", marginTop: "6px" }}>
                    ⏳ ID documents under review — typically 24–48 hours.
                  </p>
                )}
                {kyc?.expires_at && (
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                    📅 KYC valid until: {new Date(kyc.expires_at).toLocaleDateString("en-NG")}
                  </p>
                )}
              </div>
            </div>

            {/* Level progression */}
            <div className="card"><div className="card-body">
              <p style={{ fontWeight: 700, marginBottom: "14px" }}>🪜 KYC Level Progression</p>
              {LEVELS.map((l, i) => (
                <div key={i} style={{
                  display: "flex", gap: "12px", alignItems: "flex-start",
                  padding: "10px 12px", borderRadius: "10px", marginBottom: "6px",
                  background: currentLevel === i ? l.bg : "var(--surface)",
                  border: `1px solid ${currentLevel === i ? l.color + "40" : "var(--border)"}`,
                  opacity: currentLevel > i ? 0.7 : 1,
                }}>
                  <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>
                    {currentLevel > i ? "✅" : currentLevel === i ? "🔵" : "⚪"}
                  </span>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: "0.88rem", color: currentLevel >= i ? l.color : "var(--text-muted)" }}>
                      Level {i}: {l.name}
                    </p>
                    <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>{l.limits}</p>
                  </div>
                </div>
              ))}
            </div></div>

            {/* Quick actions */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {currentLevel < 1 && (
                <button onClick={() => setTab("identity")} className="btn btn-primary">
                  🪪 Verify Identity (Level 1) →
                </button>
              )}
              {currentLevel >= 1 && currentLevel < 2 && (
                <button onClick={() => setTab("identity")} className="btn btn-outline">
                  📋 Submit ID for Level 2 →
                </button>
              )}
              <button onClick={() => setTab("bank")} className="btn btn-outline">
                🏦 Manage Bank Accounts →
              </button>
            </div>
          </div>

        /* ── IDENTITY VERIFICATION TAB ───────────────────────── */
        ) : tab === "identity" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Level 1: BVN/NIN */}
            <div className="card"><div className="card-body">
              <h3 style={{ fontWeight: 700, marginBottom: "4px" }}>⚡ Level 1: Identity Verification</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "16px" }}>
                Enter your BVN or NIN to verify your identity. Your number is hashed — we never store the raw value.
              </p>
              {bvnMsg.text && (
                <div className={`alert alert-${bvnMsg.type === "success" ? "success" : "error"}`} style={{ marginBottom: "14px" }}>
                  {bvnMsg.type === "success" ? "✅ " : "⚠️ "}{bvnMsg.text}
                </div>
              )}
              {currentLevel >= 1 ? (
                <div className="alert alert-success">✅ Identity already verified (Level {currentLevel})</div>
              ) : (
                <form onSubmit={submitBVN} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div className="form-group">
                    <label className="form-label">BVN (Bank Verification Number) — 11 digits</label>
                    <input className="form-input" type="text" inputMode="numeric" maxLength={11}
                      value={bvn} onChange={e => setBvn(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter your 11-digit BVN" />
                  </div>
                  <div style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>— OR —</div>
                  <div className="form-group">
                    <label className="form-label">NIN (National Identification Number) — 11 digits</label>
                    <input className="form-input" type="text" inputMode="numeric" maxLength={11}
                      value={nin} onChange={e => setNin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter your 11-digit NIN" />
                  </div>
                  <div className="alert alert-info" style={{ fontSize: "0.78rem" }}>
                    🔒 Your BVN/NIN is hashed with SHA-256 before storage. DUNAZOE never stores raw identity numbers.
                  </div>
                  <button type="submit" disabled={bvnLoading} className="btn btn-primary">
                    {bvnLoading ? "Verifying…" : "✅ Verify Identity"}
                  </button>
                </form>
              )}
            </div></div>

            {/* Level 2: Government ID */}
            <div className="card" style={{ opacity: currentLevel < 1 ? 0.5 : 1 }}><div className="card-body">
              <h3 style={{ fontWeight: 700, marginBottom: "4px" }}>🔵 Level 2: Government ID</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "16px" }}>
                Upload a government-issued ID and selfie for manual review to unlock the ₦5M limit.
                {currentLevel < 1 && " Complete Level 1 first."}
              </p>
              {idMsg.text && (
                <div className={`alert alert-${idMsg.type === "success" ? "success" : "error"}`} style={{ marginBottom: "14px" }}>
                  {idMsg.type === "success" ? "✅ " : "⚠️ "}{idMsg.text}
                </div>
              )}
              {kyc?.status === "submitted" ? (
                <div className="alert alert-warning">⏳ ID under review (24–48 hours)</div>
              ) : currentLevel >= 2 ? (
                <div className="alert alert-success">✅ Government ID verified (Level 2)</div>
              ) : (
                <form onSubmit={submitID} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div className="form-group">
                    <label className="form-label">ID Type</label>
                    <select className="form-input" value={idType} onChange={e => setIdType(e.target.value)}>
                      <option value="national_id">National ID Card</option>
                      <option value="passport">International Passport</option>
                      <option value="drivers_license">Driver's Licence</option>
                      <option value="voters_card">Voter's Card</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Government ID Image URL</label>
                    <input className="form-input" type="url" value={idUrl}
                      onChange={e => setIdUrl(e.target.value)}
                      placeholder="https://… (upload to cloud storage first)" />
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      Upload your ID to cloud storage (Cloudinary, Imgbb) and paste the URL here.
                    </p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Selfie Holding ID — Image URL</label>
                    <input className="form-input" type="url" value={selfieUrl}
                      onChange={e => setSelfieUrl(e.target.value)}
                      placeholder="https://… (selfie with your ID visible)" />
                  </div>
                  <button type="submit" disabled={idLoading || currentLevel < 1} className="btn btn-primary">
                    {idLoading ? "Submitting…" : "📋 Submit for Review"}
                  </button>
                </form>
              )}
            </div></div>
          </div>

        /* ── BANK ACCOUNTS TAB ───────────────────────────────── */
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="alert alert-info">
              🏦 Registered bank accounts are used for wallet withdrawals. A 48-hour cooling-off period applies for security.
              Maximum 3 accounts per user.
            </div>

            {/* Existing accounts */}
            {accounts.length > 0 ? (
              <div className="card"><div className="card-body">
                <p style={{ fontWeight: 700, marginBottom: "14px" }}>Your Bank Accounts</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {accounts.map(a => (
                    <div key={a.id} style={{
                      padding: "14px", borderRadius: "12px", background: "var(--surface)",
                      border: `1px solid ${a.is_primary ? "var(--dz-blue)" : "var(--border)"}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>{a.account_name}</p>
                          <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                            {a.bank_name} · {a.account_number}
                          </p>
                          {a.cooling_off_until && new Date(a.cooling_off_until) > new Date() && (
                            <p style={{ fontSize: "0.72rem", color: "var(--warning)", marginTop: "4px" }}>
                              ⏳ Cooling off until {new Date(a.cooling_off_until).toLocaleString("en-NG")}
                            </p>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexDirection: "column", alignItems: "flex-end" }}>
                          {a.is_primary && (
                            <span className="badge badge-info" style={{ fontSize: "0.68rem" }}>Primary</span>
                          )}
                          {a.is_verified ? (
                            <span className="badge badge-success" style={{ fontSize: "0.68rem" }}>✅ Verified</span>
                          ) : (
                            <span className="badge badge-warning" style={{ fontSize: "0.68rem" }}>⏳ Pending</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div></div>
            ) : (
              <div className="alert alert-warning">No bank accounts registered yet. Add one below to enable withdrawals.</div>
            )}

            {/* Add bank account form */}
            {accounts.length < 3 && (
              <div className="card"><div className="card-body">
                <h3 style={{ fontWeight: 700, marginBottom: "16px" }}>➕ Add Bank Account</h3>
                {bankMsg.text && (
                  <div className={`alert alert-${bankMsg.type === "success" ? "success" : "error"}`} style={{ marginBottom: "14px" }}>
                    {bankMsg.type === "success" ? "✅ " : "⚠️ "}{bankMsg.text}
                  </div>
                )}
                <form onSubmit={addBankAccount} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div className="form-group">
                    <label className="form-label">Bank Name *</label>
                    <select className="form-input" required value={bankForm.bank_name}
                      onChange={e => setBankForm(f => ({ ...f, bank_name: e.target.value }))}>
                      <option value="">Select bank…</option>
                      {NG_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Account Number * (10 digits)</label>
                    <input className="form-input" type="text" inputMode="numeric" maxLength={10} required
                      value={bankForm.account_number}
                      onChange={e => setBankForm(f => ({ ...f, account_number: e.target.value.replace(/\D/g, "") }))}
                      placeholder="0123456789" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Account Name * (as on the account)</label>
                    <input className="form-input" required value={bankForm.account_name}
                      onChange={e => setBankForm(f => ({ ...f, account_name: e.target.value }))}
                      placeholder="e.g. ADEBAYO JAMES OLAMIDE" />
                  </div>
                  <div className="alert alert-warning" style={{ fontSize: "0.78rem" }}>
                    ⚠️ 48-hour cooling-off period applies for security. This account will be available for withdrawals after that period.
                    Withdrawals are sent only to verified accounts.
                  </div>
                  <button type="submit" disabled={bankLoading} className="btn btn-primary">
                    {bankLoading ? "Adding…" : "🏦 Add Bank Account"}
                  </button>
                </form>
              </div></div>
            )}

            <div style={{ textAlign: "center" }}>
              <Link href="/wallet" className="btn btn-ghost btn-sm">← Back to Wallet</Link>
            </div>
          </div>
        )
      )}
    </PageShell>
  );
}

export default function KYCPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>Loading KYC…</div>}>
      <KYCContent />
    </Suspense>
  );
}
