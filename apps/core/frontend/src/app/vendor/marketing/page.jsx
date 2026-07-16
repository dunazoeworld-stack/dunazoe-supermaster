"use client";
/**
 * DUNAZOE Marketing AI — Vendor page
 * Generate product descriptions, social captions, WhatsApp posts,
 * ad copy, and SEO keywords using the AI service.
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

  useEffect(() => {
    const token = localStorage.getItem("dunazoe_token");
    if (!token) return;
    fetch(`${API}/products?vendor=me&limit=30`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setProducts(d.products || []))
      .catch(() => {});
  }, []);

  async function generate() {
    if (!product) { setError("Select a product first."); return; }
    setError(""); setLoading(true); setResult(null);
    try {
      const token = localStorage.getItem("dunazoe_token");
      // Try ops product-ai route first, then inline
      const r = await fetch(`${API}/ops/product-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          operation:   "marketing_copy",
          product_id:  product.id,
          product_name:product.name,
          category:    product.category,
          price:       product.price,
          description: product.description,
          format,
          tone,
          promo_text:  promo,
        }),
      });
      const d = await r.json();
      if (d.result || d.copy || d.content || d.text) {
        setResult(d.result || d.copy || d.content || d.text);
      } else {
        // Inline fallback — generate locally
        setResult(generateFallback(product, format, tone, promo));
      }
    } catch (_) {
      setResult(generateFallback(product, format, tone, promo));
    } finally { setLoading(false); }
  }

  function generateFallback(p, fmt, tn, promo) {
    const price = `₦${parseFloat(p.price || 0).toLocaleString("en-NG")}`;
    const link = p.shareable_link ? `https://${p.shareable_link}` : "dunazoe.com";
    const urgency = promo ? `🎉 ${promo}! ` : "";
    const map = {
      whatsapp: `${urgency}🛍️ *${p.name}* — only ${price}!\n\n✅ Escrow-protected\n✅ Fast delivery across Nigeria\n${p.ajo_enabled ? "⬡ Pay in installments with Ajo!\n" : ""}👉 Order now: ${link}\n\n📲 DM me to order or ask questions!`,
      instagram: `${urgency}${p.name} 🔥\n\n${p.description ? p.description.slice(0, 120) + "…" : "Top quality, unbeatable price!"}\n\nPrice: ${price}\n\n👉 Link in bio to shop\n\n#DUNAZOE #NigerianBusiness #ShopNaija #${(p.category || "").replace(/\W/g, "")} #MadeInNigeria`,
      facebook: `${urgency}🎯 Looking for the best deal on ${p.name}?\n\n💰 Price: ${price}\n${p.description ? `\n📦 ${p.description.slice(0, 200)}\n` : ""}\n🔒 100% Escrow Protected\n🚚 Nationwide Delivery\n${p.ajo_enabled ? "⬡ Buy Now, Pay Later with Ajo!\n" : ""}\n👉 Shop now: ${link}`,
      twitter: `${urgency}${p.name} at just ${price}! 🛍️ Escrow-protected, fast delivery. ${p.ajo_enabled ? "⬡ Ajo payment available! " : ""}👉 ${link} #DUNAZOE #NaijaShopping`,
      product_desc: `# ${p.name}\n\n${p.description || "Premium quality product available on DUNAZOE."}\n\n## Key Features\n- ✅ Price: ${price}\n- 📦 Fast delivery across Nigeria\n- 🔒 Escrow-protected transactions\n${p.ajo_enabled ? "- ⬡ Installment payment via Ajo\n" : ""}- ⭐ Trusted DUNAZOE vendor\n\n${promo ? `## Special Offer\n${promo}\n\n` : ""}Order at: ${link}`,
      email: `Subject: ${urgency}Don't Miss — ${p.name} at ${price}!\n\nHi there,\n\nWe're excited to offer you ${p.name} at just ${price}.\n\n${p.description ? p.description.slice(0, 300) : "Top quality, unbeatable value."}\n\n${promo ? `🎉 Special offer: ${promo}\n\n` : ""}Shop now with escrow protection: ${link}\n\nQuestions? Reply to this email or chat us on DUNAZOE.\n\nHappy shopping,\n${p.vendor_name || "Your DUNAZOE Vendor"}`,
    };
    return map[fmt] || map.whatsapp;
  }

  function copy() {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  function share(platform) {
    if (!result) return;
    const text = encodeURIComponent(result);
    const urls = {
      whatsapp:  `https://wa.me/?text=${text}`,
      twitter:   `https://twitter.com/intent/tweet?text=${text}`,
      facebook:  `https://www.facebook.com/sharer/sharer.php?quote=${text}`,
      instagram: null,
    };
    if (urls[platform]) window.open(urls[platform], "_blank");
  }

  return (
    <PageShell
      title="Marketing AI"
      icon="📣"
      authRequired={true}
      subtitle="Generate viral content for your products in seconds"
      breadcrumb={[{ href: "/vendor/dashboard", label: "Vendor Dashboard" }, { label: "Marketing AI" }]}
      actions={<Link href="/vendor/onboard" className="btn btn-primary btn-sm">+ Add Product</Link>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>

        {/* Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Product picker */}
          <div className="card"><div className="card-body">
            <h3 style={{ fontWeight: 700, marginBottom: "12px" }}>1. Select Product</h3>
            {products.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                <p style={{ fontSize: "0.85rem", marginBottom: "10px" }}>No products found.</p>
                <Link href="/vendor/onboard" className="btn btn-primary btn-sm">Add a Product →</Link>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "180px", overflowY: "auto" }}>
                {products.map(p => (
                  <button key={p.id} type="button" onClick={() => setProduct(p)} style={{
                    padding: "9px 12px", borderRadius: "10px", cursor: "pointer", textAlign: "left",
                    border: `1.5px solid ${product?.id === p.id ? "var(--dz-blue)" : "var(--border)"}`,
                    background: product?.id === p.id ? "rgba(0,163,255,0.1)" : "var(--surface)",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{p.name}</span>
                    <span style={{ fontSize: "0.78rem", color: "var(--dz-blue)" }}>₦{parseFloat(p.price || 0).toLocaleString("en-NG")}</span>
                  </button>
                ))}
              </div>
            )}
          </div></div>

          {/* Format */}
          <div className="card"><div className="card-body">
            <h3 style={{ fontWeight: 700, marginBottom: "12px" }}>2. Content Format</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {FORMATS.map(f => (
                <button key={f.id} type="button" onClick={() => setFormat(f.id)} style={{
                  padding: "10px 8px", borderRadius: "10px", cursor: "pointer", textAlign: "left",
                  border: `1.5px solid ${format === f.id ? "var(--dz-blue)" : "var(--border)"}`,
                  background: format === f.id ? "rgba(0,163,255,0.1)" : "transparent",
                }}>
                  <span style={{ fontSize: "1rem", display: "block", marginBottom: "2px" }}>{f.icon} {f.label}</span>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{f.desc}</span>
                </button>
              ))}
            </div>
          </div></div>

          {/* Tone + promo */}
          <div className="card"><div className="card-body">
            <h3 style={{ fontWeight: 700, marginBottom: "12px" }}>3. Tone & Offer</h3>
            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label className="form-label">Tone</label>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {TONES.map(t => (
                  <button key={t} type="button" onClick={() => setTone(t)} style={{
                    padding: "5px 12px", borderRadius: "999px", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600,
                    border: `1.5px solid ${tone === t ? "var(--dz-blue)" : "var(--border)"}`,
                    background: tone === t ? "rgba(0,163,255,0.1)" : "transparent",
                    color: tone === t ? "var(--dz-blue)" : "var(--text-secondary)",
                  }}>{t}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Promo Text (optional)</label>
              <input className="form-input" value={promo} onChange={e => setPromo(e.target.value)} placeholder="e.g. 20% off this weekend, Free delivery today" />
            </div>
          </div></div>

          {error && <div className="alert alert-error">{error}</div>}

          <button onClick={generate} disabled={loading || !product} className="btn btn-primary btn-lg" style={{ justifyContent: "center" }}>
            {loading ? "🤖 Generating…" : "🚀 Generate Content"}
          </button>
        </div>

        {/* Output */}
        <div className="card" style={{ position: "sticky", top: "80px" }}>
          <div className="card-body">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ fontWeight: 700 }}>Generated Content</h3>
              {result && (
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={copy} className="btn btn-outline btn-sm">{copied ? "✅ Copied!" : "📋 Copy"}</button>
                </div>
              )}
            </div>

            {!result ? (
              <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--text-muted)" }}>
                <p style={{ fontSize: "2rem", marginBottom: "8px" }}>✍️</p>
                <p style={{ fontSize: "0.85rem" }}>Your AI-generated content will appear here.</p>
                <p style={{ fontSize: "0.75rem", marginTop: "4px" }}>Select a product, format, and click Generate.</p>
              </div>
            ) : (
              <>
                <pre style={{
                  whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "0.85rem",
                  color: "var(--text-secondary)", lineHeight: 1.7, background: "rgba(255,255,255,0.04)",
                  padding: "14px", borderRadius: "10px", minHeight: "200px",
                  maxHeight: "360px", overflowY: "auto",
                }}>{result}</pre>
                <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
                  <button onClick={() => share("whatsapp")}  className="btn btn-outline btn-sm">📱 WhatsApp</button>
                  <button onClick={() => share("twitter")}   className="btn btn-outline btn-sm">𝕏 Twitter</button>
                  <button onClick={() => share("facebook")}  className="btn btn-outline btn-sm">👥 Facebook</button>
                  <button onClick={generate} className="btn btn-ghost btn-sm">🔄 Regenerate</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="card" style={{ marginTop: "24px" }}>
        <div className="card-body" style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>AI Model</p>
            <p style={{ fontWeight: 700 }}>DUNAZOE Marketing AI</p>
          </div>
          <div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Formats</p>
            <p style={{ fontWeight: 700 }}>6 channels</p>
          </div>
          <div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Tone options</p>
            <p style={{ fontWeight: 700 }}>6 styles</p>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <Link href="/vendor/dashboard" className="btn btn-ghost btn-sm">← Dashboard</Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
