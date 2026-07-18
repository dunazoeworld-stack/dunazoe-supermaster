"use client";
/**
 * PageShell — main layout wrapper.
 * Hidden Deploy AI / Superuser Panel access:
 *   • Click the "DUNAZOE" text in the footer 5× rapidly → opens /deploy/download
 *   • Keyboard: Ctrl+Shift+D (or Cmd+Shift+D on Mac) anywhere on the page
 * Neither trigger is labelled or visible to regular users.
 */
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter }  from "next/navigation";
import Link           from "next/link";
import Navbar         from "./Navbar";
import NetworkBanner  from "./NetworkBanner";

export default function PageShell({ title, icon, authRequired = true, children, actions, subtitle, breadcrumb }) {
  const router = useRouter();
  const [ready, setReady] = useState(!authRequired);

  // ── Hidden superuser trigger state ──────────────────────────────────────────
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
        router.push("/deploy/download");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  // ── 5-click logo trigger ─────────────────────────────────────────────────────
  const handleLogoClick = useCallback(() => {
    logoClickCount.current += 1;
    if (logoClickTimer.current) clearTimeout(logoClickTimer.current);
    if (logoClickCount.current >= 5) {
      logoClickCount.current = 0;
      router.push("/deploy/download");
      return;
    }
    // Reset counter after 2 s of inactivity
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

            {/* ── Logo — 5-click secret trigger ─────────────────────────────── */}
            <button
              onClick={handleLogoClick}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                background: "none", border: "none", cursor: "default", padding: 0,
              }}
              aria-hidden="true"
              tabIndex={-1}
            >
              <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--dz-blue)" }}>DUNAZOE</span>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>v1.0.0-rc1</span>
            </button>

            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              {[
                ["/products","Shop"], ["/thrift","Ajo"], ["/wallet","Wallet"],
                ["/orders","Orders"], ["/disputes","Disputes"], ["/track","Track"],
              ].map(([href, label]) => (
                <Link key={href} href={href} style={{ fontSize: "0.82rem", color: "var(--text-muted)", textDecoration: "none" }}>
                  {label}
                </Link>
              ))}
            </div>

            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              © 2026 DUNAZOE. All rights reserved.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
