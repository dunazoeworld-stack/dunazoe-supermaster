"use client";
/**
 * DUNAZOE UpdateNotifier
 * Detects new service worker installations and app version bumps,
 * then shows a dismissible banner inviting the user to update.
 */
import { useState, useEffect, useRef } from "react";

const POLL_INTERVAL = 5 * 60 * 1000; // 5 min

export default function UpdateNotifier() {
  const [show,    setShow]    = useState(false);
  const [message, setMessage] = useState("New update available");
  const [loading, setLoading] = useState(false);
  const knownVersion = useRef(null);
  const swReg        = useRef(null);

  // ── Service Worker update detection ────────────────────────────────────────
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((reg) => {
      swReg.current = reg;

      // Check if a waiting SW already exists (e.g. user had app open during deploy)
      if (reg.waiting) {
        setMessage("🚀 Update installed — tap to apply");
        setShow(true);
      }

      // Listen for new SW arriving
      reg.addEventListener("updatefound", () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener("statechange", () => {
          if (newSW.state === "installed" && navigator.serviceWorker.controller) {
            setMessage("🚀 Update ready — tap to refresh");
            setShow(true);
          }
        });
      });
    });

    // When SW activates and broadcasts SW_ACTIVATED, do a silent reload if the tab was hidden
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data?.type === "SW_ACTIVATED") {
        // If the page is hidden (user switched tabs), reload silently
        if (document.hidden) {
          window.location.reload();
        } else {
          setMessage("✅ App updated successfully!");
          setShow(true);
          // Auto-hide success message
          setTimeout(() => setShow(false), 4000);
        }
      }
    });

    // Periodically check for SW updates
    const swCheck = setInterval(() => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) reg.update().catch(() => {});
      });
    }, POLL_INTERVAL);

    return () => clearInterval(swCheck);
  }, []);

  // ── Version API polling (server-side version bump detection) ───────────────
  useEffect(() => {
    async function checkVersion() {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (!r.ok) return;
        const { version } = await r.json();
        if (!knownVersion.current) {
          knownVersion.current = version;
          return;
        }
        if (version !== knownVersion.current) {
          knownVersion.current = version;
          setMessage(`🆕 Version ${version} available — tap to update`);
          setShow(true);
        }
      } catch (_) {}
    }
    checkVersion();
    const t = setInterval(checkVersion, POLL_INTERVAL);
    return () => clearInterval(t);
  }, []);

  // ── Apply update ────────────────────────────────────────────────────────────
  function applyUpdate() {
    setLoading(true);
    const reg = swReg.current;
    if (reg?.waiting) {
      // Tell the waiting SW to take control
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
      // Wait for controller change, then reload
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      }, { once: true });
    } else {
      window.location.reload();
    }
  }

  if (!show) return null;

  return (
    <div style={{
      position: "fixed", top: "72px", left: "50%", transform: "translateX(-50%)",
      zIndex: 99999, display: "flex", alignItems: "center", gap: "12px",
      padding: "12px 20px", borderRadius: "14px",
      background: "linear-gradient(135deg, #0066FF, #00A3FF)",
      boxShadow: "0 4px 32px rgba(0,102,255,0.55)",
      color: "#fff", fontSize: "0.88rem", fontWeight: 600,
      maxWidth: "calc(100vw - 48px)", whiteSpace: "nowrap",
      animation: "slideDown 0.3s ease",
    }}>
      <style>{`@keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
      <span>{message}</span>
      <button
        onClick={applyUpdate}
        disabled={loading}
        style={{
          padding: "6px 14px", borderRadius: "8px",
          background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.4)",
          color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.82rem",
        }}
      >{loading ? "…" : "Refresh"}</button>
      {!loading && (
        <button
          onClick={() => setShow(false)}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: "1rem", lineHeight: 1 }}
        >✕</button>
      )}
    </div>
  );
}
