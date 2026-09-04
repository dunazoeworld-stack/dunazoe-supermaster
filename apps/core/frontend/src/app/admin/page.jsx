"use client";
/**
 * DUNAZOE Superuser Control Center
 * Roles: SUPERUSER, ADMIN, OPERATOR, VIEWER
 * Tabs: Overview · Users · Vendors · Products · Orders · Payments · Disputes
 */
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const ROLE_LEVEL = { super_admin: 4, admin: 3, coordinator: 2, operator: 1 };
const ALLOWED_ROLES = ["admin", "super_admin", "coordinator", "operator"];

function RoleBadge({ role }) {
  const colors = {
    super_admin: { bg: "rgba(155,93,229,0.15)", color: "#9B5DE5", border: "rgba(155,93,229,0.3)" },
    admin:       { bg: "rgba(0,163,255,0.15)",  color: "var(--dz-blue)", border: "rgba(0,163,255,0.3)" },
    coordinator: { bg: "rgba(0,200,150,0.15)",  color: "var(--success)", border: "rgba(0,200,150,0.3)" },
    operator:    { bg: "rgba(255,159,0,0.15)",   color: "var(--warning)", border: "rgba(255,159,0,0.3)" },
    user:        { bg: "var(--surface)", color: "var(--text-muted)", border: "var(--border)" },
    vendor:      { bg: "rgba(0,200,224,0.12)",   color: "#00C8E0",        border: "rgba(0,200,224,0.3)" },
  };
  const s = colors[role] || colors.user;
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "999px", fontSize: "0.68rem", fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {(role || "user").replace(/_/g, " ").toUpperCase()}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    active:    "badge-success", approved: "badge-success", published: "badge-success", paid: "badge-success", resolved: "badge-success",
    pending:   "badge-warning", processing: "badge-warning", under_review: "badge-warning",
    suspended: "badge-danger",  cancelled: "badge-danger",  rejected: "badge-danger", failed: "badge-danger",
    open:      "badge-info",    shipped: "badge-info",
    hidden:    "badge-muted",   closed: "badge-muted",
  };
  return <span className={`badge ${map[status] || "badge-muted"}`}>{(status || "—").replace(/_/g, " ")}</span>;
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="stat-tile">
      <p style={{ fontSize: "1.4rem", marginBottom: "4px" }}>{icon}</p>
      <p className="stat-value" style={{ fontSize: "1.5rem", color: color || undefined, background: color ? "none" : undefined, WebkitTextFillColor: color || undefined }}>
        {value ?? "—"}
      </p>
      <p className="stat-label">{label}</p>
      {sub && <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>{sub}</p>}
    </div>
  );
}

