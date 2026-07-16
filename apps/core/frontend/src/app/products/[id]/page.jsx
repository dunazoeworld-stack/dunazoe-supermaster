"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

// ─── helpers ───────────────────────────────────────────────────────────────
function Badge({ label, color = "var(--dz-blue)", bg = "rgba(0,163,255,0.1)" }) {
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: 700, color, background: bg, border: `1px solid ${color}33` }}>
      {label}
    </span>
  );
}

function SpecRow({ icon, label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{icon} {label}</span>
      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)", textAlign: "right", maxWidth: "60%" }}>{value}</span>
    </div>
  );
}

const TYPE_ICONS = { physical: "📦", digital: "💾", service: "🛠️" };

export default function ProductDetailPage({ params }) {
  const { id } = params;
  const [product, setProduct]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [qty, setQty]           = useState(1);
  const [added, setAdded]       = useState(false);
  const [selSize, setSelSize]   = useState(null);
  const [selColor, setSelColor] = useState(null);
  const [imgIdx, setImgIdx]     = useState(0);

  useEffect(() => {
    fetch(`${API}/products/${id}`)
      .then(r => r.json())
      .then(d => {
        const p = d.product || d;
        setProduct(p);
        // Pre-select first size / color if available
        const sizes  = parseMeta(p, "sizes");
        const colors = parseMeta(p, "colors");
        if (sizes.length)  setSelSize(sizes[0]);
        if (colors.length) setSelColor(colors[0]);
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [id]);

  // Parse JSON metadata stored as string or already an array
  function parseMeta(p, key) {
    if (!p) return [];
    const raw = p[key] || p.metadata?.[key] || p.details?.[key];
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw); } catch { return String(raw).split(",").map(s => s.trim()).filter(Boolean); }
  }

  function getImages(p) {
    if (!p) return [];
    const raw = p.images || p.image_urls || p.image;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed.filter(Boolean); } catch {}
    return [raw].filter(Boolean);
  }

  function inferType(p) {
    if (!p) return "physical";
    const cat = (p.product_type || p.type || p.category || "").toLowerCase();
    if (cat.includes("digital") || cat.includes("download") || cat.includes("ebook") || cat.includes("software")) return "digital";
    if (cat.includes("service") || cat.includes("consult") || cat.includes("repair")) return "service";
    if (p.is_digital) return "digital";
    if (p.is_service) return "service";
    return "physical";
  }

  function addToCart() {
    if (!product) return;
    try {
      const item = { ...product, qty, selected_size: selSize, selected_color: selColor };
      const cart = JSON.parse(localStorage.getItem("dunazoe_cart") || "[]");
      const idx  = cart.findIndex(i => i.id === product.id && i.selected_size === selSize && i.selected_color === selColor);
      if (idx >= 0) cart[idx].qty = (cart[idx].qty || 1) + qty;
      else cart.push(item);
      localStorage.setItem("dunazoe_cart", JSON.stringify(cart));
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    } catch (_) {}
  }

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <PageShell title={product?.name || "Product"} icon="🛒" authRequired={false}
      breadcrumb={[{ href: "/products", label: "Products" }, { label: product?.name?.slice(0, 28) || `#${id}` }]}>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
          <div className="skeleton" style={{ height: "380px", borderRadius: "20px" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {[260, 180, 120, 90, 140, 80].map((w, i) => (
              <div key={i} className="skeleton" style={{ height: "18px", width: `${w}px`, borderRadius: "6px" }} />
            ))}
          </div>
        </div>
      ) : !product ? (
        <div className="empty-state">
          <span className="empty-icon">🔍</span>
          <p className="empty-title">Product not found</p>
          <Link href="/products" className="btn btn-primary">Browse Products</Link>
        </div>
      ) : (() => {
        const images  = getImages(product);
        const sizes   = parseMeta(product, "sizes");
        const colors  = parseMeta(product, "colors");
        const tags    = parseMeta(product, "tags");
        const type    = inferType(product);
        const mainImg = images[imgIdx] || null;

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>

            {/* ── TOP GRID ──────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "clamp(280px,45%,520px) 1fr", gap: "40px", alignItems: "start" }}>

              {/* Image gallery */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{
                  width: "100%", aspectRatio: "1", borderRadius: "20px", overflow: "hidden",
                  background: mainImg ? `url(${mainImg}) center/cover no-repeat` : "var(--bg-3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid var(--border)", position: "relative",
                }}>
                  {!mainImg && <span style={{ fontSize: "4rem", opacity: 0.18 }}>{TYPE_ICONS[type]}</span>}
                  {/* Type badge */}
                  <div style={{ position: "absolute", top: "12px", left: "12px" }}>
                    <Badge label={`${TYPE_ICONS[type]} ${type.charAt(0).toUpperCase() + type.slice(1)}`} />
                  </div>
                  {product.ajo_enabled && (
                    <div style={{ position: "absolute", top: "12px", right: "12px" }}>
                      <Badge label="⬡ Ajo" color="#00C8E0" bg="rgba(0,200,224,0.12)" />
                    </div>
                  )}
                </div>
                {/* Thumbnail strip */}
                {images.length > 1 && (
                  <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
                    {images.map((src, i) => (
                      <button key={i} onClick={() => setImgIdx(i)} style={{
                        width: "64px", height: "64px", flexShrink: 0, borderRadius: "10px", border: `2px solid ${imgIdx === i ? "var(--dz-blue)" : "var(--border)"}`,
                        background: `url(${src}) center/cover no-repeat`, cursor: "pointer",
                      }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Info panel */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                {/* Badges row */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {product.category && <Badge label={product.category} />}
                  {product.is_active !== false && <Badge label="✓ In Stock" color="var(--success)" bg="rgba(0,204,136,0.1)" />}
                  {product.ajo_enabled && <Badge label="⬡ Ajo Available" color="#00C8E0" bg="rgba(0,200,224,0.1)" />}
                  {product.is_verified && <Badge label="✔ Verified" color="#9B5DE5" bg="rgba(155,93,229,0.1)" />}
                  {tags.slice(0, 3).map(t => <Badge key={t} label={t} color="var(--text-secondary)" bg="var(--surface)" />)}
                </div>

                <h1 style={{ fontSize: "1.65rem", fontWeight: 900, lineHeight: 1.2 }}>{product.name}</h1>
                <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                  by <strong style={{ color: "var(--text)" }}>{product.business_name || product.vendor_name || "DUNAZOE Store"}</strong>
                  {product.location && <span> · 📍 {product.location}</span>}
                </p>

                {/* Price */}
                <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "2.2rem", fontWeight: 900 }} className="text-gradient">
                    ₦{parseFloat(product.price || 0).toLocaleString("en-NG")}
                  </span>
                  {product.old_price > product.price && (
                    <span style={{ fontSize: "1rem", color: "var(--text-muted)", textDecoration: "line-through" }}>
                      ₦{parseFloat(product.old_price).toLocaleString("en-NG")}
                    </span>
                  )}
                  {product.ajo_enabled && product.price > 0 && (
                    <span style={{ fontSize: "0.82rem", color: "#00C8E0", fontWeight: 700 }}>
                      or ₦{Math.ceil(product.price * 1.05 / 6).toLocaleString("en-NG")}/mo Ajo
                    </span>
                  )}
                </div>

                {/* ── SIZE SELECTOR (physical only) ── */}
                {type === "physical" && sizes.length > 0 && (
                  <div>
                    <p style={{ fontSize: "0.82rem", fontWeight: 700, marginBottom: "8px", color: "var(--text-secondary)" }}>
                      SIZE <span style={{ color: "var(--dz-blue)", marginLeft: "6px" }}>{selSize}</span>
                    </p>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {sizes.map(s => (
                        <button key={s} onClick={() => setSelSize(s)} style={{
                          padding: "6px 14px", borderRadius: "8px", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
                          border: `2px solid ${selSize === s ? "var(--dz-blue)" : "var(--border)"}`,
                          background: selSize === s ? "rgba(0,163,255,0.1)" : "var(--surface)",
                          color: selSize === s ? "var(--dz-blue)" : "var(--text)",
                        }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── COLOR SELECTOR (physical only) ── */}
                {type === "physical" && colors.length > 0 && (
                  <div>
                    <p style={{ fontSize: "0.82rem", fontWeight: 700, marginBottom: "8px", color: "var(--text-secondary)" }}>
                      COLOR <span style={{ color: "var(--dz-blue)", marginLeft: "6px" }}>{selColor}</span>
                    </p>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {colors.map(c => {
                        const isHex = /^#[0-9A-Fa-f]{3,6}$/.test(c);
                        return isHex ? (
                          <button key={c} onClick={() => setSelColor(c)} title={c} style={{
                            width: "30px", height: "30px", borderRadius: "50%", background: c, cursor: "pointer",
                            border: `3px solid ${selColor === c ? "var(--dz-blue)" : "transparent"}`,
                            outline: "2px solid var(--border)",
                          }} />
                        ) : (
                          <button key={c} onClick={() => setSelColor(c)} style={{
                            padding: "6px 14px", borderRadius: "8px", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
                            border: `2px solid ${selColor === c ? "var(--dz-blue)" : "var(--border)"}`,
                            background: selColor === c ? "rgba(0,163,255,0.1)" : "var(--surface)",
                            color: selColor === c ? "var(--dz-blue)" : "var(--text)",
                          }}>{c}</button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── QTY (not for services) ── */}
                {type !== "service" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-secondary)" }}>QTY</p>
                    <button onClick={() => setQty(q => Math.max(1, q - 1))} className="btn btn-ghost btn-sm" style={{ padding: "6px 14px" }}>−</button>
                    <span style={{ fontWeight: 800, fontSize: "1.1rem", minWidth: "28px", textAlign: "center" }}>{qty}</span>
                    <button onClick={() => setQty(q => q + 1)} className="btn btn-ghost btn-sm" style={{ padding: "6px 14px" }}>+</button>
                  </div>
                )}

                {/* CTA */}
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button onClick={addToCart} className="btn btn-primary btn-lg" style={{ flex: 1, minWidth: "140px" }}>
                    {added ? "✅ Added to Cart!" : type === "digital" ? "💾 Buy & Download" : type === "service" ? "🗓️ Book Service" : "🛒 Add to Cart"}
                  </button>
                  <Link href="/cart" className="btn btn-outline btn-lg">View Cart</Link>
                </div>

                {/* Share + Chat row */}
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {/* Share button */}
                  <button
                    onClick={() => {
                      const link = product.shareable_link ? `https://${product.shareable_link}` : window.location.href;
                      const text = `Check out '${product.name}' on DUNAZOE: ${link}`;
                      if (navigator.share) {
                        navigator.share({ title: product.name, text, url: link }).catch(() => {});
                      } else {
                        navigator.clipboard.writeText(link);
                        alert("Link copied to clipboard!");
                      }
                    }}
                    className="btn btn-ghost btn-sm"
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    📤 Share
                  </button>
                  {/* WhatsApp share */}
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Check out '${product.name}' on DUNAZOE: ${product.shareable_link ? `https://${product.shareable_link}` : window.location.href}`)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                  >
                    📱 WhatsApp
                  </a>
                  {/* Chat Vendor */}
                  <button
                    onClick={() => {
                      // Opens chat widget pre-filled with vendor
                      window.__dunazoe_open_chat = { receiver_id: product.vendor_id, name: product.business_name || product.vendor_name || "Vendor" };
                      document.dispatchEvent(new CustomEvent("dz:open-chat", { detail: window.__dunazoe_open_chat }));
                    }}
                    className="btn btn-ghost btn-sm"
                  >
                    💬 Chat Vendor
                  </button>
                </div>

                {/* Ajo info */}
                {product.ajo_enabled && (
                  <div className="alert alert-info" style={{ marginTop: "4px" }}>
                    ⬡ <strong>Ajo payment:</strong> Spread over {product.ajo_weeks || "6"} weeks.{" "}
                    <Link href="/thrift" style={{ color: "var(--dz-blue)", fontWeight: 700 }}>Learn more →</Link>
                  </div>
                )}

                {/* Trust badge */}
                <div style={{ padding: "10px 14px", background: "rgba(0,200,150,0.06)", borderRadius: "10px", fontSize: "0.78rem", color: "var(--success)", display: "flex", gap: "8px", alignItems: "center" }}>
                  🔒 Escrow-protected · 30-day buyer guarantee · Secure checkout
                </div>
              </div>
            </div>

            {/* ── SPECS + DESCRIPTION GRID ──────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>

              {/* Description */}
              <div className="card">
                <div className="card-body">
                  <p style={{ fontWeight: 800, marginBottom: "12px" }}>📄 Description</p>
                  <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {product.description || "No description provided for this product."}
                  </p>
                </div>
              </div>

              {/* Specifications — adapts by product type */}
              <div className="card">
                <div className="card-body">
                  <p style={{ fontWeight: 800, marginBottom: "12px" }}>
                    {type === "digital" ? "💾 Digital Info" : type === "service" ? "🛠️ Service Details" : "📐 Specifications"}
                  </p>

                  {/* ── PHYSICAL specs ── */}
                  {type === "physical" && (<>
                    <SpecRow icon="⚖️"  label="Weight"       value={product.weight ? `${product.weight} kg` : null} />
                    <SpecRow icon="📏"  label="Dimensions"   value={product.dimensions || product.size_guide} />
                    <SpecRow icon="🏭"  label="Brand"        value={product.brand} />
                    <SpecRow icon="🎨"  label="Material"     value={product.material} />
                    <SpecRow icon="🌍"  label="Made in"      value={product.country_of_origin} />
                    <SpecRow icon="📦"  label="Stock"        value={product.stock_quantity != null ? `${product.stock_quantity} units` : null} />
                    <SpecRow icon="🚚"  label="Ships from"   value={product.location || product.vendor_location} />
                    <SpecRow icon="⏱️"  label="Dispatch"     value={product.dispatch_time || "1-3 business days"} />
                    <SpecRow icon="🔁"  label="Returns"      value={product.return_policy || "30-day return policy"} />
                  </>)}

                  {/* ── DIGITAL specs ── */}
                  {type === "digital" && (<>
                    <SpecRow icon="📥"  label="Format"       value={product.file_format || product.format} />
                    <SpecRow icon="💿"  label="File size"    value={product.file_size} />
                    <SpecRow icon="📋"  label="License"      value={product.license_type || "Personal use"} />
                    <SpecRow icon="🔄"  label="Updates"      value={product.updates_included ? "Included" : null} />
                    <SpecRow icon="🌐"  label="Language"     value={product.language || "English"} />
                    <SpecRow icon="⚙️"  label="Compatible"   value={product.compatibility} />
                    <SpecRow icon="🛡️"  label="DRM"          value={product.drm_protected ? "DRM Protected" : "DRM-Free"} />
                    <div style={{ marginTop: "14px", padding: "10px 14px", background: "rgba(0,163,255,0.06)", borderRadius: "10px", fontSize: "0.8rem", color: "var(--dz-blue)" }}>
                      ⚡ Instant delivery · Download link sent to your email after payment
                    </div>
                  </>)}

                  {/* ── SERVICE specs ── */}
                  {type === "service" && (<>
                    <SpecRow icon="⏳"  label="Duration"     value={product.service_duration || product.duration} />
                    <SpecRow icon="🔄"  label="Turnaround"   value={product.turnaround_time} />
                    <SpecRow icon="📍"  label="Service area" value={product.service_area || product.location || "Nigeria-wide"} />
                    <SpecRow icon="👤"  label="Provider"     value={product.business_name || product.vendor_name} />
                    <SpecRow icon="📋"  label="Includes"     value={product.service_includes} />
                    <SpecRow icon="🚫"  label="Excludes"     value={product.service_excludes} />
                    <SpecRow icon="🗓️"  label="Availability" value={product.availability || "Mon–Sat"} />
                    <SpecRow icon="📞"  label="Booking"      value="Contact vendor after purchase" />
                  </>)}
                </div>
              </div>
            </div>

            {/* ── VENDOR CARD ─────────────────────────────────────── */}
            {(product.business_name || product.vendor_name) && (
              <div className="card">
                <div className="card-body" style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--dz-gradient)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>
                    🏪
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 800, marginBottom: "2px" }}>{product.business_name || product.vendor_name}</p>
                    <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>Verified DUNAZOE Vendor · {product.location || "Nigeria"}</p>
                  </div>
                  <Link href={`/vendors?id=${product.vendor_id || ""}`} className="btn btn-ghost btn-sm">View Store →</Link>
                </div>
              </div>
            )}

          </div>
        );
      })()}
    </PageShell>
  );
}
