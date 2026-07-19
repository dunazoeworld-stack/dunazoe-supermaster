"use client";
/**
 * DUNAZOE Checkout — with real-time AI logistics quote engine.
 * Shows cheapest + fastest shipping options before payment.
 * Logistics AI: Self-Delivery → DUNAZOE Express → Shipbubble → GIG → DHL → FedEx/UPS
 */
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

// ── Delivery fee display helper ────────────────────────────────────────────────
function formatNGN(n) {
  if (!n && n !== 0) return "—";
  if (n === 0) return "FREE";
  return `₦${parseInt(n).toLocaleString("en-NG")}`;
}

// ── Shipping Quote Card ────────────────────────────────────────────────────────
function ShippingCard({ quote, selected, onSelect }) {
  return (
    <label style={{
      display: "flex", gap: "12px", alignItems: "flex-start", padding: "14px 16px",
      borderRadius: "14px", cursor: "pointer", marginBottom: "10px",
      border: `1.5px solid ${selected ? "var(--dz-blue)" : "var(--border)"}`,
      background: selected ? "rgba(0,163,255,0.07)" : "rgba(255,255,255,0.02)",
      transition: "border-color 0.2s, background 0.2s",
    }}>
      <input
        type="radio" name="shipping" value={quote.id}
        checked={selected} onChange={() => onSelect(quote)}
        style={{ accentColor: "var(--dz-blue)", marginTop: "2px", flexShrink: 0 }}
      />
      <span style={{ fontSize: "1.4rem", lineHeight: 1, flexShrink: 0 }}>{quote.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: "0.92rem" }}>{quote.name}</span>
          {quote.badge && (
            <span style={{
              fontSize: "0.65rem", fontWeight: 800, padding: "2px 7px", borderRadius: "6px",
              background: quote.badge_color + "22", color: quote.badge_color, border: `1px solid ${quote.badge_color}44`,
            }}>{quote.badge}</span>
          )}
        </div>
        <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", margin: "2px 0 0" }}>{quote.description}</p>
        <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", margin: "1px 0 0" }}>⏱ {quote.eta_label}</p>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{
          fontWeight: 800, fontSize: quote.is_free ? "0.9rem" : "1rem",
          color: quote.is_free ? "#10B981" : "var(--text-primary)",
        }}>{formatNGN(quote.cost_ngn)}</p>
      </div>
    </label>
  );
}

