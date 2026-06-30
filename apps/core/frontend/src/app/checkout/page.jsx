"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function CheckoutPage() {
  const [cart, setCart] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", state: "", city: "" });
  const [payMethod, setPayMethod] = useState("paystack");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    try { setCart(JSON.parse(localStorage.getItem("dunazoe_cart") || "[]")); } catch (_) {}
    try { const u = JSON.parse(localStorage.getItem("dunazoe_user") || "{}"); setForm(f => ({ ...f, name: u.name || "", email: u.email || "" })); } catch (_) {}
    setOffline(!navigator.onLine);
    const go = () => setOffline(false); const off = () => setOffline(true);
    window.addEventListener("online", go); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", go); window.removeEventListener("offline", off); };
  }, []);

  const total = cart.reduce((s, i) => s + parseFloat(i.price || 0) * (i.qty || 1), 0);

  async function handleCheckout(e) {
    e.preventDefault();
    if (offline) { setError("You are offline. Please reconnect to make a payment."); return; }
    if (!navigator.onLine) { setError("No internet connection. Payments require a live connection."); return; }
    if (cart.length === 0) { setError("Your cart is empty."); return; }
    setLoading(true); setError("");
    try {
      const token = localStorage.getItem("dunazoe_token");
      const res = await fetch(`${API}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: cart, delivery_address: form.address, state: form.state, city: form.city, payment_method: payMethod, total }),
      });
      const data = await res.json();
      if (data.payment_url) { window.location.href = data.payment_url; return; }
      if (data.success) {
        localStorage.setItem("dunazoe_cart", "[]");
        window.location.href = `/orders/${data.order_id}`;
      } else {
        setError(data.error || "Checkout failed. Please try again.");
      }
    } catch (_) {
      setError("Checkout failed. Please check your connection and try again.");
    } finally { setLoading(false); }
  }

  if (cart.length === 0) return (
    <PageShell title="Checkout" icon="💳" authRequired={true} subtitle="Secure payment checkout">
      <div className="empty-state">
        <span className="empty-icon">🛒</span>
        <p className="empty-title">Cart is empty</p>
        <p className="empty-body">Add items before checking out.</p>
        <Link href="/products" className="btn btn-primary">Shop Now</Link>
      </div>
    </PageShell>
  );

  return (
    <PageShell title="Checkout" icon="💳" authRequired={true}
      subtitle="Complete your purchase securely"
      breadcrumb={[{ href: "/cart", label: "Cart" }, { label: "Checkout" }]}>
      {offline && (
        <div className="alert alert-error" style={{ marginBottom: "20px" }}>
          📡 You're offline. <strong>Payments require a live internet connection.</strong> Please reconnect before placing your order.
        </div>
      )}
      {error && <div className="alert alert-error" style={{ marginBottom: "20px" }}>⚠️ {error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "24px", alignItems: "start" }}>
        <form onSubmit={handleCheckout} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="card"><div className="card-body">
            <h3 style={{ fontWeight: 700, marginBottom: "16px" }}>Delivery Details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[["name","Full Name","text"],["email","Email","email"],["phone","Phone Number","tel"],["address","Delivery Address","text"],["state","State","text"],["city","City / Town","text"]].map(([key, label, type]) => (
                <div key={key} className="form-group">
                  <label className="form-label">{label}</label>
                  <input className="form-input" type={type} required value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={label} />
                </div>
              ))}
            </div>
          </div></div>
          <div className="card"><div className="card-body">
            <h3 style={{ fontWeight: 700, marginBottom: "16px" }}>Payment Method</h3>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "12px" }}>⚠️ Cash on delivery is not available. All payments are digital and secured.</p>
            {[
              { id: "paystack", label: "Paystack", icon: "💳", desc: "Pay with card, bank transfer, or USSD" },
              { id: "stripe", label: "Stripe", icon: "🌍", desc: "International cards (USD/EUR)" },
              { id: "wallet", label: "DUNAZOE Wallet", icon: "💰", desc: "Pay from your wallet balance" },
            ].map(m => (
              <label key={m.id} style={{ display: "flex", gap: "12px", alignItems: "center", padding: "12px", borderRadius: "12px", border: `1.5px solid ${payMethod === m.id ? "var(--dz-blue)" : "var(--border)"}`, background: payMethod === m.id ? "var(--dz-gradient-soft)" : "transparent", cursor: "pointer", marginBottom: "8px" }}>
                <input type="radio" name="pay" value={m.id} checked={payMethod === m.id} onChange={() => setPayMethod(m.id)} style={{ accentColor: "var(--dz-blue)" }} />
                <span style={{ fontSize: "1.2rem" }}>{m.icon}</span>
                <div><p style={{ fontWeight: 600, fontSize: "0.9rem" }}>{m.label}</p><p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{m.desc}</p></div>
              </label>
            ))}
          </div></div>
          <button type="submit" disabled={loading || offline} className="btn btn-primary btn-lg" style={{ justifyContent: "center" }}>
            {loading ? "Processing…" : offline ? "🔌 No Connection" : `Pay ₦${total.toLocaleString("en-NG")} →`}
          </button>
        </form>
        <div className="card" style={{ position: "sticky", top: "80px" }}>
          <div className="card-body">
            <p style={{ fontWeight: 700, marginBottom: "12px" }}>Order Summary</p>
            {cart.map(i => (
              <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "6px", color: "var(--text-secondary)" }}>
                <span>{i.name?.slice(0, 18)}{i.name?.length > 18 ? "…" : ""} ×{i.qty || 1}</span>
                <span>₦{(parseFloat(i.price || 0) * (i.qty || 1)).toLocaleString("en-NG")}</span>
              </div>
            ))}
            <div className="glow-divider" style={{ margin: "10px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
              <span>Total</span>
              <span className="text-gradient">₦{total.toLocaleString("en-NG")}</span>
            </div>
            <div style={{ marginTop: "12px", padding: "10px", background: "rgba(0,200,150,0.08)", borderRadius: "8px", fontSize: "0.78rem", color: "var(--success)" }}>
              🔒 Protected by DUNAZOE Escrow
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
