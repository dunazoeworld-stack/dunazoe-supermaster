"use client";
import { useState } from "react";
import Link from "next/link";

const FAQS = [
  { q: "How do I place an order?",          a: "Browse products, add items to cart, proceed to checkout, and pay via Paystack (NGN) or Stripe (card). You'll receive an order confirmation by email." },
  { q: "How does payment work?",            a: "We support Paystack for NGN payments and Stripe for card payments. Funds are held in escrow until your order is delivered and confirmed." },
  { q: "How do I become a vendor?",         a: 'Click "Sell on DUNAZOE" on the homepage, complete vendor onboarding, and verify your identity via KYC. Your store is live within minutes.' },
  { q: "How are vendors paid?",             a: "Vendor payouts are processed 24 hours after order delivery confirmation. A 5% service charge applies. Payouts go to your DUNAZOE wallet." },
  { q: "What is Personal Savings?",         a: "Personal Savings is DUNAZOE's group savings feature. Join or create a savings group, contribute regularly, and each member gets a lump sum in rotation." },
  { q: "How does delivery work?",           a: "We support courier partners and vendor self-delivery. At checkout, available delivery options are shown based on your location." },
  { q: "Can I track my order?",             a: 'Yes — go to Orders and click your order to see real-time status. You\'ll also get in-app and push notifications at each stage.' },
  { q: "How do I request a refund?",        a: "Contact us via this support page with your order ID. Refunds are processed within 3–5 business days for eligible orders." },
  { q: "Is my data safe?",                  a: "Yes. All data is encrypted at rest and in transit. We do not sell personal data. Read our Privacy Policy for full details." },
  { q: "What is KYC verification?",         a: "Know Your Customer (KYC) verifies your identity for high-value transactions and vendor status. Required for wallet withdrawals above ₦50,000." },
];

export default function SupportPage() {
  const [open,    setOpen]    = useState(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent,    setSent]    = useState(false);
  const [sending, setSending] = useState(false);

  async function submitTicket(e) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    const mailSubject = encodeURIComponent(`[DUNAZOE Support] ${subject}`);
    const mailBody = encodeURIComponent(message.trim());
    window.location.href = `mailto:support@dunazoe.com?subject=${mailSubject}&body=${mailBody}`;
    setSent(true);
    setSending(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", padding: "0 0 60px" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--border)", padding: "28px 0 24px" }}>
        <div className="container">
          <h1 style={{ fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px" }}>🆘 Support Centre</h1>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>Get help, find answers, or contact our team</p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: "36px" }}>
        {/* Quick action cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "44px" }}>
          {[
            { icon: "📦", label: "Track Order",     href: "/track",  desc: "Check live delivery status" },
            { icon: "💳", label: "Payment Issues",  href: "#contact",desc: "Refunds, failed payments" },
            { icon: "🏪", label: "Vendor Help",     href: "/vendor/onboard", desc: "Selling on DUNAZOE" },
            { icon: "🪪", label: "KYC / Identity",  href: "/kyc",    desc: "Verify your account" },
            { icon: "💰", label: "Wallet",           href: "/wallet", desc: "Top-up, withdrawals" },
            { icon: "🚚", label: "Delivery",        href: "/deliver", desc: "Become a delivery agent" },
          ].map(({ icon, label, href, desc }) => (
            <Link key={label} href={href} style={{
              display: "flex", flexDirection: "column", gap: "6px", padding: "18px 16px",
              borderRadius: "14px", border: "1px solid var(--border)", background: "var(--surface)",
              textDecoration: "none", color: "var(--text)", transition: "border-color 0.15s",
            }}>
              <span style={{ fontSize: "1.5rem" }}>{icon}</span>
              <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{label}</span>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{desc}</span>
            </Link>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "40px", alignItems: "start" }} className="support-grid">
          {/* FAQ */}
          <div>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 16px" }}>Frequently Asked Questions</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {FAQS.map((faq, i) => (
                <div key={i} style={{ borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                  <button onClick={() => setOpen(open === i ? null : i)} style={{
                    width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "14px 16px", background: open === i ? "rgba(0,163,255,0.06)" : "var(--surface)",
                    border: "none", cursor: "pointer", textAlign: "left", gap: "12px",
                  }}>
                    <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text)" }}>{faq.q}</span>
                    <span style={{ color: "var(--dz-blue)", fontSize: "1rem", transform: open === i ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>▾</span>
                  </button>
                  {open === i && (
                    <div style={{ padding: "4px 16px 14px", background: "rgba(0,163,255,0.04)", fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.65 }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Contact form */}
          <div id="contact" style={{ position: "sticky", top: "80px" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 16px" }}>Contact Support</h2>
            {sent ? (
              <div style={{ padding: "28px", borderRadius: "16px", border: "1px solid rgba(0,220,100,0.25)", background: "rgba(0,220,100,0.06)", textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>✅</div>
                <p style={{ fontWeight: 700, marginBottom: "6px" }}>Ticket received!</p>
                 <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Your email app was opened with the support request. Send it there and we'll respond within 24 hours.</p>
                <button onClick={() => { setSent(false); setSubject(""); setMessage(""); }} style={{ marginTop: "16px", padding: "8px 20px", borderRadius: "10px", background: "var(--dz-blue)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  Submit another
                </button>
              </div>
            ) : (
              <form onSubmit={submitTicket} style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "20px", borderRadius: "16px", border: "1px solid var(--border)", background: "var(--surface)" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>SUBJECT</label>
                  <select value={subject} onChange={e => setSubject(e.target.value)} required style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.88rem" }}>
                    <option value="">Select a topic…</option>
                    <option>Order issue</option>
                    <option>Payment / Refund</option>
                    <option>Vendor / Selling</option>
                    <option>Delivery problem</option>
                    <option>Account / KYC</option>
                    <option>Technical bug</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>MESSAGE</label>
                  <textarea value={message} onChange={e => setMessage(e.target.value)} required rows={5} placeholder="Describe your issue…" style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.88rem", resize: "vertical", boxSizing: "border-box" }} />
                </div>
                <button type="submit" disabled={sending || !subject || !message.trim()} style={{ padding: "12px", borderRadius: "11px", background: (sending || !subject || !message.trim()) ? "var(--border)" : "var(--dz-blue)", color: "#fff", border: "none", cursor: (sending || !subject || !message.trim()) ? "default" : "pointer", fontWeight: 700, fontSize: "0.9rem" }}>
                  {sending ? "Sending…" : "Send Message"}
                </button>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center" }}>
                   This opens your email app; the form does not submit to a hidden ticket system. Or email <a href="mailto:support@dunazoe.com" style={{ color: "var(--dz-blue)" }}>support@dunazoe.com</a>
                </p>
              </form>
            )}

            {/* Social / direct contact */}
            <div style={{ marginTop: "16px", padding: "16px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface)", fontSize: "0.84rem", color: "var(--text-secondary)" }}>
              <p style={{ margin: "0 0 8px", fontWeight: 700, color: "var(--text)" }}>Also reach us on</p>
               <p style={{ margin: "0 0 4px" }}>📱 WhatsApp: <a href="https://wa.me/2347056916999" target="_blank" rel="noreferrer" style={{ color: "var(--dz-blue)" }}>07056916999</a></p>
               <p style={{ margin: "0 0 4px" }}>🐦 Twitter/X: <a href="https://x.com/DunazoeWorld" target="_blank" rel="noreferrer" style={{ color: "var(--dz-blue)" }}>@DunazoeWorld</a></p>
              <p style={{ margin: 0 }}>🕐 Hours: Mon–Sat, 8am–8pm WAT</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .support-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
