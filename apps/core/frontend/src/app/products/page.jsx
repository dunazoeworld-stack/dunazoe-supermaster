"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PageShell from "../../components/PageShell";
import Image from "next/image";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const CATS = [
  { icon: "👗", label: "Fashion", slug: "fashion" },
  { icon: "📱", label: "Phones", slug: "phones_tablets" },
  { icon: "🛒", label: "Food", slug: "food_groceries" },
  { icon: "💄", label: "Beauty", slug: "beauty_health" },
  { icon: "⚡", label: "Electronics", slug: "electronics" },
  { icon: "☀️", label: "Solar", slug: "solar_energy" },
  { icon: "👶", label: "Baby", slug: "baby_kids" },
  { icon: "💼", label: "Services", slug: "services" },
];

export default function ProductsPage() {
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
      .then(d => setProducts(d.products || []))
      .catch(() => setProducts([]))
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
    <PageShell title={category ? CATS.find(c => c.slug === category)?.label || "Products" : "All Products"}
      icon="🛒" authRequired={false}
      subtitle="Discover quality products from verified vendors across Nigeria"
      actions={<Link href="/cart" className="btn btn-outline btn-sm">🛒 View Cart</Link>}>
      <div style={{ marginBottom: "24px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <input className="form-input" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search products..." style={{ flex: 1, minWidth: "200px" }}
          onKeyDown={e => e.key === "Enter" && load()} />
        <button onClick={load} className="btn btn-primary">Search</button>
      </div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "28px", overflowX: "auto", paddingBottom: "4px" }}>
        <Link href="/products" className={`badge ${!category ? "badge-info" : "badge-muted"}`} style={{ whiteSpace: "nowrap", textDecoration: "none", padding: "6px 14px", fontSize: "0.82rem" }}>All</Link>
        {CATS.map(c => (
          <Link key={c.slug} href={`/products?category=${c.slug}`}
            className={`badge ${category === c.slug ? "badge-info" : "badge-muted"}`}
            style={{ whiteSpace: "nowrap", textDecoration: "none", padding: "6px 14px", fontSize: "0.82rem" }}>
            {c.icon} {c.label}
          </Link>
        ))}
      </div>
      {loading ? (
        <div className="grid-auto">{Array(8).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: "280px", borderRadius: "16px" }} />)}</div>
      ) : products.length > 0 ? (
        <div className="grid-auto">
          {products.map(p => (
            <div key={p.id} className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <Link href={`/products/${p.id}`} style={{ textDecoration: "none", display: "block" }}>
                <div style={{ width: "100%", height: "180px", background: p.images ? `url(${p.images}) center/cover` : "var(--bg-3)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  {!p.images && <Image src="/assets/dunazoe-logo.jpg" alt="" width={48} height={48} style={{ borderRadius: "10px", opacity: 0.25 }} />}
                  {p.ajo_enabled && <span className="badge badge-info" style={{ position: "absolute", top: "10px", right: "10px" }}>⬡ Ajo</span>}
                </div>
                <div style={{ padding: "14px" }}>
                  <p style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "8px" }}>{p.business_name || "DUNAZOE Store"}</p>
                  <span style={{ fontSize: "1.1rem", fontWeight: 800, background: "var(--dz-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    ₦{parseFloat(p.price || 0).toLocaleString("en-NG")}
                  </span>
                </div>
              </Link>
              <div style={{ padding: "0 14px 14px" }}>
                <button onClick={() => addToCart(p)} className="btn btn-primary btn-sm" style={{ width: "100%" }}>Add to Cart</button>
              </div>
            </div>
          ))}
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
