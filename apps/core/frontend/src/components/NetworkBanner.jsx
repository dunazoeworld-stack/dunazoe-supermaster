"use client";
import { useEffect, useState } from "react";

export default function NetworkBanner() {
  const [status, setStatus] = useState("online");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function goOnline() {
      setStatus("online");
      setVisible(true);
      setTimeout(() => setVisible(false), 3000);
    }
    function goOffline() {
      setStatus("offline");
      setVisible(true);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    if (!navigator.onLine) { setStatus("offline"); setVisible(true); }
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (!visible) return null;

  const isOffline = status === "offline";
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
      padding: "10px 20px",
      background: isOffline ? "rgba(255,59,92,0.95)" : "rgba(0,200,150,0.95)",
      backdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
      fontSize: "0.85rem", fontWeight: 600, color: "#fff",
      boxShadow: isOffline ? "0 2px 20px rgba(255,59,92,0.4)" : "0 2px 20px rgba(0,200,150,0.4)",
      transition: "all 0.3s ease",
    }}>
      <span>{isOffline ? "📡" : "✅"}</span>
      <span>
        {isOffline
          ? "You're offline — browsing only. Payments and wallet actions require a live connection."
          : "Back online!"}
      </span>
      {isOffline && (
        <button onClick={() => window.location.reload()} style={{
          marginLeft: "12px", padding: "4px 12px", borderRadius: "6px",
          background: "rgba(255,255,255,0.25)", border: "none", color: "#fff",
          cursor: "pointer", fontSize: "0.8rem", fontWeight: 700,
        }}>Retry</button>
      )}
    </div>
  );
}
