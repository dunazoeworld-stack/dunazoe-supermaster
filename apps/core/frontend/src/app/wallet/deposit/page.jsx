"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function WalletDepositPage() {
  const [amount, setAmount] = useState("");
  const [provider, setProvider] = useState("paystack");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const go = () => setOffline(false); const off = () => setOffline(true);
    window.addEventListener("online", go); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", go); window.removeEventListener("offline", off); };
  }, []);

  async function handleDeposit(e) {
    e.preventDefault();
    if (offline || !navigator.onLine) { setError("You are offline. Wallet funding requires a live connection."); return; }
    if (!amount || parseFloat(amount) < 100) { setError("Minimum deposit is ₦100."); return; }
    setLoading(true); setError("");
    try {
      const token = localStorage.getItem("dunazoe_token");
      const res = await fetch(`${API}/wallet/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: parseFloat(amount), provider }),
      });
      const data = await res.json();
      if (data.payment_url) { window.location.href = data.payment_url; }
      else if (data.success) { window.location.href = "/wallet"; }
      else { setError(data.error || "Deposit initiation failed."); }
    } catch (_) { setError("Failed to initiate deposit. Please try again."); }
    finally { setLoading(false); }
  }

  const QUICK = [500, 1000, 2000, 5000, 10000, 20000];

  return (
    <PageShell title="Deposit Funds" icon="⬆️" authRequired={true}
      subtitle="Add money to your DUNAZOE wallet"
      breadcrumb={[{ href: "/wallet", label: "Wallet" }, { label: "Deposit" }]}>
      {offline && <div className="alert alert-error" style={{ marginBottom: "20px" }}>📡 Offline — wallet funding requires a live connection.</div>}
      {error && <div className="alert alert-error" style={{ marginBottom: "20px" }}>⚠️ {error}</div>}
      <div className="container-sm" style={{ padding: 0 }}>
        <div className="card">
          <div className="card-body" style={{ padding: "32px" }}>
            <form onSubmit={handleDeposit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div className="form-group">
                <label className="form-label">Amount (₦)</label>
                <input className="form-input" type="number" min="100" step="50" value={amount}
                  onChange={e => setAmount(e.target.value)} placeholder="Enter amount" required
                  style={{ fontSize: "1.4rem", fontWeight: 700, padding: "14px" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                {QUICK.map(v => (
                  <button key={v} type="button" onClick={() => setAmount(String(v))} className="btn btn-ghost btn-sm"
                    style={{ borderColor: amount === String(v) ? "var(--dz-blue)" : "var(--border)", color: amount === String(v) ? "var(--dz-blue)" : "var(--text-secondary)" }}>
                    ₦{v.toLocaleString()}
                  </button>
                ))}
              </div>
              <div className="form-group">
                <label className="form-label">Payment Provider</label>
                {[
                  { id: "paystack", icon: "💳", label: "Paystack", desc: "Cards, bank transfer, USSD" },
                  { id: "stripe", icon: "🌍", label: "Stripe", desc: "International cards" },
                ].map(p => (
                  <label key={p.id} style={{ display: "flex", gap: "12px", alignItems: "center", padding: "12px", borderRadius: "10px", border: `1.5px solid ${provider === p.id ? "var(--dz-blue)" : "var(--border)"}`, background: provider === p.id ? "var(--dz-gradient-soft)" : "transparent", cursor: "pointer", marginBottom: "8px" }}>
                    <input type="radio" name="prov" value={p.id} checked={provider === p.id} onChange={() => setProvider(p.id)} style={{ accentColor: "var(--dz-blue)" }} />
                    <span>{p.icon}</span>
                    <div><p style={{ fontWeight: 600, fontSize: "0.9rem" }}>{p.label}</p><p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{p.desc}</p></div>
                  </label>
                ))}
              </div>
              <button type="submit" disabled={loading || offline} className="btn btn-primary btn-lg" style={{ justifyContent: "center" }}>
                {loading ? "Initiating…" : offline ? "🔌 No Connection" : `Deposit ₦${amount ? parseFloat(amount).toLocaleString() : "—"} →`}
              </button>
            </form>
          </div>
        </div>
        <div className="alert alert-info" style={{ marginTop: "16px" }}>
          🔒 Payments are secured with end-to-end encryption. Funds reflect immediately after confirmation.
        </div>
      </div>
    </PageShell>
  );
}
