"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function VendorDashboardPage() {
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem("dunazoe_user") || "{}"); setUser(u); } catch (_) {}
    const token = localStorage.getItem("dunazoe_token");
    Promise.allSettled([
      fetch(`${API}/vendor/stats`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API}/products?vendor=me&limit=6`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API}/orders?vendor=me&limit=10`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([s, p, o]) => {
      if (s.status === "fulfilled") setStats(s.value.stats || s.value);
      if (p.status === "fulfilled") setProducts(p.value.products || []);
      if (o.status === "fulfilled") setOrders(o.value.orders || []);
    }).finally(() => setLoading(false));
  }, []);

  const STAT_TILES = [
    { key: "total_products", icon: "📦", label: "Products" },
    { key: "total_orders", icon: "🛒", label: "Orders" },
    { key: "total_revenue", icon: "₦", label: "Revenue", format: true },
    { key: "rating", icon: "⭐", label: "Rating", decimal: true },
  ];

  const QUICK = [
    { href: "/vendor/onboard", icon: "➕", label: "Add Product" },
    { href: "/wallet", icon: "💳", label: "Payout" },
    { href: "/orders?vendor=me", icon: "📦", label: "Orders" },
    { href: "/disputes", icon: "⚖️", label: "Disputes" },
  ];

  return (
    <PageShell title="Vendor Dashboard" icon="🏪" authRequired={true}
      subtitle={`Welcome back${user?.name ? `, ${user.name.split(" ")[0]}` : ""}. Manage your DUNAZOE store.`}
      actions={<Link href="/vendor/onboard" className="btn btn-primary btn-sm">+ Add Product</Link>}>
      <div className="grid-4" style={{ marginBottom: "32px" }}>
        {STAT_TILES.map(({ key, icon, label, format, decimal }) => (
          <div key={key} className="stat-tile">
            <p style={{ fontSize: "1.2rem" }}>{icon}</p>
            {loading
              ? <div className="skeleton" style={{ height: "28px", width: "80px", marginTop: "4px" }} />
              : <p className="stat-value">{stats?.[key] !== undefined ? format ? `₦${parseFloat(stats[key]).toLocaleString("en-NG")}` : decimal ? parseFloat(stats[key]).toFixed(1) : stats[key] : "—"}</p>
            }
            <p className="stat-label">{label}</p>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "36px" }}>
        {QUICK.map(({ href, icon, label }) => (
          <Link key={href} href={href} className="card" style={{ textDecoration: "none" }}>
            <div className="card-body" style={{ textAlign: "center", padding: "14px" }}>
              <span style={{ fontSize: "1.4rem", display: "block", marginBottom: "4px" }}>{icon}</span>
              <p style={{ fontWeight: 600, fontSize: "0.82rem" }}>{label}</p>
            </div>
          </Link>
        ))}
      </div>
      <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "14px" }}>My Products</h2>
      {loading ? (
        <div className="grid-auto">{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: "120px", borderRadius: "14px" }} />)}</div>
      ) : products.length > 0 ? (
        <div className="grid-auto" style={{ marginBottom: "32px" }}>
          {products.map(p => (
            <div key={p.id} className="card">
              <div className="card-body">
                <p style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                <p className="text-gradient" style={{ fontWeight: 800 }}>₦{parseFloat(p.price || 0).toLocaleString("en-NG")}</p>
                <span className={`badge ${p.is_active ? "badge-success" : "badge-muted"}`} style={{ marginTop: "6px" }}>{p.is_active ? "Active" : "Inactive"}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">📦</span>
          <p className="empty-title">No products yet</p>
          <p className="empty-body">Add your first product to start selling on DUNAZOE.</p>
          <Link href="/vendor/onboard" className="btn btn-primary">Add Product</Link>
        </div>
      )}
      {orders.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "14px" }}>Recent Orders</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {orders.slice(0, 5).map(o => (
              <Link key={o.id} href={`/orders/${o.id}`} className="card" style={{ textDecoration: "none" }}>
                <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: "0.88rem" }}>Order #{o.id}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{o.buyer_name || "Buyer"}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className="badge badge-info">{o.status || "pending"}</span>
                    <p style={{ fontSize: "0.88rem", fontWeight: 700, marginTop: "4px" }}>₦{parseFloat(o.total || 0).toLocaleString("en-NG")}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}