export default function CheckoutPage() {
  const [cart,        setCart]        = useState([]);
  const [form,        setForm]        = useState({ name: "", email: "", phone: "", address: "", state: "", city: "" });
  const [payMethod,   setPayMethod]   = useState("paystack");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [offline,     setOffline]     = useState(false);

  // ── Logistics ───────────────────────────────────────────────────────────────
  const [quotes,         setQuotes]         = useState([]);
  const [quotesLoading,  setQuotesLoading]  = useState(false);
  const [quotesError,    setQuotesError]    = useState("");
  const [selectedShip,   setSelectedShip]   = useState(null);
  const [aiNote,         setAiNote]         = useState("");
  const quoteDebounce    = useRef(null);
  const lastQuoteKey     = useRef("");

  useEffect(() => {
    try { setCart(JSON.parse(localStorage.getItem("dunazoe_cart") || "[]")); } catch (_) {}
    try {
      const u = JSON.parse(localStorage.getItem("dunazoe_user") || "{}");
      setForm(f => ({ ...f, name: u.name || "", email: u.email || "" }));
    } catch (_) {}
    setOffline(!navigator.onLine);
    const go  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", go);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", go); window.removeEventListener("offline", off); };
  }, []);

  // ── Fetch shipping quotes whenever city/state changes ───────────────────────
  const fetchQuotes = useCallback(async (city, state) => {
    if (!city || !state) { setQuotes([]); return; }
    const key = `${city}|${state}`;
    if (key === lastQuoteKey.current) return;
    lastQuoteKey.current = key;

    setQuotesLoading(true);
    setQuotesError("");
    try {
      const res = await fetch("/api/logistics/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin_city: "lagos", origin_state: "lagos", // default origin (vendor HQ)
          dest_city: city, dest_state: state,
          dest_country: "nigeria",
          order_amount: cart.reduce((s, i) => s + parseFloat(i.price||0)*(i.qty||1), 0),
        }),
      });
      const data = await res.json();
      if (data.success && data.quotes?.length) {
        setQuotes(data.quotes);
        setAiNote(data.ai_note || "");
        // Auto-select best option
        if (!selectedShip) setSelectedShip(data.quotes[0]);
      } else {
        setQuotesError("Could not load shipping options. Standard rates apply.");
      }
    } catch (_) {
      setQuotesError("Shipping quote unavailable — you'll see the rate at dispatch.");
    } finally {
      setQuotesLoading(false);
    }
  }, [cart, selectedShip]);

  // Debounce city/state changes by 600ms
  useEffect(() => {
    if (quoteDebounce.current) clearTimeout(quoteDebounce.current);
    quoteDebounce.current = setTimeout(() => {
      fetchQuotes(form.city.trim(), form.state.trim());
    }, 600);
    return () => clearTimeout(quoteDebounce.current);
  }, [form.city, form.state, fetchQuotes]);

  const SYSTEM_CHARGE_PCT = 0.05; // 5% system charge on delivery fee
  const subtotal      = cart.reduce((s, i) => s + parseFloat(i.price || 0) * (i.qty || 1), 0);
  const shippingFee   = selectedShip?.cost_ngn || 0;
  const serviceCharge = parseFloat((shippingFee * SYSTEM_CHARGE_PCT).toFixed(2));
  const total         = subtotal + shippingFee + serviceCharge;

  async function handleCheckout(e) {
    e.preventDefault();
    if (offline) { setError("You are offline. Please reconnect to make a payment."); return; }
    if (!navigator.onLine) { setError("No internet connection. Payments require a live connection."); return; }
    if (cart.length === 0) { setError("Your cart is empty."); return; }
    if (!selectedShip && quotes.length > 0) { setError("Please select a delivery option."); return; }
    setLoading(true); setError("");
    try {
      const token = localStorage.getItem("dunazoe_token");
      const res = await fetch(`${API}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items:            cart,
          delivery_address: form.address,
          state:            form.state,
          city:             form.city,
          payment_method:   payMethod,
          total,
          subtotal,
          shipping_fee:     shippingFee + serviceCharge,
          service_charge:   serviceCharge,
          shipping_method:  selectedShip?.id || "standard",
          shipping_courier: selectedShip?.courier_id || selectedShip?.type || null,
        }),
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
    } finally {
      setLoading(false);
    }
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "24px", alignItems: "start" }}>
        <form onSubmit={handleCheckout} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* ── Delivery Details ────────────────────────────────────────────── */}
          <div className="card"><div className="card-body">
            <h3 style={{ fontWeight: 700, marginBottom: "16px" }}>📍 Delivery Details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                ["name","Full Name","text"],
                ["email","Email","email"],
                ["phone","Phone Number","tel"],
                ["address","Delivery Address","text"],
              ].map(([key, label, type]) => (
                <div key={key} className="form-group">
                  <label className="form-label">{label}</label>
                  <input className="form-input" type={type} required value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={label} />
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <input className="form-input" type="text" required value={form.state}
                    onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                    placeholder="e.g. Lagos" />
                </div>
                <div className="form-group">
                  <label className="form-label">City / Town</label>
                  <input className="form-input" type="text" required value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="e.g. Ikeja" />
                </div>
              </div>
            </div>
          </div></div>

          {/* ── AI Shipping Options ─────────────────────────────────────────── */}
          <div className="card"><div className="card-body">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <h3 style={{ fontWeight: 700 }}>🚚 Delivery Options</h3>
              {quotesLoading && (
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="dz-spinner" style={{ width: "12px", height: "12px", borderWidth: "2px" }} />
                  Getting quotes…
                </span>
              )}
            </div>

            {!form.city && !form.state && (
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>
                Enter your city & state above to see delivery options
              </p>
            )}

            {quotesError && (
              <div style={{ fontSize: "0.8rem", color: "var(--warning)", padding: "10px 14px", background: "rgba(245,158,11,0.08)", borderRadius: "10px", marginBottom: "12px" }}>
                ⚠️ {quotesError}
              </div>
            )}

            {quotes.length > 0 && (
              <>
                {quotes.map(q => (
                  <ShippingCard key={q.id} quote={q} selected={selectedShip?.id === q.id} onSelect={setSelectedShip} />
                ))}
                {aiNote && (
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "6px" }}>
                    🤖 {aiNote}
                  </p>
                )}
              </>
            )}

            {!quotesLoading && !quotes.length && form.city && (
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", padding: "10px 0" }}>
                Standard shipping will apply — rates confirmed at dispatch.
              </div>
            )}
          </div></div>

          {/* ── Payment Method ──────────────────────────────────────────────── */}
          <div className="card"><div className="card-body">
            <h3 style={{ fontWeight: 700, marginBottom: "16px" }}>💳 Payment Method</h3>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "12px" }}>
              ⚠️ Cash on delivery is not available. All payments are digital and secured.
            </p>
            {[
              { id: "paystack", label: "Paystack", icon: "💳", desc: "Pay with card, bank transfer, or USSD" },
              { id: "stripe",   label: "Stripe",   icon: "🌍", desc: "International cards (USD/EUR)" },
              { id: "wallet",   label: "DUNAZOE Wallet", icon: "💰", desc: "Pay from your wallet balance" },
            ].map(m => (
              <label key={m.id} style={{
                display: "flex", gap: "12px", alignItems: "center", padding: "12px",
                borderRadius: "12px", marginBottom: "8px", cursor: "pointer",
                border: `1.5px solid ${payMethod === m.id ? "var(--dz-blue)" : "var(--border)"}`,
                background: payMethod === m.id ? "var(--dz-gradient-soft)" : "transparent",
              }}>
                <input type="radio" name="pay" value={m.id} checked={payMethod === m.id}
                  onChange={() => setPayMethod(m.id)} style={{ accentColor: "var(--dz-blue)" }} />
                <span style={{ fontSize: "1.2rem" }}>{m.icon}</span>
                <div>
                  <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>{m.label}</p>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{m.desc}</p>
                </div>
              </label>
            ))}
          </div></div>

          <button type="submit" disabled={loading || offline} className="btn btn-primary btn-lg"
            style={{ justifyContent: "center" }}>
            {loading ? "Processing…" : offline ? "🔌 No Connection" : `Pay ₦${total.toLocaleString("en-NG")} →`}
          </button>
        </form>

        {/* ── Order Summary sidebar ────────────────────────────────────────── */}
        <div style={{ position: "sticky", top: "80px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="card"><div className="card-body">
            <p style={{ fontWeight: 700, marginBottom: "12px" }}>Order Summary</p>
            {cart.map(i => (
              <div key={i.id} style={{
                display: "flex", justifyContent: "space-between",
                fontSize: "0.82rem", marginBottom: "6px", color: "var(--text-secondary)",
              }}>
                <span>{i.name?.slice(0, 20)}{i.name?.length > 20 ? "…" : ""} ×{i.qty || 1}</span>
                <span>₦{(parseFloat(i.price || 0) * (i.qty || 1)).toLocaleString("en-NG")}</span>
              </div>
            ))}
            <div className="glow-divider" style={{ margin: "10px 0" }} />

            {/* Subtotal */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.84rem", marginBottom: "4px", color: "var(--text-secondary)" }}>
              <span>Subtotal</span>
              <span>₦{subtotal.toLocaleString("en-NG")}</span>
            </div>

            {/* Shipping */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.84rem", marginBottom: "4px", color: "var(--text-secondary)" }}>
              <span>Shipping{selectedShip ? ` · ${selectedShip.name}` : ""}</span>
              <span style={{ color: shippingFee === 0 && selectedShip ? "#10B981" : "var(--text-secondary)" }}>
                {selectedShip ? formatNGN(shippingFee) : (quotesLoading ? "…" : "TBD")}
              </span>
            </div>

            {/* 5% service charge on delivery */}
            {shippingFee > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.84rem", marginBottom: "4px", color: "var(--text-secondary)" }}>
                <span>Service charge (5%)</span>
                <span>{formatNGN(serviceCharge)}</span>
              </div>
            )}

            <div className="glow-divider" style={{ margin: "10px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
              <span>Total</span>
              <span className="text-gradient">₦{total.toLocaleString("en-NG")}</span>
            </div>

            {/* ETA */}
            {selectedShip && (
              <div style={{ marginTop: "10px", padding: "8px 12px", background: "rgba(0,163,255,0.07)", borderRadius: "8px", fontSize: "0.76rem", color: "var(--dz-blue)" }}>
                ⏱ Estimated delivery: <strong>{selectedShip.eta_label}</strong>
              </div>
            )}

            <div style={{ marginTop: "10px", padding: "10px", background: "rgba(0,200,150,0.08)", borderRadius: "8px", fontSize: "0.78rem", color: "var(--success)" }}>
              🔒 Protected by DUNAZOE Escrow
            </div>
          </div></div>

          {/* AI Cheapest Pick callout */}
          {quotes.length > 0 && selectedShip && (
            <div style={{
              padding: "12px 14px", borderRadius: "12px",
              background: "linear-gradient(135deg,rgba(109,40,217,0.12),rgba(0,163,255,0.06))",
              border: "1px solid rgba(109,40,217,0.2)", fontSize: "0.78rem",
            }}>
              <p style={{ fontWeight: 700, color: "#a78bfa", marginBottom: "4px" }}>🤖 AI Logistics Selection</p>
              <p style={{ color: "var(--text-secondary)" }}>
                Best option for your route: <strong>{quotes[0].name}</strong> at <strong>{formatNGN(quotes[0].cost_ngn)}</strong>.
                Scored by cost (40%), reliability (35%), speed (25%).
              </p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
