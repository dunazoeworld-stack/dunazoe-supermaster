"use client";
import Link from "next/link";
import Image from "next/image";

export default function OfflinePage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center" }}>
      <div style={{ maxWidth: "420px" }}>
        <Image src="/assets/dunazoe-logo.jpg" alt="DUNAZOE" width={72} height={72}
          style={{ borderRadius: "16px", boxShadow: "0 0 30px rgba(0,163,255,0.4)", marginBottom: "24px" }} />
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: "12px" }}>
          <span className="text-gradient">You're Offline</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "8px", lineHeight: 1.6 }}>
          You're not connected to the internet. You can still browse cached pages.
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "32px" }}>
          Payments, wallet top-up, and order actions require a live connection.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => window.location.reload()} className="btn btn-primary btn-lg">
            🔄 Try Again
          </button>
          <Link href="/" className="btn btn-outline btn-lg">← Home</Link>
        </div>
        <p style={{ marginTop: "32px", fontSize: "0.78rem", color: "var(--text-muted)" }}>
          DUNAZOE v1.0.0-rc1 — Offline Mode
        </p>
      </div>
    </div>
  );
}
