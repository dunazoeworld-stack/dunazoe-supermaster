"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../components/PageShell";
import Image from "next/image";

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

  return (
    <PageShell title="Cart" icon="🛒" authRequired={false}
      subtitle="Review your selected items before checkout"
      actions={cart.length > 0 && <button onClick={clearCart} className="btn btn-ghost btn-sm">Clear Cart</button>}>
      {!mounted ? null : cart.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🛒</span>
          <p className="empty-title">Your cart is empty</p>
          <p className="empty-body">Add items from the shop to get started.</p>
          <Link href="/products" className="btn btn-primary">🛒 Start Shopping</Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "24px", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {cart.map(item => (
              <div key={item.id} className="card">
                <div className="card-body" style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                  <div style={{ width: "64px", height: "64px", borderRadius: "10px", background: item.images ? `url(${item.images}) center/cover` : "var(--bg-3)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {!item.images && <Image src="/assets/dunazoe-logo.jpg" alt="" width={32} height={32} style={{ borderRadius: "6px", opacity: 0.3 }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>₦{parseFloat(item.price || 0).toLocaleString("en-NG")}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button onClick={() => updateQty(item.id, -1)} className="btn btn-ghost btn-sm" style={{ padding: "4px 10px" }}>−</button>
                    <span style={{ fontWeight: 700, minWidth: "20px", textAlign: "center" }}>{item.qty || 1}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="btn btn-ghost btn-sm" style={{ padding: "4px 10px" }}>+</button>
                    <button onClick={() => remove(item.id)} className="btn btn-danger btn-sm" style={{ padding: "4px 10px" }}>✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="card" style={{ minWidth: "240px", position: "sticky", top: "80px" }}>
            <div className="card-body">
              <p style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "16px" }}>Order Summary</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                {cart.map(i => (
                  <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                    <span>{i.name?.slice(0, 20)}{i.name?.length > 20 ? "…" : ""} ×{i.qty || 1}</span>
                    <span>₦{(parseFloat(i.price || 0) * (i.qty || 1)).toLocaleString("en-NG")}</span>
                  </div>
                ))}
              </div>
              <div className="glow-divider" style={{ margin: "12px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, marginBottom: "20px" }}>
                <span>Total</span>
                <span style={{ background: "var(--dz-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>₦{total.toLocaleString("en-NG")}</span>
              </div>
              <Link href="/checkout" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>Proceed to Checkout →</Link>
              <Link href="/products" className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center", marginTop: "8px" }}>Continue Shopping</Link>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
