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
  const [copiedId, setCopiedId] = useState(null);

  // Edit / Delete product state
  const [editProduct,  setEditProduct]  = useState(null);  // null = closed
  const [editForm,     setEditForm]     = useState({});
  const [editLoading,  setEditLoading]  = useState(false);
  const [editMsg,      setEditMsg]      = useState({ type: "", text: "" });
  const [deleteTarget, setDeleteTarget] = useState(null);  // product being confirmed for delete
  const [deleteLoading,setDeleteLoading]= useState(false);

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
    { href: "/track",            icon: "📍", label: "Track" },
    { href: "/disputes",         icon: "⚖️", label: "Disputes" },
    { href: "/vendor/marketing", icon: "📣", label: "Marketing AI" },
  ];

  const quickWithDeploy = isSuperuser
    ? [...QUICK, { href: "/deploy/download", icon: "🚀", label: "Deploy" }]
    : QUICK;

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

  // ── Product CRUD ────────────────────────────────────────────────────────────
  function openEdit(p) {
    setEditProduct(p);
    setEditForm({
      name:        p.name        || "",
      description: p.description || "",
      price:       p.price       || "",
      stock:       p.stock       ?? "",
      category:    p.category    || "",
      weight:      p.weight      || "",
    });
    setEditMsg({ type: "", text: "" });
  }

  async function handleEditSave(e) {
    e.preventDefault();
    if (!editProduct) return;
    const token = localStorage.getItem("dunazoe_token");
    setEditLoading(true); setEditMsg({ type: "", text: "" });
    try {
      const res = await fetch(`${API}/products/${editProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name:        editForm.name,
          description: editForm.description,
          price:       parseFloat(editForm.price),
          stock:       editForm.stock !== "" ? parseInt(editForm.stock) : undefined,
          category:    editForm.category,
          weight:      editForm.weight !== "" ? parseFloat(editForm.weight) : undefined,
        }),
      });
      const d = await res.json();
      if (d.success || res.ok) {
        setProducts(prev => prev.map(p => p.id === editProduct.id ? { ...p, ...editForm, price: parseFloat(editForm.price) } : p));
        setEditMsg({ type: "success", text: "Product updated successfully." });
        setTimeout(() => setEditProduct(null), 1200);
      } else {
        setEditMsg({ type: "error", text: d.error || "Update failed. Please try again." });
      }
    } catch (_) { setEditMsg({ type: "error", text: "Connection error. Please try again." }); }
    finally { setEditLoading(false); }
  }

  async function handleSoftDelete(p) {
    const token = localStorage.getItem("dunazoe_token");
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API}/products/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "deleted" }),
      });
      const d = await res.json();
      if (d.success || res.ok) {
        setProducts(prev => prev.filter(pr => pr.id !== p.id));
        setDeleteTarget(null);
      } else {
        alert(d.error || "Could not remove product. Please try again.");
      }
    } catch (_) { alert("Connection error. Please try again."); }
    finally { setDeleteLoading(false); }
  }

  function copyLink(p) {
    const link = p.shareable_link ? `https://${p.shareable_link}` : `${window.location.origin}/products/${p.id}`;
    navigator.clipboard?.writeText(link).then(() => {
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => alert(link));
  }

  function shareProduct(p) {
    const link = p.shareable_link ? `https://${p.shareable_link}` : `${window.location.origin}/products/${p.id}`;
    const text = `Check out '${p.name}' on DUNAZOE: ${link}`;
    if (navigator.share) {
      navigator.share({ title: p.name, text, url: link }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(link).then(() => alert("Link copied!")).catch(() => alert(link));
    }
  }

  const STATUS_BADGE = {
    pending: "info", reserved: "warning", processing: "warning",
    paid: "success", shipped: "info", delivered: "success", cancelled: "danger",
  };

  return (
    <PageShell title="Vendor Dashboard" icon="🏪" authRequired={true}
      subtitle={`Welcome back${user?.name ? `, ${user.name.split(" ")[0]}` : ""}. Manage your DUNAZOE store.`}
      actions={<Link href="/vendor/onboard" className="btn btn-primary btn-sm">+ Add Product</Link>}>

      {/* Vendor ID Badge */}
      {vendorId && (
        <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Vendor ID:</span>
          <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.85rem", color: "var(--dz-blue)", background: "rgba(0,163,255,0.08)", padding: "3px 10px", borderRadius: "6px", border: "1px solid rgba(0,163,255,0.2)" }}>
            {vendorId}
          </span>
        </div>
      )}

      {/* ── Vendor Verification Status Banner ────────────────────────────────── */}
      {verification && (
        <>
          {/* Store status alert */}
          {verification.status === "pending" && (
            <div className="alert alert-warning" style={{ marginBottom: "16px" }}>
              ⏳ <strong>Store verification pending</strong> — your vendor account is under review.
              This typically takes 24–48 hours. You can still list products.{" "}
              <Link href="/kyc" style={{ color: "var(--warning)", fontWeight: 700 }}>Complete KYC →</Link>
            </div>
          )}
          {verification.status === "rejected" && (
            <div className="alert alert-error" style={{ marginBottom: "16px" }}>
              ❌ <strong>Vendor application rejected.</strong>{" "}
              {verification.rejection_reason && <span>Reason: {verification.rejection_reason}. </span>}
              <Link href="/kyc" style={{ color: "var(--danger)", fontWeight: 700 }}>Re-apply with full KYC →</Link>
            </div>
          )}
        </>
      )}

      {/* Verification Status Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }} className="verification-grid">
        <div className="card" style={{ borderLeft: `3px solid ${verification?.kyc_verified ? "var(--success)" : "var(--warning)"}` }}>
          <div className="card-body" style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "2px" }}>🪪 KYC Verification</p>
                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  {verification?.kyc_verified
                    ? `Level ${verification?.kyc_level || 1} verified`
                    : "Identity not yet verified"}
                </p>
              </div>
              <span className={`badge ${verification?.kyc_verified ? "badge-success" : "badge-warning"}`}>
                {verification?.kyc_verified ? "✓ Verified" : "Pending"}
              </span>
            </div>
            <Link href="/kyc" className="btn btn-outline btn-sm" style={{ marginTop: "10px", width: "100%", textAlign: "center", display: "block" }}>
              {verification?.kyc_verified ? "Manage KYC →" : "Complete KYC →"}
            </Link>
          </div>
        </div>

        <div className="card" style={{ borderLeft: `3px solid ${verification?.can_deliver ? "var(--success)" : "var(--dz-blue)"}` }}>
          <div className="card-body" style={{ padding: "14px 16px" }}>
            <p style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "2px" }}>⚡ Delivery Agent</p>
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "8px" }}>
              {verification?.can_deliver ? "Active DUNAZOE Express agent" : "Earn by delivering orders"}
            </p>
            <span className={`badge ${verification?.can_deliver ? "badge-success" : "badge-info"}`} style={{ marginBottom: "8px" }}>
              {verification?.can_deliver ? "✓ Active Agent" : "Not registered"}
            </span>
            <Link href="/deliver" className="btn btn-outline btn-sm" style={{ marginTop: "6px", width: "100%", textAlign: "center", display: "block" }}>
              {verification?.can_deliver ? "Delivery Hub →" : "Register as Agent →"}
            </Link>
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

      {/* Milestone Bonus Progress */}
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

      {/* My Products */}
      <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "14px" }}>My Products</h2>
      {loading ? (
        <div className="grid-auto">{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: "120px", borderRadius: "14px" }} />)}</div>
      ) : products.length > 0 ? (
        <div className="grid-auto" style={{ marginBottom: "32px" }}>
          {products.map(p => {
            const productId = `PRD-${String(p.id).padStart(5, "0")}`;
            // Parse first image
            let imgSrc = null;
            if (p.images) {
              if (typeof p.images === "string") {
                try { const a = JSON.parse(p.images); imgSrc = Array.isArray(a) ? a[0] : p.images; } catch { imgSrc = p.images; }
              } else if (Array.isArray(p.images)) { imgSrc = p.images[0]; }
            }
            return (
              <div key={p.id} className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {/* Product image */}
                <div style={{
                  width: "100%", height: "140px", flexShrink: 0,
                  background: imgSrc ? `url(${imgSrc}) center/cover no-repeat` : "var(--bg-3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  position: "relative",
                }}>
                  {!imgSrc && <span style={{ fontSize: "2.2rem", opacity: 0.2 }}>📦</span>}
                  <span style={{
                    position: "absolute", top: "8px", left: "8px",
                    fontFamily: "monospace", fontWeight: 700, fontSize: "0.68rem",
                    color: "var(--dz-blue)", background: "rgba(0,0,0,0.6)",
                    padding: "2px 8px", borderRadius: "6px", backdropFilter: "blur(4px)",
                  }}>{productId}</span>
                  <span className={`badge badge-${p.status === "published" ? "success" : "muted"}`}
                    style={{ position: "absolute", top: "8px", right: "8px", fontSize: "0.62rem" }}>
                    {p.status || "published"}
                  </span>
                </div>
                <div className="card-body" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.category || "—"}
                  </p>
                  <p className="text-gradient" style={{ fontWeight: 800, fontSize: "1rem" }}>₦{parseFloat(p.price || 0).toLocaleString("en-NG")}</p>
                  {/* Action buttons row 1: Edit / Delete */}
                  <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                    <button onClick={() => openEdit(p)} className="btn btn-outline btn-sm" style={{ flex: 1, fontSize: "0.72rem", padding: "5px" }}>
                      ✏️ Edit
                    </button>
                    <button onClick={() => setDeleteTarget(p)} className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: "0.72rem", padding: "5px", color: "var(--danger)" }}>
                      🗑️ Remove
                    </button>
                  </div>
                  {/* Action buttons row 2: Share / Copy / View */}
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={() => shareProduct(p)} className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: "0.68rem", padding: "4px" }}>
                      📤 Share
                    </button>
                    <button onClick={() => copyLink(p)} className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: "0.68rem", padding: "4px" }}>
                      {copiedId === p.id ? "✅" : "🔗 Copy"}
                    </button>
                    <Link href={`/products/${p.id}`} className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: "0.68rem", padding: "4px", textAlign: "center" }}>
                      👁 View
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "40px 24px", marginBottom: "32px" }}>
          <p style={{ fontSize: "1.5rem", marginBottom: "8px" }}>📦</p>
          <p style={{ fontWeight: 600, marginBottom: "4px" }}>No products yet</p>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "16px" }}>Add your first product to start selling</p>
          <Link href="/vendor/onboard" className="btn btn-primary btn-sm">+ Add Product</Link>
        </div>
      )}

      {/* Recent Orders */}
      {orders.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "14px" }}>Recent Orders</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "32px" }}>
            {orders.slice(0, 5).map(o => {
              const orderId = `ORD-${String(o.id).padStart(5, "0")}`;
              return (
                <div key={o.id} className="card">
                  <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", flexWrap: "wrap", gap: "8px" }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: "0.88rem", fontFamily: "monospace" }}>{orderId}</p>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{o.created_at ? new Date(o.created_at).toLocaleDateString("en-NG") : "—"}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span className={`badge badge-${STATUS_BADGE[o.status] || "info"}`}>{o.status || "pending"}</span>
                      <p style={{ fontSize: "0.88rem", fontWeight: 700 }}>₦{parseFloat(o.total || 0).toLocaleString("en-NG")}</p>
                      <Link href={`/track?order=${o.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: "0.72rem" }}>📍 Track</Link>
                      <Link href={`/orders/${o.id}`} className="btn btn-outline btn-sm" style={{ fontSize: "0.72rem" }}>View →</Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── EDIT PRODUCT MODAL ──────────────────────────────────────────────── */}
      {editProduct && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
          onClick={e => { if (e.target === e.currentTarget) setEditProduct(null); }}>
          <div className="card" style={{ width: "100%", maxWidth: "480px", maxHeight: "90vh", overflow: "auto" }}>
            <div className="card-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontWeight: 700 }}>✏️ Edit Product</h3>
                <button onClick={() => setEditProduct(null)} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "var(--text-muted)" }}>✕</button>
              </div>
              {editMsg.text && (
                <div className={`alert alert-${editMsg.type === "success" ? "success" : "error"}`} style={{ marginBottom: "14px" }}>
                  {editMsg.text}
                </div>
              )}
              <form onSubmit={handleEditSave} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {[
                  { key: "name",        label: "Product Name *",    type: "text",   required: true },
                  { key: "price",       label: "Price (₦) *",       type: "number", required: true, min: "0", step: "0.01" },
                  { key: "stock",       label: "Stock / Quantity",  type: "number", min: "0", step: "1" },
                  { key: "category",    label: "Category",          type: "text" },
                  { key: "weight",      label: "Weight (kg)",       type: "number", min: "0", step: "0.01" },
                ].map(({ key, label, type, required, min, step }) => (
                  <div key={key} className="form-group">
                    <label className="form-label">{label}</label>
                    <input className="form-input" type={type} required={!!required} min={min} step={step}
                      value={editForm[key] ?? ""}
                      onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-input" rows={3} style={{ resize: "vertical" }}
                    value={editForm.description || ""}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button type="button" onClick={() => setEditProduct(null)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" disabled={editLoading} className="btn btn-primary" style={{ flex: 2 }}>
                    {editLoading ? "Saving…" : "💾 Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ───────────────────────────────────────── */}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div className="card" style={{ width: "100%", maxWidth: "380px" }}>
            <div className="card-body" style={{ textAlign: "center", padding: "28px 24px" }}>
              <span style={{ fontSize: "2.4rem", display: "block", marginBottom: "12px" }}>🗑️</span>
              <h3 style={{ fontWeight: 700, marginBottom: "8px" }}>Remove Product?</h3>
              <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginBottom: "20px" }}>
                "<strong>{deleteTarget.name}</strong>" will be hidden from buyers. Admins can restore it later.
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => setDeleteTarget(null)} className="btn btn-ghost" style={{ flex: 1 }}>Keep It</button>
                <button onClick={() => handleSoftDelete(deleteTarget)} disabled={deleteLoading}
                  className="btn btn-primary" style={{ flex: 1, background: "var(--danger)", border: "none" }}>
                  {deleteLoading ? "Removing…" : "Yes, Remove"}
                </button>
              </div>
            </div>
          </div>
        </div>
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
