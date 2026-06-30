"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function WalletPage() {
  const [data, setData] = useState(null);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const token = localStorage.getItem("dunazoe_token");
    Promise.allSettled([
      fetch(`${API}/wallet/balance`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API}/wallet/transactions?limit=20`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([bal, tx]) => {
      if (bal.status === "fulfilled" && bal.value?.success) setData(bal.value);
      if (tx.status === "fulfilled" && tx.value?.transactions) setTxns(tx.value.transactions);
    }).finally(() => setLoading(false));
  }, []);

  const actions = (
    <div style={{ display: "flex", gap: "8px" }}>
      <Link href="/wallet/deposit" className="btn btn-primary btn-sm">⬆️ Deposit</Link>
      <Link href="/loans/apply" className="btn btn-outline btn-sm">💰 Loans</Link>
    </div>
  );

  return (
    <PageShell title="My Wallet" icon="💳" authRequired={true}
      subtitle="Manage your DUNAZOE digital wallet" actions={actions}>
      {offline && <div className="alert alert-error" style={{ marginBottom: "20px" }}>📡 Offline — wallet actions require a live connection.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px", marginBottom: "40px" }}>
        <div className="card" style={{ gridColumn: "1 / -1", background: "linear-gradient(135deg, rgba(0,163,255,0.1), rgba(0,102,255,0.06))", borderColor: "var(--border-strong)" }}>
          <div className="card-body">
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Available Balance</p>
            {loading ? <div className="skeleton" style={{ height: "40px", width: "180px" }} /> :
              <p style={{ fontSize: "2.2rem", fontWeight: 900 }} className="text-gradient">
                ₦{parseFloat(data?.balance || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
              </p>
            }
            {data?.ledger_id && <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>Ledger: {data.ledger_id}</p>}
          </div>
        </div>
        {[
          { href: "/wallet/deposit", icon: "⬆️", label: "Deposit", desc: "Fund wallet" },
          { href: "/checkout", icon: "💳", label: "Pay", desc: "Make a payment" },
          { href: "/loans/apply", icon: "💰", label: "Loan", desc: "Apply for funds" },
          { href: "/thrift", icon: "⬡", label: "Ajo", desc: "Group savings" },
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
      <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "14px" }}>Transaction History</h2>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: "60px", borderRadius: "12px" }} />)}
        </div>
      ) : txns.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {txns.map((t, i) => (
            <div key={i} className="card">
              <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: "0.88rem" }}>{t.description || t.type || "Transaction"}</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{t.created_at ? new Date(t.created_at).toLocaleDateString("en-NG") : "—"}</p>
                </div>
                <span style={{ fontWeight: 700, fontSize: "1rem", color: t.type === "credit" ? "var(--success)" : "var(--danger)" }}>
                  {t.type === "credit" ? "+" : "−"}₦{parseFloat(t.amount || 0).toLocaleString("en-NG")}
                </span>
              </div>
            </div>
          ))}
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
