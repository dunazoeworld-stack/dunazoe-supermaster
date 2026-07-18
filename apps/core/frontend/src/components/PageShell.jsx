"use client";
/**
 * PageShell — main layout wrapper.
 *
 * Deployment AI / Superuser Panel — TWO secret access methods:
 *   1. Keyboard: Ctrl+Shift+D (or Cmd+Shift+D on Mac) anywhere on site
 *   2. Footer:  click the "DUNAZOE" text 5× rapidly within 2 s
 *
 * BOTH methods are restricted to the two authorised superuser accounts:
 *   • dunazoeworld@gmail.com
 *   • comfortwins@gmail.com
 * Any other account silently ignores the trigger (no error shown).
 */
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter }  from "next/navigation";
import Link           from "next/link";
import Navbar         from "./Navbar";
import NetworkBanner  from "./NetworkBanner";

const SUPERUSERS = ["dunazoeworld@gmail.com", "comfortwins@gmail.com"];

function isSuperuser() {
  try {
    const user = JSON.parse(localStorage.getItem("dunazoe_user") || "{}");
    return SUPERUSERS.includes((user.email || "").toLowerCase().trim());
  } catch { return false; }
}

export default function PageShell({ title, icon, authRequired = true, children, actions, subtitle, breadcrumb }) {
  const router = useRouter();
  const [ready, setReady] = useState(!authRequired);

  const logoClickCount = useRef(0);
  const logoClickTimer = useRef(null);

  // Auth guard
  useEffect(() => {
    if (authRequired) {
      const token = localStorage.getItem("dunazoe_token");
      if (!token) { router.replace("/login"); return; }
      setReady(true);
    }
  }, [authRequired, router]);

  // ── Keyboard shortcut: Ctrl+Shift+D / Cmd+Shift+D ───────────────────────────
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "D") {
        e.preventDefault();
        if (isSuperuser()) router.push("/deploy/download");
        // silently ignored for non-superusers
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  // ── 5-rapid-click logo trigger ───────────────────────────────────────────────
  const handleLogoClick = useCallback(() => {
    logoClickCount.current += 1;
    if (logoClickTimer.current) clearTimeout(logoClickTimer.current);
    if (logoClickCount.current >= 5) {
      logoClickCount.current = 0;
      if (isSuperuser()) router.push("/deploy/download");
      return;
    }
    logoClickTimer.current = setTimeout(() => { logoClickCount.current = 0; }, 2000);
  }, [router]);

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="dz-spinner" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <NetworkBanner />
      <Navbar />
      <main>
        <div className="container">
          {breadcrumb && (
            <div style={{ paddingTop: "20px", fontSize: "0.82rem", color: "var(--text-muted)" }}>
              {breadcrumb.map((b, i) => (
                <span key={i}>
                  {i > 0 && <span style={{ margin: "0 6px" }}>›</span>}
                  {b.href
                    ? <Link href={b.href} style={{ color: "var(--dz-blue)", textDecoration: "none" }}>{b.label}</Link>
                    : <span>{b.label}</span>}
                </span>
              ))}
            </div>
          )}
          <div className="page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h1 className="page-title">
                {icon && <span style={{ marginRight: "10px" }}>{icon}</span>}
                <span className="text-gradient">{title}</span>
              </h1>
              {subtitle && <p className="page-subtitle">{subtitle}</p>}
            </div>
            {actions && <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>{actions}</div>}
          </div>
          {children}
        </div>
      </main>

      <footer style={{
        marginTop: "80px", padding: "32px 0 24px",
        borderTop: "1px solid var(--border)",
        background: "rgba(0,0,0,0.2)",
      }}>
        <div className="container">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>

            {/* Hidden 5-click trigger — looks like a normal logo */}
            <button
              onClick={handleLogoClick}
              style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", cursor: "default", padding: 0 }}
              aria-hidden="true" tabIndex={-1}
            >
              <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--dz-blue)" }}>DUNAZOE</span>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>v1.0.0-rc1</span>
            </button>

            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              {[
                ["/products","Shop"],["/thrift","Ajo"],["/wallet","Wallet"],
                ["/orders","Orders"],["/disputes","Disputes"],["/track","Track"],
              ].map(([href, label]) => (
                <Link key={href} href={href} style={{ fontSize: "0.82rem", color: "var(--text-muted)", textDecoration: "none" }}>
                  {label}
                </Link>
              ))}
            </div>

            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>© 2026 DUNAZOE. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
