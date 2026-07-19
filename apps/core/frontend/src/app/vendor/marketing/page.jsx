"use client";
/**
 * DUNAZOE Marketing AI — Vendor-only page
 * Generate product descriptions, social captions, WhatsApp posts,
 * ad copy, and SEO keywords using the AI service.
 * Access restricted to vendor and admin roles only.
 */
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const FORMATS = [
  { id: "whatsapp",    icon: "📱", label: "WhatsApp Post",    desc: "Short, viral, with emoji" },
  { id: "instagram",   icon: "📸", label: "Instagram Caption", desc: "Hashtags + story hook" },
  { id: "facebook",    icon: "👥", label: "Facebook Ad",       desc: "Engagement + CTA" },
  { id: "twitter",     icon: "𝕏",  label: "X / Twitter",       desc: "Under 280 chars" },
  { id: "product_desc",icon: "📄", label: "Product Description",desc: "SEO-rich listing copy" },
  { id: "email",       icon: "📧", label: "Email Campaign",     desc: "Subject line + body" },
];

const TONES = ["Friendly","Professional","Urgent","Luxury","Playful","Bold"];

export default function MarketingAIPage() {
  const [products, setProducts]   = useState([]);
  const [product,  setProduct]    = useState(null);
  const [format,   setFormat]     = useState("whatsapp");
  const [tone,     setTone]       = useState("Friendly");
  const [promo,    setPromo]      = useState("");
  const [result,   setResult]     = useState(null);
  const [loading,  setLoading]    = useState(false);
  const [error,    setError]      = useState("");
  const [copied,   setCopied]     = useState(false);
  const [role,     setRole]       = useState(null); // null = loading

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("dunazoe_user") || "{}");
      setRole(u.role || "user");
    } catch (_) { setRole("user"); }

    const token = localStorage.getItem("dunazoe_token");
    if (!token) return;
    fetch(`${API}/products?vendor=me&limit=30`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setProducts(d.products || []))
      .catch(() => {});
  }, []);

  // ── Access control: vendors and admins only ──────────────────────────────────
  const VENDOR_ROLES = ["vendor", "direct_vendor", "copytrader_vendor", "delivery_vendor", "hybrid_vendor",
    "admin", "super_admin", "head_of_store", "head_of_vendors", "head_of_marketing", "cto", "ceo"];

  const hasAccess = role !== null && (VENDOR_ROLES.some(r => role?.toLowerCase().includes(r.split("_")[0])) || role === "vendor");

  if (role !== null && !hasAccess) {
    return (
      <PageShell title="Marketing AI" icon="📣" authRequired={true}>
        <div className="empty-state">
          <span className="empty-icon">🔒</span>
          <p className="empty-title">Vendors only</p>
          <p className="empty-body">Marketing AI is available to registered vendors. Become a vendor to access AI-powered marketing tools.</p>
          <Link href="/vendor/onboard" className="btn btn-primary">Become a Vendor →</Link>
        </div>
      </PageShell>
    );
  }

  async function generate() {
    if (!product) { setError("Select a product first."); return; }
    setError(""); setLoading(true); setResult(null);
    try {
      const token = localStorage.getItem("dunazoe_token");
      const r = await fetch(`${API}/ops/product-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: product.name, category: product.category,
          price: product.price, description: product.description,
          format, tone, promo,
        }),
      });
      const d = await r.json();
      if (d.success || d.content) {
        setResult(d.content || d.result || d.text || JSON.stringify(d));
      } else {
        setError(d.error || "Generation failed. Please try again.");
      }
    } catch (_) {
      setError("Connection error. Check that your AI service is running.");
    } finally { setLoading(false); }
  }

  function copy() {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (role === null) {
    return (
      <PageShell title="Marketing AI" icon="📣" authRequired={true}>
        <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
          <span className="dz-spinner" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Marketing AI" icon="📣" authRequired={true}
      subtitle="Generate viral content for your products in seconds"
      breadcrumb={[{ href: "/vendor/dashboard", label: "Dashboard" }, { label: "Marketing AI" }]}>

      {error && <div className="alert alert-error" style={{ marginBottom: "20px" }}>⚠️ {error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Product picker */}
          <div className="card"><div className="card-body">
            <p style={{ fontWeight: 700, marginBottom: "12px" }}>1. Select Product</p>
            {products.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No products found. <Link href="/vendor/onboard" className="dz-link">Add a product first →</Link></p>
            ) : (
              <select className="form-input" value={product?.id || ""} onChange={e => setProduct(products.find(p => String(p.id) === e.target.value) || null)}>
                <option value="">— Choose a product —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div></div>

          {/* Format */}
          <div className="card"><div className="card-body">
            <p style={{ fontWeight: 700, marginBottom: "12px" }}>2. Content Format</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {FORMATS.map(f => (
                <button key={f.id} type="button" onClick={() => setFormat(f.id)} style={{
                  display: "flex", gap: "12px", alignItems: "center", padding: "10px 14px",
                  borderRadius: "10px", cursor: "pointer", textAlign: "left", width: "100%",
                  border: `1.5px solid ${format === f.id ? "var(--dz-blue)" : "var(--border)"}`,
                  background: format === f.id ? "rgba(0,163,255,0.08)" : "transparent",
                }}>
                  <span style={{ fontSize: "1.2rem" }}>{f.icon}</span>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: "0.88rem", color: format === f.id ? "var(--dz-blue)" : "var(--text)" }}>{f.label}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{f.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div></div>

          {/* Tone */}
          <div className="card"><div className="card-body">
            <p style={{ fontWeight: 700, marginBottom: "12px" }}>3. Tone</p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {TONES.map(t => (
                <button key={t} type="button" onClick={() => setTone(t)} className={`btn btn-sm ${tone === t ? "btn-primary" : "btn-ghost"}`}>{t}</button>
              ))}
            </div>
          </div></div>

          {/* Promo (optional) */}
          <div className="card"><div className="card-body">
            <p style={{ fontWeight: 700, marginBottom: "8px" }}>4. Promo / Offer <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span></p>
            <input className="form-input" value={promo} onChange={e => setPromo(e.target.value)}
              placeholder="e.g. 10% off this weekend only" />
          </div></div>

          <button onClick={generate} disabled={loading || !product} className="btn btn-primary btn-lg" style={{ justifyContent: "center" }}>
            {loading ? "Generating…" : "✨ Generate Content"}
          </button>
        </div>

        {/* Result */}
        <div className="card" style={{ minHeight: "300px" }}>
          <div className="card-body">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <p style={{ fontWeight: 700 }}>Generated Content</p>
              {result && (
                <button onClick={copy} className="btn btn-outline btn-sm">
                  {copied ? "✅ Copied!" : "📋 Copy"}
                </button>
              )}
            </div>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: "18px", borderRadius: "6px", width: `${[90,70,80,60][i-1]}%` }} />)}
              </div>
            ) : result ? (
              <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.88rem", lineHeight: 1.7, color: "var(--text)", fontFamily: "inherit" }}>{result}</pre>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                <p style={{ fontSize: "2rem", marginBottom: "10px" }}>📣</p>
                <p style={{ fontSize: "0.85rem" }}>Select a product and click Generate to create viral marketing content.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
