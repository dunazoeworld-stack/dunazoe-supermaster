"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import PageShell from "../../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function ProductDetailPage({ params }) {
  const { id } = params;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    fetch(`${API}/products/${id}`)
      .then(r => r.json())
      .then(d => setProduct(d.product || d))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [id]);

  function addToCart() {
    if (!product) return;
    try {
      const cart = JSON.parse(localStorage.getItem("dunazoe_cart") || "[]");
      const idx = cart.findIndex(i => i.id === product.id);
      if (idx >= 0) cart[idx].qty = (cart[idx].qty || 1) + qty;
      else cart.push({ ...product, qty });
      localStorage.setItem("dunazoe_cart", JSON.stringify(cart));
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    } catch (_) {}
  }

  return (
    <PageShell title={product?.name || "Product"} icon="🛒" authRequired={false}
      breadcrumb={[{ href: "/products", label: "Products" }, { label: product?.name?.slice(0, 24) || `#${id}` }]}>
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
          <div className="skeleton" style={{ height: "360px", borderRadius: "16px" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {[200, 120, 80, 100, 140].map((w, i) => <div key={i} className="skeleton" style={{ height: "20px", width: `${w}px`, borderRadius: "6px" }} />)}
          </div>
        </div>
      ) : !product ? (
        <div className="empty-state">
          <span className="empty-icon">🔍</span>
          <p className="empty-title">Product not found</p>
          <Link href="/products" className="btn btn-primary">Browse Products</Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", alignItems: "start" }}>
          <div style={{ width: "100%", aspectRatio: "1", borderRadius: "20px", overflow: "hidden", background: product.images ? `url(${product.images}) center/cover` : "var(--bg-3)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)" }}>
            {!product.images && <Image src="/assets/dunazoe-logo.jpg" alt="" width={80} height={80} style={{ borderRadius: "14px", opacity: 0.2 }} />}
          </div>
          <div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
              {product.category && <span className="badge badge-muted">{product.category}</span>}
              {product.ajo_enabled && <span className="badge badge-info">⬡ Ajo Available</span>}
              {product.is_active && <span className="badge badge-success">In Stock</span>}
            </div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: "8px" }}>{product.name}</h1>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "16px" }}>{product.description || "No description available."}</p>
            <div style={{ marginBottom: "20px" }}>
              <span style={{ fontSize: "2rem", fontWeight: 900 }} className="text-gradient">₦{parseFloat(product.price || 0).toLocaleString("en-NG")}</span>
              {product.cost > 0 && <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginLeft: "8px", textDecoration: "line-through" }}>₦{parseFloat(product.cost).toLocaleString("en-NG")}</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="btn btn-ghost btn-sm" style={{ padding: "6px 14px" }}>−</button>
              <span style={{ fontWeight: 700, fontSize: "1.1rem", minWidth: "30px", textAlign: "center" }}>{qty}</span>
              <button onClick={() => setQty(q => q + 1)} className="btn btn-ghost btn-sm" style={{ padding: "6px 14px" }}>+</button>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button onClick={addToCart} className="btn btn-primary btn-lg" style={{ flex: 1 }}>
                {added ? "✅ Added!" : "🛒 Add to Cart"}
              </button>
              <Link href="/cart" className="btn btn-outline btn-lg">View Cart</Link>
            </div>
            {product.ajo_enabled && (
              <div className="alert alert-info" style={{ marginTop: "16px" }}>
                ⬡ <strong>Ajo available:</strong> Buy in installments over {product.ajo_weeks || "—"} weeks. <Link href="/thrift" style={{ color: "var(--dz-blue)", fontWeight: 700 }}>Learn more →</Link>
              </div>
            )}
            <div style={{ marginTop: "16px", padding: "12px", background: "rgba(0,200,150,0.06)", borderRadius: "10px", fontSize: "0.8rem", color: "var(--success)" }}>
              🔒 Escrow-protected purchase · 30-day buyer guarantee
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
