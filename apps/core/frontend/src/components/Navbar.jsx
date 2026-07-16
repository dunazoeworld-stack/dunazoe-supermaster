"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import NotificationBell from "./NotificationBell";

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
        background: scrolled ? "rgba(4,9,28,0.97)" : "rgba(4,9,28,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${scrolled ? "rgba(80,160,255,0.2)" : "rgba(80,160,255,0.1)"}`,
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
          <div style={{
            background: "rgba(4,9,28,0.98)", borderTop: "1px solid var(--border)",
            padding: "16px 24px 24px", display: "flex", flexDirection: "column", gap: "4px",
          }}>
            {[
              { href: "/products",         label: "🛒 Shop" },
              { href: "/vendors",          label: "🏪 Vendors" },
              { href: "/thrift",           label: "⬡ Ajo Savings" },
              { href: "/services",         label: "⚡ Services" },
              { href: "/cart",             label: "🛒 Cart" },
              { href: "/wallet",           label: "💳 Wallet" },
              { href: "/orders",           label: "📦 Orders" },
              { href: "/vendor/marketing", label: "📣 Marketing AI" },
            ].map(({ href, label }) => (
              <Link key={href} href={href} style={{
                padding: "12px 14px", borderRadius: "10px", fontSize: "0.95rem", fontWeight: 600,
                color: isActive(href) ? "var(--dz-blue)" : "var(--text)",
                textDecoration: "none", background: isActive(href) ? "rgba(0,163,255,0.1)" : "transparent",
              }}>{label}</Link>
            ))}
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
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .hamburger-btn { display: flex !important; }
        }
      `}</style>
    </>
  );
}
