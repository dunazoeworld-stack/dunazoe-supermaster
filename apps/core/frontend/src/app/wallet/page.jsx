"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function WalletPage() {
  const searchParams = useSearchParams();

  const [data,         setData]         = useState(null);
  const [txns,         setTxns]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [offline,      setOffline]      = useState(false);
  const [user,         setUser]         = useState(null);
  const [depositMsg,   setDepositMsg]   = useState({ type: "", text: "" });
  const [depositVfying,setDepositVfying]= useState(false);

  // Withdrawal state
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [wdAmount,     setWdAmount]    = useState("");
  const [wdPurpose,    setWdPurpose]   = useState("Personal withdrawal");
  const [wdLoading,    setWdLoading]   = useState(false);
  const [wdError,      setWdError]     = useState("");
  const [wdSuccess,    setWdSuccess]   = useState("");

  // Bank verification state
  const [bankDetails,  setBankDetails] = useState(null);  // registered bank account

  function refreshBalance(token) {
    return Promise.allSettled([
      fetch(`${API}/wallet/balance`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API}/wallet/transactions?limit=20`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([bal, tx]) => {
      if (bal.status === "fulfilled" && bal.value?.success) setData(bal.value);
      if (tx.status === "fulfilled" && tx.value?.transactions) setTxns(tx.value.transactions);
    });
  }

  useEffect(() => {
    setOffline(!navigator.onLine);
    try { const u = JSON.parse(localStorage.getItem("dunazoe_user") || "{}"); setUser(u); } catch (_) {}
    const token = localStorage.getItem("dunazoe_token");

    // ── Auto-verify deposit when Paystack redirects back ─────────────────────
    const depositRef = searchParams.get("deposit_ref")
      || searchParams.get("reference")
      || searchParams.get("trxref");
    if (depositRef) {
      setDepositVfying(true);
      setDepositMsg({ type: "info", text: "⏳ Verifying your payment with Paystack…" });
      fetch(`${API}/wallet/verify?ref=${encodeURIComponent(depositRef)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            setDepositMsg({ type: "success", text: `✅ ${d.message || "Deposit successful!"}` });
            // Remove the ?deposit_ref from URL cleanly
            window.history.replaceState({}, "", "/wallet");
          } else {
            setDepositMsg({ type: "error", text: `⚠️ ${d.error || "Payment could not be verified. If charged, contact support."}` });
          }
        })
        .catch(() => setDepositMsg({ type: "error", text: "⚠️ Could not verify payment. If you were charged, contact support with ref: " + depositRef }))
        .finally(() => {
          setDepositVfying(false);
          // Refresh balance after verification attempt
          refreshBalance(token);
        });
    }

    Promise.allSettled([
      fetch(`${API}/wallet/balance`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API}/wallet/transactions?limit=20`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API}/vendor/verification`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null),
      fetch(`${API}/kyc/bank-accounts`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null),
    ]).then(([bal, tx, verif, bankAccts]) => {
      if (bal.status === "fulfilled" && bal.value?.success) setData(bal.value);
      if (tx.status === "fulfilled" && tx.value?.transactions) setTxns(tx.value.transactions);
      // Try KYC bank accounts first, fall back to vendor verification
      if (bankAccts.status === "fulfilled" && bankAccts.value?.accounts?.length > 0) {
        const primary = bankAccts.value.accounts.find(a => a.is_primary) || bankAccts.value.accounts[0];
        if (primary) {
          setBankDetails({ bank_name: primary.bank_name, account_no: primary.account_number, account_name: primary.account_name });
        }
      } else if (verif.status === "fulfilled" && verif.value) {
        const v = verif.value;
        if (v.bank_name || v.account_no || v.account_name) {
          setBankDetails({
            bank_name:    v.bank_name    || v.payout_bank_name,
            account_no:   v.account_no   || v.payout_account_no,
            account_name: v.account_name || v.payout_account_name,
          });
        }
      }
    }).finally(() => setLoading(false));
  }, []);

  async function handleWithdraw(e) {
    e.preventDefault();
    setWdError(""); setWdSuccess("");
    if (!wdAmount || parseFloat(wdAmount) < 500) { setWdError("Minimum withdrawal is ₦500."); return; }
    if (!bankDetails?.account_no) {
      setWdError("NO_BANK_ACCOUNT");
      return;
    }
    setWdLoading(true);
    try {
      const token = localStorage.getItem("dunazoe_token");
      const res = await fetch(`${API}/wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action:       "withdraw",
          amount:       parseFloat(wdAmount),
          currency:     "NGN",
          purpose:      wdPurpose,
          bank_name:    bankDetails.bank_name,
          account_no:   bankDetails.account_no,
          account_name: bankDetails.account_name,
        }),
      });
      const d = await res.json();
      if (d.success) {
        setWdSuccess(`✅ ₦${parseFloat(wdAmount).toLocaleString("en-NG")} withdrawal initiated to ${bankDetails.bank_name} (${bankDetails.account_no}). Processing within 24 hours.`);
        setWdAmount(""); setShowWithdraw(false);
        // Refresh balance
        const token2 = localStorage.getItem("dunazoe_token");
        fetch(`${API}/wallet/balance`, { headers: { Authorization: `Bearer ${token2}` } })
          .then(r => r.json()).then(d => { if (d.success) setData(d); }).catch(() => {});
      } else {
        setWdError(d.error || "Withdrawal failed. Please try again.");
      }
    } catch (_) { setWdError("Connection error. Please try again."); }
    finally { setWdLoading(false); }
  }

  const balance = parseFloat(data?.balance || 0);

  const actions = (
    <div style={{ display: "flex", gap: "8px" }}>
      <Link href="/wallet/deposit" className="btn btn-primary btn-sm">⬆️ Deposit</Link>
      <button onClick={() => { setShowWithdraw(!showWithdraw); setWdError(""); setWdSuccess(""); }} className="btn btn-outline btn-sm">
        ⬇️ Withdraw
      </button>
      <Link href="/loans/apply" className="btn btn-ghost btn-sm">💰 Loans</Link>
    </div>
  );

  return (
    <PageShell title="My Wallet" icon="💳" authRequired={true}
      subtitle="Manage your DUNAZOE digital wallet" actions={actions}>
      {offline && <div className="alert alert-error" style={{ marginBottom: "20px" }}>📡 Offline — wallet actions require a live connection.</div>}

      {/* Deposit verification callback banner */}
      {depositMsg.text && (
        <div className={`alert alert-${depositMsg.type === "success" ? "success" : depositMsg.type === "error" ? "error" : "info"}`}
          style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
          {depositVfying && <div className="dz-spinner" style={{ width: "16px", height: "16px", flexShrink: 0 }} />}
          <span>{depositMsg.text}</span>
          {!depositVfying && (
            <button onClick={() => setDepositMsg({ type: "", text: "" })}
              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: "1rem", opacity: 0.6 }}>✕</button>
          )}
        </div>
      )}

      {/* Success banner */}
      {wdSuccess && <div className="alert alert-success" style={{ marginBottom: "16px" }}>✅ {wdSuccess}</div>}

      {/* Balance + quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px", marginBottom: "28px" }}>
        <div className="card" style={{ gridColumn: "1 / -1", background: "linear-gradient(135deg, rgba(0,163,255,0.1), rgba(0,102,255,0.06))", borderColor: "var(--border-strong)" }}>
          <div className="card-body">
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Available Balance</p>
            {loading ? <div className="skeleton" style={{ height: "40px", width: "180px" }} /> :
              <p style={{ fontSize: "2.2rem", fontWeight: 900 }} className="text-gradient">
                ₦{balance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
              </p>
            }
            {data?.ledger_id && <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>Ledger: {data.ledger_id}</p>}
          </div>
        </div>
        {[
          { href: "/wallet/deposit", icon: "⬆️", label: "Deposit",  desc: "Fund wallet" },
          { href: "/checkout",        icon: "💳", label: "Pay",       desc: "Make a payment" },
          { href: "/loans/apply",     icon: "💰", label: "Loan",      desc: "Apply for funds" },
          { href: "/thrift",          icon: "⬡",  label: "Ajo",       desc: "Group savings" },
        ].map(({ href, icon, label, desc }) => (
          <Link key={href} href={href} className="card" style={{ textDecoration: "none", display: "block" }}>
            <div className="card-body" style={{ textAlign: "center" }}>
              <span style={{ fontSize: "1.6rem", display: "block", marginBottom: "6px" }}>{icon}</span>
              <p style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "2px" }}>{label}</p>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Withdrawal form */}
      {showWithdraw && (
        <div className="card" style={{ marginBottom: "24px", border: "1.5px solid rgba(245,158,11,0.3)" }}>
          <div className="card-body">
            <p style={{ fontWeight: 700, marginBottom: "12px", fontSize: "1rem" }}>⬇️ Withdraw Funds</p>

            {/* Bank details display */}
            {bankDetails?.account_no ? (
              <div style={{ padding: "12px 14px", background: "rgba(0,200,150,0.06)", borderRadius: "10px", marginBottom: "16px", border: "1px solid rgba(0,204,136,0.2)" }}>
                <p style={{ fontSize: "0.78rem", color: "var(--success)", marginBottom: "4px", fontWeight: 700 }}>✅ Verified Bank Account</p>
                <p style={{ fontSize: "0.85rem", fontWeight: 700 }}>{bankDetails.account_name}</p>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{bankDetails.bank_name} · {bankDetails.account_no}</p>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  🔒 Withdrawals are only sent to this registered and verified account for your security.
                </p>
              </div>
            ) : (
              <div className="alert alert-warning" style={{ marginBottom: "16px" }}>
                <p style={{ fontWeight: 700, marginBottom: "6px" }}>🏦 No bank account registered</p>
                <p style={{ fontSize: "0.85rem", marginBottom: "10px" }}>
                  To enable withdrawals you must add a verified bank account first.
                  A 48-hour cooling-off period applies for security after adding.
                </p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <Link href="/kyc?tab=bank" className="btn btn-primary btn-sm">
                    🏦 Add Bank Account →
                  </Link>
                  <Link href="/kyc" className="btn btn-outline btn-sm">
                    📋 View KYC Status
                  </Link>
                </div>
              </div>
            )}

            {wdError && wdError !== "NO_BANK_ACCOUNT" && (
              <div className="alert alert-error" style={{ marginBottom: "12px" }}>⚠️ {wdError}</div>
            )}

            {bankDetails?.account_no && (
              <form onSubmit={handleWithdraw} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div className="form-group">
                  <label className="form-label">Amount (₦) — Min ₦500</label>
                  <input className="form-input" type="number" min="500" step="100"
                    value={wdAmount} onChange={e => setWdAmount(e.target.value)}
                    placeholder="Enter withdrawal amount" required
                    style={{ fontSize: "1.3rem", fontWeight: 700 }} />
                  {wdAmount && parseFloat(wdAmount) > 0 && (
                    <p style={{ fontSize: "0.75rem", color: balance >= parseFloat(wdAmount) ? "var(--success)" : "var(--danger)", marginTop: "4px" }}>
                      {balance >= parseFloat(wdAmount)
                        ? `✓ Balance sufficient (₦${balance.toLocaleString("en-NG")} available)`
                        : `✗ Insufficient balance (₦${balance.toLocaleString("en-NG")} available)`}
                    </p>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Purpose / Note</label>
                  <input className="form-input" type="text" value={wdPurpose}
                    onChange={e => setWdPurpose(e.target.value)} placeholder="e.g. Personal withdrawal" />
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="submit" disabled={wdLoading || offline || !wdAmount || parseFloat(wdAmount) > balance}
                    className="btn btn-primary" style={{ flex: 1 }}>
                    {wdLoading ? "Processing…" : `Withdraw ₦${wdAmount ? parseFloat(wdAmount).toLocaleString("en-NG") : "—"}`}
                  </button>
                  <button type="button" onClick={() => setShowWithdraw(false)} className="btn btn-ghost">Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Transaction History */}
      <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "14px" }}>Transaction History</h2>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: "60px", borderRadius: "12px" }} />)}
        </div>
      ) : txns.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {txns.map((t, i) => {
            const isCredit = t.type === "credit" || t.type === "deposit" || t.type === "transfer_in";
            return (
              <div key={i} className="card">
                <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: "0.88rem" }}>{t.description || t.type || "Transaction"}</p>
                    {t.reference && <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "monospace" }}>Ref: {t.reference}</p>}
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{t.created_at ? new Date(t.created_at).toLocaleDateString("en-NG") : "—"}</p>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: "1rem", color: isCredit ? "var(--success)" : "var(--danger)" }}>
                    {isCredit ? "+" : "−"}₦{parseFloat(t.amount || 0).toLocaleString("en-NG")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">💳</span>
          <p className="empty-title">No transactions yet</p>
          <p className="empty-body">Deposit funds or make your first purchase to see your history.</p>
          <Link href="/wallet/deposit" className="btn btn-primary">Deposit Funds</Link>
        </div>
      )}
    </PageShell>
  );
}
