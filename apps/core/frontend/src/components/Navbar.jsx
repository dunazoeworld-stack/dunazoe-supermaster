"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import NotificationBell from "./NotificationBell";
import { ThemeToggle } from "./ThemeProvider";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser]         = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      const u = localStorage.getItem("dunazoe_user");
      if (u) setUser(JSON.parse(u));
    } catch (_) {}
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  function handleLogout() {
    localStorage.removeItem("dunazoe_token");
    localStorage.removeItem("dunazoe_user");
    window.location.href = "/login";
  }

  const isActive = (href) => pathname === href;

  return (
    <>
      <nav style={{
        position: "sticky", top: 0, zIndex: 200,
        background: scrolled ? "var(--nav-bg-scrolled)" : "var(--nav-bg)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${scrolled ? "var(--border-strong)" : "var(--border)"}`,
        transition: "all 0.25s ease",
      }}>
        <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "60px" }}>
          <Link href="/" className="dz-logo" aria-label="DUNAZOE Home">
            <Image src="/assets/dunazoe-logo.jpg" alt="DUNAZOE" width={36} height={36} priority style={{ borderRadius: "8px", boxShadow: "0 0 14px rgba(0,163,255,0.45)" }} />
            <span className="dz-logo-text">DUNAZOE</span>
          </Link>

          {/* Desktop nav */}
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }} className="desktop-nav">
            {[
              { href: "/products", label: "Shop" },
              { href: "/vendors", label: "Vendors" },
              { href: "/thrift", label: "Ajo" },
              { href: "/services", label: "Services" },
            ].map(({ href, label }) => (
              <Link key={href} href={href} style={{
                padding: "7px 14px", borderRadius: "9px", fontSize: "0.85rem", fontWeight: 600,
                color: isActive(href) ? "var(--dz-blue)" : "var(--text-secondary)",
                textDecoration: "none",
                background: isActive(href) ? "rgba(0,163,255,0.1)" : "transparent",
                transition: "all 0.15s",
              }}>{label}</Link>
            ))}
          </div>

          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            {/* Theme toggle */}
            <ThemeToggle compact />

            {/* Cart */}
            <Link href="/cart" style={{ position: "relative", display: "flex", alignItems: "center", padding: "7px", borderRadius: "9px", color: "var(--text-secondary)", textDecoration: "none", fontSize: "1.1rem" }} aria-label="Cart">🛒</Link>

            {/* Notification Bell (logged in only) */}
            <NotificationBell />

            {user ? (
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <Link href="/dashboard" style={{ padding: "7px 14px", borderRadius: "9px", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", textDecoration: "none" }}>
                  {user.name?.split(" ")[0]}
                </Link>
                {/* Vendor shortcut */}
                {user.role === "vendor" && (
                  <Link href="/vendor/dashboard" style={{ padding: "7px 10px", borderRadius: "9px", fontSize: "0.78rem", fontWeight: 600, color: "var(--dz-blue)", textDecoration: "none", background: "rgba(0,163,255,0.1)" }}>
                    🏪
                  </Link>
                )}
                <button onClick={handleLogout} className="btn btn-ghost btn-sm">Sign Out</button>
              </div>
            ) : (
              <Link href="/login" className="btn btn-primary btn-sm">Sign In</Link>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              style={{ display: "none", background: "none", border: "none", cursor: "pointer", padding: "6px", color: "var(--text-secondary)", fontSize: "1.4rem" }}
              className="hamburger-btn"
            >
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="mobile-menu-drawer">
            {/* Primary nav links */}
            <div className="mobile-menu-section">
              {[
                { href: "/products", label: "🛒 Shop" },
                { href: "/vendors",  label: "🏪 Vendors" },
                { href: "/thrift",   label: "⬡ Ajo Savings" },
                { href: "/services", label: "⚡ Services" },
                { href: "/cart",     label: "🛒 Cart" },
                { href: "/orders",   label: "📦 Orders" },
                { href: "/profile",  label: "👤 Profile" },
              ].map(({ href, label }) => (
                <Link key={href} href={href} className={`mobile-menu-link${isActive(href) ? " active" : ""}`}>{label}</Link>
              ))}
            </div>

            {/* More section */}
            <p className="mobile-menu-heading">More</p>
            <div className="mobile-menu-section">
              {[
                { href: "/wallet",               label: "💳 Wallet" },
                { href: "/notifications",        label: "🔔 Notifications" },
                { href: "/messages",             label: "💬 Messages" },
                ...(user?.role === "vendor" || user?.role === "admin" || user?.role === "superuser"
                  ? [
                      { href: "/vendor/dashboard", label: "🏪 Vendor Dashboard" },
                      { href: "/vendor/marketing", label: "📣 Marketing AI" },
                    ]
                  : []),
                ...(user?.role === "admin" || user?.role === "superuser"
                  ? [{ href: "/ops", label: "🔧 Admin Panel" }]
                  : []),
                { href: "/deliver",  label: "🚗 Delivery" },
                { href: "/kyc",      label: "🪪 KYC / Verify" },
                { href: "/settings", label: "⚙️ Settings" },
                { href: "/support",  label: "🆘 Support" },
              ].map(({ href, label }) => (
                <Link key={href} href={href} className={`mobile-menu-link${isActive(href) ? " active" : ""}`}>{label}</Link>
              ))}
            </div>

            <div style={{ borderTop: "1px solid var(--border)", marginTop: "8px", paddingTop: "12px" }}>
              {user ? (
                <button onClick={handleLogout} className="btn btn-ghost" style={{ width: "100%" }}>Sign Out</button>
              ) : (
                <Link href="/login" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>Sign In →</Link>
              )}
            </div>
          </div>
        )}
      </nav>
      <style>{`
        :root {
          --nav-bg: rgba(4,9,28,0.92);
          --nav-bg-scrolled: rgba(4,9,28,0.97);
        }
        [data-theme="light"] {
          --nav-bg: rgba(240,244,250,0.92);
          --nav-bg-scrolled: rgba(240,244,250,0.97);
        }
        @media (prefers-color-scheme: light) {
          :root:not([data-theme="dark"]) {
            --nav-bg: rgba(240,244,250,0.92);
            --nav-bg-scrolled: rgba(240,244,250,0.97);
          }
        }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .hamburger-btn { display: flex !important; }
        }
        .mobile-menu-drawer {
          background: var(--bg);
          border-top: 1px solid var(--border);
          padding: 12px 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          max-height: calc(100vh - 60px);
          overflow-y: auto;
        }
        .mobile-menu-section {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-bottom: 4px;
        }
        .mobile-menu-heading {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 8px 14px 4px;
        }
        .mobile-menu-link {
          display: block;
          padding: 11px 14px;
          border-radius: 10px;
          font-size: 0.92rem;
          font-weight: 600;
          color: var(--text);
          text-decoration: none;
          background: transparent;
          transition: background 0.15s;
        }
        .mobile-menu-link:hover, .mobile-menu-link:active {
          background: var(--surface-hover);
          color: var(--text);
        }
        .mobile-menu-link.active {
          color: var(--dz-blue);
          background: var(--dz-gradient-soft);
        }
      `}</style>
    </>
  );
}
