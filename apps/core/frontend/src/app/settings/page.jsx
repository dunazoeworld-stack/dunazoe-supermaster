"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const THEMES = [
  { key: "system", label: "⚙️ System",  desc: "Follows your device preference" },
  { key: "dark",   label: "🌙 Dark",    desc: "Always dark mode" },
  { key: "light",  label: "☀️ Light",   desc: "Always light mode" },
];

const SECTIONS = ["Account", "Appearance", "Notifications", "Privacy", "Danger Zone"];

export default function SettingsPage() {
  const [user,       setUser]       = useState(null);
  const [section,    setSection]    = useState("Account");
  const [theme,      setTheme]      = useState("system");
  const [notifPrefs, setNotifPrefs] = useState({ orders: true, payments: true, promos: false, system: true });
  const [saved,      setSaved]      = useState("");

  useEffect(() => {
    try { setUser(JSON.parse(localStorage.getItem("dunazoe_user") || "{}")); } catch (_) {}
    setTheme(localStorage.getItem("dunazoe_theme") || "system");
  }, []);

  function applyTheme(t) {
    setTheme(t);
    localStorage.setItem("dunazoe_theme", t);
    const root = document.documentElement;
    if (t === "dark")        root.setAttribute("data-theme", "dark");
    else if (t === "light")  root.setAttribute("data-theme", "light");
    else                     root.removeAttribute("data-theme");
    flash("Appearance saved");
  }

  function flash(msg) {
    setSaved(msg);
    setTimeout(() => setSaved(""), 2500);
  }

  function toggleNotif(key) {
    setNotifPrefs(p => ({ ...p, [key]: !p[key] }));
    flash("Notification preferences saved");
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", padding: "0 0 60px" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--border)", padding: "24px 0 20px" }}>
        <div className="container">
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>⚙️ Settings</h1>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>Manage your account and preferences</p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: "28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "28px" }} className="settings-grid">
          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {SECTIONS.map(s => (
              <button key={s} onClick={() => setSection(s)} style={{
                padding: "10px 14px", borderRadius: "10px", textAlign: "left", border: "none", cursor: "pointer",
                background: section === s ? "rgba(0,163,255,0.1)" : "transparent",
                color: section === s ? "var(--dz-blue)" : "var(--text-secondary)",
                fontWeight: section === s ? 700 : 500, fontSize: "0.88rem", transition: "all 0.15s",
              }}>
                {s}
              </button>
            ))}
          </div>

          {/* Panel */}
          <div>
            {saved && (
              <div style={{ padding: "10px 16px", background: "rgba(0,220,100,0.12)", border: "1px solid rgba(0,220,100,0.25)", borderRadius: "10px", color: "#00dc64", fontSize: "0.85rem", marginBottom: "16px" }}>
                ✅ {saved}
              </div>
            )}

            {/* Account */}
            {section === "Account" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 8px" }}>Account</h2>
                {user && (
                  <div style={{ padding: "16px", background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)" }}>
                    <p style={{ margin: "0 0 4px", fontWeight: 700 }}>{user.name || "—"}</p>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>{user.email || "—"}</p>
                    <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "var(--dz-blue)", textTransform: "uppercase", fontWeight: 700 }}>{user.role || "customer"}</p>
                  </div>
                )}
                <Link href="/profile" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 18px", borderRadius: "11px", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", textDecoration: "none", fontWeight: 600, fontSize: "0.88rem" }}>
                  👤 Edit Profile & Password →
                </Link>
                <Link href="/kyc" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 18px", borderRadius: "11px", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", textDecoration: "none", fontWeight: 600, fontSize: "0.88rem" }}>
                  🪪 Verify Identity (KYC) →
                </Link>
                <Link href="/wallet" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 18px", borderRadius: "11px", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", textDecoration: "none", fontWeight: 600, fontSize: "0.88rem" }}>
                  💳 Wallet & Payments →
                </Link>
              </div>
            )}

            {/* Appearance */}
            {section === "Appearance" && (
              <div>
                <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 16px" }}>Appearance</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {THEMES.map(t => (
                    <button key={t.key} onClick={() => applyTheme(t.key)} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "14px 16px", borderRadius: "12px", border: theme === t.key ? "2px solid var(--dz-blue)" : "1px solid var(--border)",
                      background: theme === t.key ? "rgba(0,163,255,0.07)" : "var(--surface)",
                      cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                    }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "var(--text)" }}>{t.label}</p>
                        <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>{t.desc}</p>
                      </div>
                      {theme === t.key && <span style={{ color: "var(--dz-blue)", fontSize: "1.2rem" }}>✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Notifications */}
            {section === "Notifications" && (
              <div>
                <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 16px" }}>Notification Preferences</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {Object.entries({
                    orders:   { label: "📦 Orders", desc: "Dispatch, delivery, and status updates" },
                    payments: { label: "💳 Payments", desc: "Payment confirmations and refunds" },
                    promos:   { label: "🎁 Promotions", desc: "Deals, discounts, and special offers" },
                    system:   { label: "🔔 System", desc: "Security alerts and account notices" },
                  }).map(([key, { label, desc }]) => (
                    <div key={key} onClick={() => toggleNotif(key)} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "14px 16px", borderRadius: "12px", border: "1px solid var(--border)",
                      background: "var(--surface)", cursor: "pointer",
                    }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9rem", color: "var(--text)" }}>{label}</p>
                        <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>{desc}</p>
                      </div>
                      <div style={{
                        width: "44px", height: "24px", borderRadius: "12px", position: "relative",
                        background: notifPrefs[key] ? "var(--dz-blue)" : "var(--border-strong)",
                        transition: "background 0.2s", flexShrink: 0,
                      }}>
                        <div style={{
                          position: "absolute", top: "3px", left: notifPrefs[key] ? "23px" : "3px",
                          width: "18px", height: "18px", borderRadius: "50%", background: "#fff",
                          transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Privacy */}
            {section === "Privacy" && (
              <div>
                <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 16px" }}>Privacy</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {[
                    { label: "Privacy Policy",        href: "/support#privacy",  icon: "🔏" },
                    { label: "Terms of Service",       href: "/support#terms",    icon: "📋" },
                    { label: "Data & Cookie Policy",   href: "/support#data",     icon: "🍪" },
                    { label: "Request Data Export",    href: "/support#export",   icon: "📤" },
                  ].map(({ label, href, icon }) => (
                    <Link key={label} href={href} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", textDecoration: "none", fontWeight: 600, fontSize: "0.88rem" }}>
                      <span style={{ fontSize: "1.1rem" }}>{icon}</span> {label}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Danger Zone */}
            {section === "Danger Zone" && (
              <div>
                <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 6px", color: "#ff4444" }}>⚠️ Danger Zone</h2>
                <p style={{ margin: "0 0 20px", fontSize: "0.85rem", color: "var(--text-muted)" }}>These actions are permanent and cannot be undone.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid rgba(255,68,68,0.3)", background: "rgba(255,68,68,0.05)" }}>
                    <p style={{ margin: "0 0 4px", fontWeight: 700, color: "var(--text)" }}>Sign out all devices</p>
                    <p style={{ margin: "0 0 12px", fontSize: "0.82rem", color: "var(--text-muted)" }}>Invalidates all active sessions across devices.</p>
                    <button onClick={() => { localStorage.clear(); window.location.href = "/login"; }} style={{ padding: "8px 18px", borderRadius: "9px", border: "1px solid rgba(255,68,68,0.4)", background: "transparent", color: "#ff6666", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
                      Sign out everywhere
                    </button>
                  </div>
                  <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid rgba(255,68,68,0.3)", background: "rgba(255,68,68,0.05)" }}>
                    <p style={{ margin: "0 0 4px", fontWeight: 700, color: "var(--text)" }}>Delete account</p>
                    <p style={{ margin: "0 0 12px", fontSize: "0.82rem", color: "var(--text-muted)" }}>All your data, orders, and wallet balance will be permanently deleted. Contact support to proceed.</p>
                    <Link href="/support#delete-account" style={{ display: "inline-block", padding: "8px 18px", borderRadius: "9px", border: "1px solid rgba(255,68,68,0.4)", background: "transparent", color: "#ff6666", textDecoration: "none", fontWeight: 600, fontSize: "0.85rem" }}>
                      Request account deletion →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .settings-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