export default function SuperuserPage() {
  const [user,   setUser]   = useState(null);
  const [tab,    setTab]    = useState("overview");
  const [stats,  setStats]  = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Per-tab data
  const [users,      setUsers]      = useState([]);
  const [vendors,    setVendors]    = useState([]);
  const [products,   setProducts]   = useState([]);
  const [orders,     setOrders]     = useState([]);
  const [payments,   setPayments]   = useState([]);
  const [disputes,   setDisputes]   = useState([]);
  const [tabLoading, setTabLoading] = useState(false);

  // Search/filter
  const [search, setSearch] = useState("");

  // Action feedback
  const [actionMsg, setActionMsg] = useState({ type: "", text: "" });

  const token = typeof window !== "undefined" ? localStorage.getItem("dunazoe_token") || "" : "";
  const authH = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem("dunazoe_user") || "{}"); setUser(u); } catch (_) {}
    fetch(`${API}/admin/stats`, { headers: authH })
      .then(r => r.json())
      .then(d => setStats(d.stats || d))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  const loadTab = useCallback(async (t) => {
    setTabLoading(true); setActionMsg({ type: "", text: "" }); setSearch("");
    try {
      const h = { headers: authH };
      if (t === "users") {
        const d = await fetch(`${API}/admin/users?limit=50`, h).then(r => r.json()).catch(() => ({}));
        setUsers(d.users || []);
      } else if (t === "vendors") {
        const d = await fetch(`${API}/admin/vendors?limit=50`, h).then(r => r.json()).catch(() => ({}));
        setVendors(d.vendors || []);
      } else if (t === "products") {
        const d = await fetch(`${API}/products?limit=50&sort=newest`, h).then(r => r.json()).catch(() => ({}));
        setProducts(d.products || []);
      } else if (t === "orders") {
        const d = await fetch(`${API}/orders?limit=50`, h).then(r => r.json()).catch(() => ({}));
        setOrders(d.orders || []);
      } else if (t === "payments") {
        const d = await fetch(`${API}/admin/transactions?limit=50`, h).then(r => r.json()).catch(() => ({}));
        setPayments(d.transactions || d.payments || []);
      } else if (t === "disputes") {
        const d = await fetch(`${API}/admin/disputes?limit=50`, h).then(r => r.json()).catch(() => ({}));
        setDisputes(d.disputes || []);
      }
    } catch (_) {}
    finally { setTabLoading(false); }
  }, [token]);

  useEffect(() => { if (tab !== "overview") loadTab(tab); }, [tab]);

  async function doAction(endpoint, payload, successMsg) {
    setActionMsg({ type: "", text: "" });
    try {
      const res = await fetch(`${API}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (d.success || res.ok) {
        setActionMsg({ type: "success", text: successMsg || d.message || "Action completed." });
        await loadTab(tab);
      } else {
        setActionMsg({ type: "error", text: d.error || "Action failed." });
      }
    } catch (_) {
      setActionMsg({ type: "error", text: "Connection error. Please try again." });
    }
  }

  const isAuthorized = user && ALLOWED_ROLES.includes(user.role);
  const isSuperuser  = user && ["super_admin"].includes(user.role);
  const roleLevel    = ROLE_LEVEL[user?.role] || 0;

  const TABS = [
    { id: "overview",  icon: "📊", label: "Overview"  },
    { id: "users",     icon: "👥", label: "Users"     },
    { id: "vendors",   icon: "🏪", label: "Vendors"   },
    { id: "products",  icon: "📦", label: "Products"  },
    { id: "orders",    icon: "🛒", label: "Orders"    },
    { id: "payments",  icon: "💰", label: "Payments"  },
    { id: "disputes",  icon: "⚖️", label: "Disputes"  },
  ];

  const fmtN  = n => n != null ? Number(n).toLocaleString("en-NG") : "—";
  const fmtNg = n => n != null ? `₦${parseFloat(n).toLocaleString("en-NG")}` : "—";
  const fmtD  = s => s ? new Date(s).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  // Short ID helpers
  const ordId  = id => `ORD-${String(id).padStart(5,"0")}`;
  const prdId  = id => `PRD-${String(id).padStart(5,"0")}`;
  const vndId  = id => `VND-${String(id).padStart(5,"0")}`;
  const payId  = id => `PAY-${String(id).padStart(5,"0")}`;
  const txnId  = id => `TXN-${String(id).padStart(5,"0")}`;

  // Filter helpers
  const filterUsers    = users.filter(u => !search || (u.name||u.email||"").toLowerCase().includes(search.toLowerCase()));
  const filterVendors  = vendors.filter(v => !search || (v.business_name||v.name||"").toLowerCase().includes(search.toLowerCase()));
  const filterProducts = products.filter(p => !search || (p.name||"").toLowerCase().includes(search.toLowerCase()));
  const filterOrders   = orders.filter(o => !search || String(o.id).includes(search) || (o.status||"").includes(search));
  const filterPayments = payments.filter(p => !search || (p.reference||"").toLowerCase().includes(search.toLowerCase()) || (p.type||"").includes(search));
  const filterDisputes = disputes.filter(d => !search || (d.reason||"").includes(search) || (d.status||"").includes(search));

  return (
    <PageShell title="Superuser Control Center" icon="⚙️" authRequired={true}
      subtitle="Platform management · Full control over users, vendors, products, orders & payments">

      {/* Access Warning */}
      {user && !isAuthorized && (
        <div className="alert alert-error" style={{ marginBottom: "20px" }}>
          🔒 <strong>Access Restricted.</strong> You need ADMIN or SUPERUSER access to use this control center.
          Current role: <RoleBadge role={user.role} />
        </div>
      )}

      {/* Current Session Info */}
      {user && (
        <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "20px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>Logged in as:</span>
          <strong style={{ fontSize: "0.88rem" }}>{user.name || user.email || "Unknown"}</strong>
          <RoleBadge role={user.role} />
          {isSuperuser && (
            <span style={{ fontSize: "0.72rem", background: "rgba(155,93,229,0.12)", color: "#9B5DE5", padding: "2px 10px", borderRadius: "999px", border: "1px solid rgba(155,93,229,0.3)", fontWeight: 700 }}>
              🔑 FULL ACCESS
            </span>
          )}
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "24px", flexWrap: "wrap", overflowX: "auto", paddingBottom: "4px" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 14px", borderRadius: "10px", border: "none", cursor: "pointer",
            fontWeight: 600, fontSize: "0.82rem", whiteSpace: "nowrap",
            background: tab === t.id ? "var(--dz-gradient)" : "var(--surface)",
            color: tab === t.id ? "#fff" : "var(--text-secondary)",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Action feedback */}
      {actionMsg.text && (
        <div className={`alert alert-${actionMsg.type === "success" ? "success" : "error"}`} style={{ marginBottom: "16px" }}>
          {actionMsg.type === "success" ? "✅ " : "⚠️ "}{actionMsg.text}
        </div>
      )}

      {/* ═══════════════ OVERVIEW TAB ═══════════════════════════════════════ */}
      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Stats grid */}
          {statsLoading ? (
            <div className="grid-3">{[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: "100px", borderRadius: "16px" }} />)}</div>
          ) : (
            <div className="grid-3">
              <StatCard icon="👥" label="Total Users"      value={fmtN(stats?.total_users)} />
              <StatCard icon="🏪" label="Vendors"          value={fmtN(stats?.total_vendors)} />
              <StatCard icon="📦" label="Total Orders"     value={fmtN(stats?.total_orders)} />
              <StatCard icon="₦"  label="Platform Revenue" value={fmtNg(stats?.total_revenue)} />
              <StatCard icon="⚖️" label="Open Disputes"    value={fmtN(stats?.open_disputes)} color={stats?.open_disputes > 0 ? "var(--warning)" : undefined} />
              <StatCard icon="⬡"  label="Active Personal Savings Groups" value={fmtN(stats?.active_thrift)} />
            </div>
          )}

          {/* Quick Access links */}
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700 }}>Quick Access</h2>
          <div className="grid-2">
            {[
              { href: "/ops",           icon: "🛸", label: "Operator Cockpit",  desc: "Deployment & DevOps AI" },
              { href: "/deploy",        icon: "🚀", label: "Deploy Control",    desc: "Deploy & manage services" },
              { href: "/deploy/studio", icon: "🏗️", label: "Build Studio",      desc: "Service build status" },
              { href: "/deploy/apis",   icon: "⚡", label: "API Center",        desc: "Manage API keys" },
              { href: "/deploy/features", icon: "🔘", label: "Feature Flags",  desc: "Toggle features on/off" },
              { href: "/deploy/health", icon: "🩺", label: "Health Monitor",   desc: "System health checks" },
            ].map(({ href, icon, label, desc }) => (
              <Link key={href} href={href} className="card" style={{ textDecoration: "none" }}>
                <div className="card-body" style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                  <span style={{ fontSize: "1.8rem" }}>{icon}</span>
                  <div><p style={{ fontWeight: 700 }}>{label}</p><p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{desc}</p></div>
                  <span style={{ marginLeft: "auto", color: "var(--dz-blue)" }}>→</span>
                </div>
              </Link>
            ))}
          </div>

          {/* RBAC Role Matrix */}
          <div className="card">
            <div className="card-body">
              <h3 style={{ fontWeight: 700, marginBottom: "14px" }}>🔑 Role Permission Matrix</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["Permission", "VIEWER", "OPERATOR", "ADMIN", "SUPERUSER"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["View statistics",     "✅","✅","✅","✅"],
                      ["Manage users",        "❌","✅","✅","✅"],
                      ["Approve vendors",     "❌","✅","✅","✅"],
                      ["Approve products",    "❌","✅","✅","✅"],
                      ["Process refunds",     "❌","❌","✅","✅"],
                      ["Create admins",       "❌","❌","❌","✅"],
                      ["System config",       "❌","❌","❌","✅"],
                      ["Audit all actions",   "❌","❌","✅","✅"],
                    ].map(([perm, ...vals]) => (
                      <tr key={perm} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>{perm}</td>
                        {vals.map((v, i) => (
                          <td key={i} style={{ padding: "8px 12px", textAlign: "center" }}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ USERS TAB ══════════════════════════════════════════ */}
      {tab === "users" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <input className="form-input" placeholder="Search by name or email…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: "200px" }} />
            <button onClick={() => loadTab("users")} className="btn btn-outline btn-sm">↻ Refresh</button>
          </div>
          {tabLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: "72px", borderRadius: "12px" }} />)}
            </div>
          ) : filterUsers.length === 0 ? (
            <div className="empty-state" style={{ padding: "40px" }}>
              <span className="empty-icon">👥</span>
              <p className="empty-title">No users found</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filterUsers.map(u => (
                <div key={u.id} className="card">
                  <div className="card-body" style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: "var(--dz-gradient-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "1rem", border: "1px solid var(--border)" }}>
                        {(u.name || u.email || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: "0.88rem" }}>{u.name || "—"}</p>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{u.email}</p>
                        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Joined {fmtD(u.created_at)}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      <RoleBadge role={u.role} />
                      <StatusBadge status={u.status || "active"} />
                      {roleLevel >= 2 && (
                        <>
                          <button onClick={() => doAction("ops/accounts/" + u.id + "/suspend", {}, `User ${u.name || u.email} suspended.`)}
                            className="btn btn-danger btn-sm" style={{ fontSize: "0.72rem" }}>
                            🚫 Suspend
                          </button>
                          <button onClick={() => doAction("ops/accounts/" + u.id + "/verify", {}, `User ${u.name || u.email} verified.`)}
                            className="btn btn-outline btn-sm" style={{ fontSize: "0.72rem" }}>
                            ✅ Verify
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ VENDORS TAB ════════════════════════════════════════ */}
      {tab === "vendors" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <input className="form-input" placeholder="Search vendors…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: "200px" }} />
            <button onClick={() => loadTab("vendors")} className="btn btn-outline btn-sm">↻ Refresh</button>
          </div>
          {tabLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: "90px", borderRadius: "12px" }} />)}
            </div>
          ) : filterVendors.length === 0 ? (
            <div className="empty-state" style={{ padding: "40px" }}>
              <span className="empty-icon">🏪</span>
              <p className="empty-title">No vendors found</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filterVendors.map(v => (
                <div key={v.id} className="card">
                  <div className="card-body" style={{ padding: "14px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        {v.logo_url ? (
                          <img src={v.logo_url} alt="logo" style={{ width: "40px", height: "40px", borderRadius: "8px", objectFit: "cover", border: "1px solid var(--border)" }} />
                        ) : (
                          <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "var(--dz-gradient-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", border: "1px solid var(--border)" }}>🏪</div>
                        )}
                        <div>
                          <p style={{ fontWeight: 700 }}>{v.business_name || v.name}</p>
                          <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{vndId(v.id)} · {v.state || "—"}, {v.city || "—"}</p>
                          <p style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{v.type || "direct"} · {fmtD(v.created_at)}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                        <StatusBadge status={v.status || v.kyc_status || "pending"} />
                        {roleLevel >= 2 && (
                          <>
                            <button onClick={() => doAction("ops/accounts/" + v.user_id + "/verify", { vendor_id: v.id }, `Vendor ${v.business_name} approved.`)}
                              className="btn btn-outline btn-sm" style={{ fontSize: "0.72rem" }}>
                              ✅ Approve
                            </button>
                            <button onClick={() => doAction("ops/accounts/" + v.user_id + "/suspend", { vendor_id: v.id }, `Vendor ${v.business_name} suspended.`)}
                              className="btn btn-danger btn-sm" style={{ fontSize: "0.72rem" }}>
                              🚫 Suspend
                            </button>
                          </>
                        )}
                        <Link href={`/products?vendor=${v.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: "0.72rem" }}>
                          View Products →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ PRODUCTS TAB ═══════════════════════════════════════ */}
      {tab === "products" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <input className="form-input" placeholder="Search products…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: "200px" }} />
            <button onClick={() => loadTab("products")} className="btn btn-outline btn-sm">↻ Refresh</button>
          </div>
          {tabLoading ? (
            <div className="grid-auto">{[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: "200px", borderRadius: "14px" }} />)}</div>
          ) : filterProducts.length === 0 ? (
            <div className="empty-state" style={{ padding: "40px" }}>
              <span className="empty-icon">📦</span>
              <p className="empty-title">No products found</p>
            </div>
          ) : (
            <div className="grid-auto">
              {filterProducts.map(p => {
                let imgSrc = null;
                if (p.images) {
                  if (typeof p.images === "string") { try { const a = JSON.parse(p.images); imgSrc = Array.isArray(a) ? a[0] : p.images; } catch { imgSrc = p.images; } }
                  else if (Array.isArray(p.images)) imgSrc = p.images[0];
                }
                return (
                  <div key={p.id} className="card" style={{ overflow: "hidden" }}>
                    <div style={{ height: "130px", background: imgSrc ? `url(${imgSrc}) center/cover no-repeat` : "var(--bg-3)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                      {!imgSrc && <span style={{ fontSize: "2rem", opacity: 0.2 }}>📦</span>}
                      <span style={{ position: "absolute", top: "6px", left: "6px", fontFamily: "monospace", fontSize: "0.65rem", fontWeight: 700, color: "var(--dz-blue)", background: "rgba(0,0,0,0.6)", padding: "2px 7px", borderRadius: "5px" }}>
                        {prdId(p.id)}
                      </span>
                      <span style={{ position: "absolute", top: "6px", right: "6px" }}><StatusBadge status={p.status || "published"} /></span>
                    </div>
                    <div className="card-body" style={{ padding: "10px 12px" }}>
                      <p style={{ fontWeight: 700, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                      <p style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginBottom: "6px" }}>{p.category} · {vndId(p.vendor_id)}</p>
                      <p style={{ fontWeight: 800, fontSize: "0.9rem", background: "var(--dz-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: "8px" }}>
                        ₦{parseFloat(p.price || 0).toLocaleString("en-NG")}
                      </p>
                      {roleLevel >= 2 && (
                        <div style={{ display: "flex", gap: "5px" }}>
                          <button onClick={() => doAction("admin/products/" + p.id + "/approve", {}, `${p.name} approved.`)}
                            className="btn btn-outline btn-sm" style={{ flex: 1, fontSize: "0.68rem", padding: "4px" }}>✅ Approve</button>
                          <button onClick={() => doAction("admin/products/" + p.id + "/hide", {}, `${p.name} hidden.`)}
                            className="btn btn-danger btn-sm" style={{ flex: 1, fontSize: "0.68rem", padding: "4px" }}>🙈 Hide</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ ORDERS TAB ═════════════════════════════════════════ */}
      {tab === "orders" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <input className="form-input" placeholder="Search by order ID or status…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: "200px" }} />
            <button onClick={() => loadTab("orders")} className="btn btn-outline btn-sm">↻ Refresh</button>
          </div>
          {tabLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: "80px", borderRadius: "12px" }} />)}
            </div>
          ) : filterOrders.length === 0 ? (
            <div className="empty-state" style={{ padding: "40px" }}><span className="empty-icon">🛒</span><p className="empty-title">No orders found</p></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filterOrders.map(o => (
                <div key={o.id} className="card">
                  <div className="card-body" style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <p style={{ fontWeight: 700, fontFamily: "monospace", fontSize: "0.88rem" }}>{ordId(o.id)}</p>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        {o.customer_name || "—"} → Vendor {vndId(o.vendor_id || 0)}
                      </p>
                      <p style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{fmtD(o.created_at)}</p>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      <StatusBadge status={o.status} />
                      <span style={{ fontWeight: 800, background: "var(--dz-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                        {fmtNg(o.total)}
                      </span>
                      <Link href={`/orders/${o.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: "0.72rem" }}>View →</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ PAYMENTS TAB ═══════════════════════════════════════ */}
      {tab === "payments" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <input className="form-input" placeholder="Search by reference or type…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: "200px" }} />
            <button onClick={() => loadTab("payments")} className="btn btn-outline btn-sm">↻ Refresh</button>
          </div>
          {/* Payment summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: "10px" }}>
            {[
              { icon: "💳", label: "Total Transactions", val: fmtN(payments.length) },
              { icon: "✅", label: "Successful",         val: fmtN(payments.filter(p => p.status === "success" || p.status === "completed").length), color: "var(--success)" },
              { icon: "❌", label: "Failed",             val: fmtN(payments.filter(p => p.status === "failed").length), color: "var(--danger)" },
              { icon: "⏳", label: "Pending",            val: fmtN(payments.filter(p => p.status === "pending").length), color: "var(--warning)" },
            ].map(s => (
              <div key={s.label} className="stat-tile">
                <p style={{ fontSize: "1.2rem" }}>{s.icon}</p>
                <p className="stat-value" style={{ fontSize: "1.3rem", background: "none", WebkitTextFillColor: s.color || "var(--dz-blue)", color: s.color }}>{s.val}</p>
                <p className="stat-label">{s.label}</p>
              </div>
            ))}
          </div>
          {tabLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: "72px", borderRadius: "12px" }} />)}
            </div>
          ) : filterPayments.length === 0 ? (
            <div className="empty-state" style={{ padding: "40px" }}><span className="empty-icon">💰</span><p className="empty-title">No payment records</p></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filterPayments.map(p => (
                <div key={p.id || p.reference} className="card">
                  <div className="card-body" style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <p style={{ fontWeight: 700, fontFamily: "monospace", fontSize: "0.82rem" }}>{txnId(p.id || 0)}</p>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{p.reference || "—"} · {p.type || p.channel || "—"}</p>
                      <p style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{fmtD(p.created_at)}</p>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <StatusBadge status={p.status} />
                      <span style={{ fontWeight: 800, background: "var(--dz-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                        {fmtNg(p.amount)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ DISPUTES TAB ════════════════════════════════════════ */}
      {tab === "disputes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <input className="form-input" placeholder="Search by reason or status…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: "200px" }} />
            <button onClick={() => loadTab("disputes")} className="btn btn-outline btn-sm">↻ Refresh</button>
          </div>
          {tabLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: "80px", borderRadius: "12px" }} />)}
            </div>
          ) : filterDisputes.length === 0 ? (
            <div className="empty-state" style={{ padding: "40px" }}>
              <span className="empty-icon">⚖️</span>
              <p className="empty-title">No disputes found</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filterDisputes.map(d => (
                <div key={d.id} className="card">
                  <div className="card-body" style={{ padding: "14px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                      <div>
                        <p style={{ fontWeight: 700, fontFamily: "monospace", fontSize: "0.88rem" }}>DSP-{String(d.id).padStart(5,"0")}</p>
                        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                          Order {ordId(d.order_id || 0)} · {(d.reason || "—").replace(/_/g," ")}
                        </p>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>{d.description?.slice(0, 80)}{d.description?.length > 80 ? "…" : ""}</p>
                        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>Raised {fmtD(d.created_at)}</p>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                        <StatusBadge status={d.status || "open"} />
                        {roleLevel >= 2 && (
                          <>
                            <button onClick={() => doAction("disputes/" + d.id, { status: "under_review" }, `Dispute DSP-${String(d.id).padStart(5,"0")} set to Under Review.`)}
                              className="btn btn-outline btn-sm" style={{ fontSize: "0.72rem" }}>
                              🔍 Review
                            </button>
                            <button onClick={() => doAction("disputes/" + d.id, { status: "resolved" }, `Dispute DSP-${String(d.id).padStart(5,"0")} resolved.`)}
                              className="btn btn-outline btn-sm" style={{ fontSize: "0.72rem", borderColor: "var(--success)", color: "var(--success)" }}>
                              ✅ Resolve
                            </button>
                            <button onClick={() => doAction("disputes/" + d.id, { status: "escalated" }, `Dispute DSP-${String(d.id).padStart(5,"0")} escalated.`)}
                              className="btn btn-danger btn-sm" style={{ fontSize: "0.72rem" }}>
                              🔺 Escalate
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 600px) {
          .grid-3 { grid-template-columns: repeat(2, 1fr) !important; }
          .grid-2 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </PageShell>
  );
}
