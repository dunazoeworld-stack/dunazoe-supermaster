"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function DashboardPage() {
  const [user,      setUser]      = useState(null);
  const [walletBal, setWalletBal] = useState(null);
  const [orders,    setOrders]    = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem("dunazoe_user") || "{}"); setUser(u); } catch (_) {}
    const token = localStorage.getItem("dunazoe_token");
    Promise.allSettled([
      fetch(`${API}/wallet/balance`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API}/orders?limit=5`,  { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([bal, ord]) => {
      if (bal.status === "fulfilled" && bal.value?.success) setWalletBal(bal.value.balance ?? null);
      if (ord.status === "fulfilled" && ord.value?.orders) setOrders(ord.value.orders.slice(0, 5));
    }).finally(() => setLoading(false));
  }, []);

  const quickLinks = [
    { href: "/products",      icon: "🛒", label: "Shop",       desc: "Browse" },
    { href: "/wallet",        icon: "💳", label: "Wallet",     desc: "Funds" },
    { href: "/wallet/deposit",icon: "⬆️", label: "Deposit",    desc: "Add funds" },
    { href: "/thrift",        icon: "⬡",  label: "Ajo",        desc: "Savings" },
    { href: "/orders",        icon: "📦", label: "Orders",     desc: "Track" },
    { href: "/disputes",      icon: "⚖️", label: "Disputes",   desc: "Issues" },
  ];

  return (
    <PageShell
      title={`Welcome${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
      icon="👋"
      authRequired={true}
      subtitle="Your DUNAZOE dashboard — manage your marketplace activity"
    >
      {/* Wallet balance + quick links — ALL icons visible in one view */}
      <div style={{ marginBottom: "40px" }}>
        {/* Wallet card — full width */}
        <div className="card" style={{
          marginBottom: "14px",
          background: "linear-gradient(135deg, rgba(0,163,255,0.12), rgba(0,102,255,0.06))",
          borderColor: "var(--border-strong)",
        }}>
          <div className="card-body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", padding: "20px 22px" }}>
            <div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "4px" }}>💳 Wallet Balance</p>
              {loading
                ? <div className="skeleton" style={{ height: "32px", width: "140px" }} />
                : walletBal !== null
                  ? <p style={{ fontSize: "1.9rem", fontWeight: 800, background: "var(--dz-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                      ₦{parseFloat(walletBal).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </p>
                  : <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-muted)" }}>No balance loaded</p>
              }
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <Link href="/wallet/deposit" className="btn btn-primary btn-sm">Deposit →</Link>
              <Link href="/wallet"         className="btn btn-outline btn-sm">Manage</Link>
            </div>
          </div>
        </div>

        {/* Quick-link icons — flex-wrap: all 6 visible without horizontal scroll */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
        }}>
          {quickLinks.map(({ href, icon, label, desc }) => (
            <Link key={href} href={href} className="card"
              style={{ textDecoration: "none", flex: "1 1 90px", minWidth: "80px", maxWidth: "130px" }}>
              <div className="card-body" style={{ textAlign: "center", padding: "14px 8px" }}>
                <span style={{ fontSize: "1.7rem", display: "block", marginBottom: "5px" }}>{icon}</span>
                <p style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: "1px" }}>{label}</p>
                <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px" }}>Recent Orders</h2>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: "60px", borderRadius: "12px" }} />)}
        </div>
      ) : orders.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {orders.map(o => (
            <Link key={o.id} href={`/orders/${o.id}`} className="card" style={{ textDecoration: "none", display: "block" }}>
              <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px" }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: "0.88rem" }}>Order #{o.id}</p>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    {o.created_at ? new Date(o.created_at).toLocaleDateString("en-NG") : "—"}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className={`badge badge-${o.status === "delivered" ? "success" : o.status === "cancelled" ? "danger" : "info"}`}>
                    {o.status || "pending"}
                  </span>
                  <p style={{ fontSize: "0.88rem", fontWeight: 700, marginTop: "4px" }}>
                    ₦{parseFloat(o.total || 0).toLocaleString("en-NG")}
                  </p>
                </div>
              </div>
            </Link>
          ))}
          <Link href="/orders" className="btn btn-ghost" style={{ alignSelf: "flex-start" }}>View all orders →</Link>
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">📦</span>
          <p className="empty-title">No orders yet</p>
          <p className="empty-body">Start shopping to see your orders here.</p>
          <Link href="/products" className="btn btn-primary">🛒 Start Shopping</Link>
        </div>
      )}
    </PageShell>
  );
}
