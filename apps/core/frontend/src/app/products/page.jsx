"use client";
import { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PageShell from "../../components/PageShell";
import Image from "next/image";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const CATS = [
  { icon: "👗", label: "Fashion",     slug: "fashion" },
  { icon: "📱", label: "Phones",      slug: "phones_tablets" },
  { icon: "🛒", label: "Food",        slug: "food_groceries" },
  { icon: "💄", label: "Beauty",      slug: "beauty_health" },
  { icon: "⚡", label: "Electronics", slug: "electronics" },
  { icon: "☀️", label: "Solar",       slug: "solar_energy" },
  { icon: "👶", label: "Baby",        slug: "baby_kids" },
  { icon: "💼", label: "Services",    slug: "services" },
];

// Inner component — useSearchParams() must live inside <Suspense>
function ProductsContent() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();
  const category = searchParams.get("category");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "24", sort: "relevance" });
    if (category) params.set("category", category);
    if (search) params.set("q", search);
    fetch(`${API}/products?${params}`)
      .then(r => r.json())
      .then(d => {
        const apiProducts = d.products || [];
        // Merge with any locally-published products (for offline / just-published items)
        try {
          const local = JSON.parse(localStorage.getItem("dunazoe_products_store") || "[]");
          if (local.length > 0) {
            const apiIds = new Set(apiProducts.map(p => String(p.id)));
            const uniqueLocal = local.filter(p => !apiIds.has(String(p.id)));
            // Apply category / search filter to local items
            const q = search.toLowerCase().trim();
            const cat = (category || "").toLowerCase().trim();
            const filtered = uniqueLocal.filter(p => {
              if (cat && !(p.category || "").toLowerCase().includes(cat)) return false;
              if (q && !(p.name || "").toLowerCase().includes(q) && !(p.description || "").toLowerCase().includes(q)) return false;
              return true;
            });
            return [...apiProducts, ...filtered];
          }
        } catch (_) {}
        return apiProducts;
      })
      .then(merged => setProducts(merged))
      .catch(() => {
        // Fully offline — read from localStorage only
        try {
          const local = JSON.parse(localStorage.getItem("dunazoe_products_store") || "[]");
          setProducts(local);
        } catch { setProducts([]); }
      })
      .finally(() => setLoading(false));
  }, [category, search]);

  useEffect(() => { load(); }, [load]);

  function addToCart(product) {
    try {
      const cart = JSON.parse(localStorage.getItem("dunazoe_cart") || "[]");
      const idx = cart.findIndex(i => i.id === product.id);
      if (idx >= 0) cart[idx].qty = (cart[idx].qty || 1) + 1;
      else cart.push({ ...product, qty: 1 });
      localStorage.setItem("dunazoe_cart", JSON.stringify(cart));
      alert(`"${product.name}" added to cart!`);
    } catch (_) {}
  }

  return (
    <PageShell
      title={category ? CATS.find(c => c.slug === category)?.label || "Products" : "All Products"}
      icon="🛒"
      authRequired={false}
      subtitle="Discover quality products from verified vendors across Nigeria"
      actions={<Link href="/cart" className="btn btn-outline btn-sm">🛒 View Cart</Link>}
    >
      <div style={{ marginBottom: "24px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <input
          className="form-input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search products..."
          style={{ flex: 1, minWidth: "200px" }}
          onKeyDown={e => e.key === "Enter" && load()}
        />
        <button onClick={load} className="btn btn-primary">Search</button>
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "28px", overflowX: "auto", paddingBottom: "4px" }}>
        <Link href="/products" className={`badge ${!category ? "badge-info" : "badge-muted"}`}
          style={{ whiteSpace: "nowrap", textDecoration: "none", padding: "6px 14px", fontSize: "0.82rem" }}>All</Link>
        {CATS.map(c => (
          <Link key={c.slug} href={`/products?category=${c.slug}`}
            className={`badge ${category === c.slug ? "badge-info" : "badge-muted"}`}
            style={{ whiteSpace: "nowrap", textDecoration: "none", padding: "6px 14px", fontSize: "0.82rem" }}>
            {c.icon} {c.label}
          </Link>
        ))}
      </div>

      {loading ? (
        <div className="grid-auto">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "280px", borderRadius: "16px" }} />
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="grid-auto">
          {products.map(p => {
            // Infer product type for icon
            const cat = (p.product_type || p.type || p.category || "").toLowerCase();
            const typeIcon = cat.includes("digital") || cat.includes("download") || p.is_digital ? "💾"
                           : cat.includes("service") || cat.includes("consult") || p.is_service  ? "🛠️"
                           : "📦";
            // Parse first image
            let imgSrc = null;
            if (p.images) {
              if (typeof p.images === "string") {
                try { const a = JSON.parse(p.images); imgSrc = Array.isArray(a) ? a[0] : p.images; } catch { imgSrc = p.images; }
              } else if (Array.isArray(p.images)) { imgSrc = p.images[0]; }
            }
            // Sizes / colors quick-peek
            function peekArr(raw) {
              if (!raw) return [];
              if (Array.isArray(raw)) return raw.slice(0, 4);
              try { const a = JSON.parse(raw); if (Array.isArray(a)) return a.slice(0, 4); } catch {}
              return String(raw).split(",").map(s => s.trim()).filter(Boolean).slice(0, 4);
            }
            const sizes  = peekArr(p.sizes);
            const colors = peekArr(p.colors);
            const isDigital = typeIcon === "💾";
            const isService = typeIcon === "🛠️";

            return (
              <div key={p.id} className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <Link href={`/products/${p.id}`} style={{ textDecoration: "none", display: "block" }}>
                  {/* Image / hero */}
                  <div style={{ width: "100%", height: "180px", background: imgSrc ? `url(${imgSrc}) center/cover no-repeat` : "var(--bg-3)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", flexShrink: 0 }}>
                    {!imgSrc && <span style={{ fontSize: "2.4rem", opacity: 0.22 }}>{typeIcon}</span>}
                    {/* Type badge top-left */}
                    <span style={{ position: "absolute", top: "8px", left: "8px", padding: "2px 7px", borderRadius: "12px", fontSize: "0.68rem", fontWeight: 700, background: "rgba(0,0,0,0.55)", color: "#fff", backdropFilter: "blur(4px)" }}>
                      {typeIcon} {isDigital ? "Digital" : isService ? "Service" : "Physical"}
                    </span>
                    {p.ajo_enabled && (
                      <span className="badge badge-info" style={{ position: "absolute", top: "8px", right: "8px", fontSize: "0.68rem" }}>⬡ Ajo</span>
                    )}
                    {p.weight && !isDigital && !isService && (
                      <span style={{ position: "absolute", bottom: "8px", left: "8px", padding: "2px 7px", borderRadius: "10px", fontSize: "0.65rem", fontWeight: 600, background: "rgba(0,0,0,0.5)", color: "#ccc" }}>
                        ⚖️ {p.weight}kg
                      </span>
                    )}
                  </div>

                  <div style={{ padding: "12px 14px 8px" }}>
                    <p style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginBottom: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.business_name || "DUNAZOE Store"}{p.location ? ` · 📍${p.location}` : ""}
                    </p>

                    {/* Size pills */}
                    {sizes.length > 0 && (
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "5px" }}>
                        {sizes.map(s => (
                          <span key={s} style={{ padding: "1px 6px", borderRadius: "6px", fontSize: "0.62rem", fontWeight: 700, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{s}</span>
                        ))}
                      </div>
                    )}

                    {/* Color dots */}
                    {colors.length > 0 && (
                      <div style={{ display: "flex", gap: "4px", marginBottom: "5px", alignItems: "center" }}>
                        {colors.map(c => /^#[0-9A-Fa-f]{3,6}$/.test(c)
                          ? <span key={c} style={{ width: "12px", height: "12px", borderRadius: "50%", background: c, border: "1px solid var(--border)", flexShrink: 0 }} />
                          : <span key={c} style={{ padding: "1px 6px", borderRadius: "6px", fontSize: "0.62rem", fontWeight: 700, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{c}</span>
                        )}
                      </div>
                    )}

                    {/* Digital info */}
                    {isDigital && p.file_format && (
                      <p style={{ fontSize: "0.68rem", color: "var(--dz-blue)", marginBottom: "4px" }}>📥 {p.file_format}{p.file_size ? ` · ${p.file_size}` : ""}</p>
                    )}

                    {/* Service info */}
                    {isService && (p.service_duration || p.service_area) && (
                      <p style={{ fontSize: "0.68rem", color: "#9B5DE5", marginBottom: "4px" }}>⏳ {p.service_duration || "—"}{p.service_area ? ` · ${p.service_area}` : ""}</p>
                    )}

                    <span style={{ fontSize: "1.1rem", fontWeight: 900, background: "var(--dz-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                      ₦{parseFloat(p.price || 0).toLocaleString("en-NG")}
                    </span>
                    {p.ajo_enabled && p.price > 0 && (
                      <span style={{ fontSize: "0.68rem", color: "#00C8E0", marginLeft: "6px", fontWeight: 600 }}>
                        or ₦{Math.ceil(p.price * 1.05 / 6).toLocaleString()}/mo
                      </span>
                    )}
                  </div>
                </Link>
                <div style={{ padding: "0 14px 14px", marginTop: "auto" }}>
                  <button onClick={() => addToCart(p)} className="btn btn-primary btn-sm" style={{ width: "100%" }}>
                    {isDigital ? "💾 Buy & Download" : isService ? "🗓️ Book" : "🛒 Add to Cart"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">🔍</span>
          <p className="empty-title">No products found</p>
          <p className="empty-body">Try a different search or browse all categories.</p>
          <Link href="/products" className="btn btn-primary">Browse All</Link>
        </div>
      )}
    </PageShell>
  );
}

// Suspense boundary required by Next.js 14 when useSearchParams() is used in a client component
export default function ProductsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--bg-1, #04091C)" }} />}>
      <ProductsContent />
    </Suspense>
  );
}
