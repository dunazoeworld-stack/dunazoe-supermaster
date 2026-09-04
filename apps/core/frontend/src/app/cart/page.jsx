"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../components/PageShell";
import Image from "next/image";

/** Parse images field — handles array, JSON string, or plain URL. */
function resolveImage(item) {
  let src = item.images || item.image_url || item.image || null;
  if (src && typeof src === "string") {
    try {
      const parsed = JSON.parse(src);
      src = Array.isArray(parsed) ? parsed[0] : src;
    } catch (_) {}
  } else if (Array.isArray(src)) {
    src = src[0] || null;
  }
  // Reject data URIs for CSS background-image
  if (src && src.startsWith("data:")) src = null;
  return src;
}

export default function CartPage() {
  const [cart, setCart] = useState([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try { setCart(JSON.parse(localStorage.getItem("dunazoe_cart") || "[]")); } catch (_) {}
    setMounted(true);
  }, []);

  function updateQty(id, delta) {
    const next = cart.map(i => i.id === id ? { ...i, qty: Math.max(1, (i.qty || 1) + delta) } : i);
    setCart(next); localStorage.setItem("dunazoe_cart", JSON.stringify(next));
  }
  function remove(id) {
    const next = cart.filter(i => i.id !== id);
    setCart(next); localStorage.setItem("dunazoe_cart", JSON.stringify(next));
  }
  function clearCart() {
    setCart([]); localStorage.setItem("dunazoe_cart", "[]");
  }

  const total = cart.reduce((sum, i) => sum + (parseFloat(i.price || 0) * (i.qty || 1)), 0);

  if (!mounted) return null;

  if (cart.length === 0) {
    return (
      <PageShell title="Cart" icon="🛒" authRequired={false}
        subtitle="Review your selected items before checkout">
        <div className="empty-state">
          <span className="empty-icon">🛒</span>
          <p className="empty-title">Your cart is empty</p>
          <p className="empty-body">Add items from the shop to get started.</p>
          <Link href="/products" className="btn btn-primary">🛒 Start Shopping</Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Cart" icon="🛒" authRequired={false}
      subtitle="Review your selected items before checkout"
      actions={<button onClick={clearCart} className="btn btn-ghost btn-sm">Clear Cart</button>}>

      <div className="cart-layout">
        {/* Cart items */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {cart.map(item => {
            const imgSrc = resolveImage(item);
            return (
              <div key={item.id} className="card">
                <div className="card-body" style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                  {/* Product image */}
                  <div style={{
                    width: "64px", height: "64px", borderRadius: "10px",
                    background: imgSrc ? `url(${imgSrc}) center/cover` : "var(--bg-3)",
                    flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {!imgSrc && (
                      <Image src="/assets/dunazoe-logo.jpg" alt="" width={32} height={32}
                        style={{ borderRadius: "6px", opacity: 0.3 }} />
                    )}
                  </div>

                  {/* Item details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.name}
                    </p>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "10px" }}>
                      ₦{parseFloat(item.price || 0).toLocaleString("en-NG")} each
                    </p>
                     <p style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginBottom: "10px" }}>
                       Vendor: {item.business_name || item.vendor_name || "DUNAZOE Store"}
                     </p>

                    {/* Quantity controls */}
                    <div className="cart-qty-row">
                      <button onClick={() => updateQty(item.id, -1)} className="btn btn-ghost cart-qty-btn" aria-label="Decrease quantity">−</button>
                      <span className="cart-qty-val">{item.qty || 1}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="btn btn-ghost cart-qty-btn" aria-label="Increase quantity">+</button>
                      <span style={{ flex: 1, fontWeight: 700, fontSize: "0.9rem", textAlign: "right", paddingRight: "4px" }}>
                        ₦{(parseFloat(item.price || 0) * (item.qty || 1)).toLocaleString("en-NG")}
                      </span>
                      <button onClick={() => remove(item.id)} className="btn btn-danger btn-sm cart-remove-btn" aria-label="Remove item">✕</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order summary */}
        <div className="card cart-summary">
          <div className="card-body">
            <p style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "16px" }}>Order Summary</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
              {cart.map(i => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                  <span>{i.name?.slice(0, 20)}{(i.name?.length || 0) > 20 ? "…" : ""} ×{i.qty || 1}</span>
                  <span>₦{(parseFloat(i.price || 0) * (i.qty || 1)).toLocaleString("en-NG")}</span>
                </div>
              ))}
            </div>
            <div className="glow-divider" style={{ margin: "12px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, marginBottom: "20px" }}>
              <span>Total</span>
              <span style={{ background: "var(--dz-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                ₦{total.toLocaleString("en-NG")}
              </span>
            </div>
            <Link href="/checkout" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
              Proceed to Checkout →
            </Link>
            <Link href="/products" className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center", marginTop: "8px" }}>
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        .cart-layout {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 24px;
          align-items: start;
        }
        .cart-summary { position: sticky; top: 80px; }
        .cart-qty-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .cart-qty-btn {
          min-width: 38px;
          min-height: 38px;
          padding: 0;
          font-size: 1.1rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .cart-qty-val {
          font-weight: 700;
          min-width: 28px;
          text-align: center;
          font-size: 1rem;
        }
        .cart-remove-btn {
          min-width: 34px;
          min-height: 34px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        @media (max-width: 640px) {
          .cart-layout { grid-template-columns: 1fr; }
          .cart-summary { position: static; }
          .cart-qty-btn { min-width: 44px; min-height: 44px; }
        }
      `}</style>
    </PageShell>
  );
}
