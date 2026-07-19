"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const SUPERUSERS = ["dunazoeworld@gmail.com", "comfortwins@gmail.com"];

export default function VendorDashboardPage() {
  const [stats,    setStats]    = useState(null);
  const [products, setProducts] = useState([]);
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [user,     setUser]     = useState(null);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [verification, setVerification] = useState(null);

  useEffect(() => {
    let u = {};
    try {
      u = JSON.parse(localStorage.getItem("dunazoe_user") || "{}");
      setUser(u);
      const email = (u.email || "").toLowerCase().trim();
      setIsSuperuser(SUPERUSERS.includes(email));
    } catch (_) {}
    const token = localStorage.getItem("dunazoe_token");
    Promise.allSettled([
      fetch(`${API}/vendor/stats`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API}/products?vendor=me&limit=6`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API}/orders?vendor=me&limit=10`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API}/vendor/verification`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null),
    ]).then(([s, p, o, v]) => {
      if (s.status === "fulfilled") setStats(s.value.stats || s.value);
      if (p.status === "fulfilled") setProducts(p.value.products || []);
      if (o.status === "fulfilled") setOrders(o.value.orders || []);
      if (v.status === "fulfilled" && v.value) setVerification(v.value);
    }).finally(() => setLoading(false));
  }, []);

  // Generate human-readable vendor ID
  const vendorId = user?.vendor_id || user?.id
    ? `VND-${String(user?.vendor_id || user?.id).padStart(5, "0")}`
    : null;

  const STAT_TILES = [
    { key: "total_products", icon: "📦", label: "Products" },
    { key: "total_orders",   icon: "🛒", label: "Orders" },
    { key: "total_revenue",  icon: "₦",  label: "Revenue",  format: true },
    { key: "rating",         icon: "⭐", label: "Rating",   decimal: true },
  ];

  const QUICK = [
    { href: "/vendor/onboard",   icon: "➕", label: "Add Product" },
    { href: "/wallet",           icon: "💳", label: "Payout" },
    { href: "/orders?vendor=me", icon: "📦", label: "Orders" },
    { href: "/disputes",         icon: "⚖️", label: "Disputes" },
    { href: "/vendor/marketing", icon: "📣", label: "Marketing" },
    { href: "/track",            icon: "🚚", label: "Track" },
  ];

  const quickWithDeploy = isSuperuser
    ? [...QUICK, { href: "/deploy/download", icon: "🚀", label: "Deploy" }]
    : QUICK;

  // Milestone tiers based on total orders
  const totalOrders = parseInt(stats?.total_orders || 0);
  const MILESTONES = [
    { label: "Bronze",   target: 10,  icon: "🥉", reward: "₦500 bonus" },
    { label: "Silver",   target: 50,  icon: "🥈", reward: "₦2,000 bonus + featured listing" },
    { label: "Gold",     target: 100, icon: "🥇", reward: "₦5,000 bonus + verified badge" },
    { label: "Platinum", target: 500, icon: "💎", reward: "₦20,000 bonus + top placement" },
  ];
  const currentMilestone = MILESTONES.find(m => totalOrders < m.target) || MILESTONES[MILESTONES.length - 1];
  const prevTarget = MILESTONES[MILESTONES.indexOf(currentMilestone) - 1]?.target || 0;
  const milestonePct = currentMilestone
    ? Math.min(100, Math.round(((totalOrders - prevTarget) / (currentMilestone.target - prevTarget)) * 100))
    : 100;

  return (
    <PageShell title="Vendor Dashboard" icon="🏪" authRequired={true}
      subtitle={`Welcome back${user?.name ? `, ${user.name.split(" ")[0]}` : ""}. Manage your DUNAZOE store.`}
      actions={<Link href="/vendor/onboard" className="btn btn-primary btn-sm">+ Add Product</Link>}>

      {/* Vendor ID Badge */}
      {vendorId && (
        <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Vendor ID:</span>
          <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.85rem", color: "var(--dz-blue)", background: "rgba(0,163,255,0.08)", padding: "3px 10px", borderRadius: "6px", border: "1px solid rgba(0,163,255,0.2)" }}>
            {vendorId}
          </span>
        </div>
      )}

      {/* ── Verification Status ─────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }} className="verification-grid">
        {/* KYC Verification */}
        <div className="card" style={{ borderLeft: `3px solid ${verification?.kyc_verified ? "var(--success)" : "var(--warning)"}` }}>
          <div className="card-body" style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "2px" }}>🪪 KYC Verification</p>
                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  {verification?.kyc_verified ? "Identity verified" : "Verification pending"}
                </p>
              </div>
              <span className={`badge ${verification?.kyc_verified ? "badge-success" : "badge-muted"}`}>
                {verification?.kyc_verified ? "✓ Verified" : "Pending"}
              </span>
            </div>
            {!verification?.kyc_verified && (
              <Link href="/trust" className="btn btn-outline btn-sm" style={{ marginTop: "10px", width: "100%", textAlign: "center", display: "block" }}>
                Complete Verification →
              </Link>
            )}
          </div>
        </div>

        {/* Delivery Vendor Requests */}
        <div className="card" style={{ borderLeft: "3px solid var(--dz-blue)" }}>
          <div className="card-body" style={{ padding: "14px 16px" }}>
            <p style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "2px" }}>🛵 Delivery Network</p>
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "8px" }}>
              {verification?.delivery_vendor_approved
                ? "Approved delivery vendor"
                : "Join the delivery network"}
            </p>
            <span className={`badge ${verification?.delivery_vendor_approved ? "badge-success" : "badge-info"}`}>
              {verification?.delivery_vendor_approved ? "✓ Approved" : verification?.delivery_vendor_requested ? "Under review" : "Not applied"}
            </span>
            {!verification?.delivery_vendor_approved && (
              <Link href="/vendor/onboard" className="btn btn-ghost btn-sm" style={{ marginTop: "8px", display: "block", textAlign: "center" }}>
                Apply →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Stats tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "24px" }} className="stats-grid">
        {STAT_TILES.map(({ key, icon, label, format, decimal }) => (
          <div key={key} className="stat-tile">
            <p style={{ fontSize: "1.2rem" }}>{icon}</p>
            {loading
              ? <div className="skeleton" style={{ height: "28px", width: "70px", marginTop: "4px" }} />
              : <p className="stat-value" style={{ fontSize: "1.1rem" }}>
                  {stats?.[key] !== undefined
                    ? format   ? `₦${parseFloat(stats[key]).toLocaleString("en-NG")}`
                    : decimal  ? parseFloat(stats[key]).toFixed(1)
                    : stats[key]
                    : "—"}
                </p>
            }
            <p className="stat-label">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Milestone Bonus Progress ──────────────────────────────────── */}
      <div className="card" style={{ marginBottom: "24px", background: "linear-gradient(135deg,rgba(155,93,229,0.08),rgba(0,163,255,0.04))", border: "1px solid rgba(155,93,229,0.15)" }}>
        <div className="card-body">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <p style={{ fontWeight: 700, fontSize: "0.95rem" }}>🏆 Milestone Bonus</p>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{totalOrders} / {currentMilestone?.target || "—"} orders</span>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "1.6rem" }}>{currentMilestone?.icon}</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, marginBottom: "2px" }}>{currentMilestone?.label} Tier</p>
              <p style={{ fontSize: "0.78rem", color: "var(--success)", fontWeight: 700 }}>Reward: {currentMilestone?.reward}</p>
            </div>
          </div>
          <div style={{ background: "var(--bg-3)", borderRadius: "999px", height: "8px", overflow: "hidden" }}>
            <div style={{ width: `${milestonePct}%`, height: "100%", background: "linear-gradient(90deg,#9b5de5,var(--dz-blue))", borderRadius: "999px", transition: "width 0.5s" }} />
          </div>
          <p style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "4px" }}>
            {milestonePct}% to {currentMilestone?.label} — {Math.max(0, (currentMilestone?.target || 0) - totalOrders)} orders remaining
          </p>
        </div>
      </div>

      {/* Quick links */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "36px" }}>
        {quickWithDeploy.map(({ href, icon, label }) => (
          <Link key={href} href={href} className="card" style={{ textDecoration: "none", flex: "1 1 80px", maxWidth: "110px" }}>
            <div className="card-body" style={{ textAlign: "center", padding: "14px 8px" }}>
              <span style={{ fontSize: "1.4rem", display: "block", marginBottom: "4px" }}>{icon}</span>
              <p style={{ fontWeight: 600, fontSize: "0.78rem" }}>{label}</p>
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
                <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "monospace", marginBottom: "2px" }}>
                  PRD-{String(p.id).padStart(5, "0")}
                </p>
                <p style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                <p className="text-gradient" style={{ fontWeight: 800 }}>₦{parseFloat(p.price || 0).toLocaleString("en-NG")}</p>
                <span className={`badge badge-${p.status === "published" ? "success" : "muted"}`} style={{ marginTop: "6px", display: "inline-block" }}>{p.status || "published"}</span>
                {/* Product link for sharing */}
                <button
                  onClick={() => {
                    const link = p.shareable_link ? `https://${p.shareable_link}` : `${window.location.origin}/products/${p.id}`;
                    navigator.clipboard?.writeText(link).then(() => alert("Product link copied!")).catch(() => alert(link));
                  }}
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: "8px", width: "100%", fontSize: "0.75rem" }}
                >
                  🔗 Copy Product Link
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "40px 24px", marginBottom: "32px" }}>
          <p style={{ fontSize: "1.5rem", marginBottom: "8px" }}>📦</p>
          <p style={{ fontWeight: 600, marginBottom: "4px" }}>No products yet</p>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "16px" }}>Add your first product to start selling</p>
          <Link href="/vendor/onboard" className="btn btn-primary btn-sm">+ Add Product</Link>
        </div>
      )}

      {orders.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "14px" }}>Recent Orders</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "32px" }}>
            {orders.slice(0, 5).map(o => (
              <Link key={o.id} href={`/orders/${o.id}`} className="card" style={{ textDecoration: "none", display: "block" }}>
                <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: "0.88rem" }}>ORD-{String(o.id).padStart(5, "0")}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{o.created_at ? new Date(o.created_at).toLocaleDateString("en-NG") : "—"}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className={`badge badge-${o.status === "delivered" ? "success" : o.status === "cancelled" ? "danger" : "info"}`}>{o.status || "pending"}</span>
                    <p style={{ fontSize: "0.88rem", fontWeight: 700, marginTop: "4px" }}>₦{parseFloat(o.total || 0).toLocaleString("en-NG")}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <style>{`
        @media (max-width: 600px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .verification-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </PageShell>
  );
}
