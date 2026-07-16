"use client";
/**
 * DUNAZOE — Deployment AI Download Page
 * Provides the standalone Deployment AI / Superuser app
 * as a downloadable ZIP (self-contained Node.js app).
 */
import { useState } from "react";
import Link from "next/link";
import PageShell from "../../../components/PageShell";

const RELEASES = [
  {
    version: "v2.0.0",
    label:   "Deployment AI + Superuser Panel",
    date:    "July 2026",
    tag:     "STABLE",
    tagColor: "var(--success)",
    description: "Full standalone app with audit engine, score dashboard, one-click deploy, 72h monitoring, and superuser RBAC controls.",
    features: [
      "🔒 5-gate security audit (scores security/reliability/perf/scalability/readiness)",
      "🚀 One-click deploy to Render, Replit, VPS, AWS, NameCheap",
      "📊 Real-time health dashboard — all 34 microservices",
      "🛡️ Superuser RBAC with admin-override and user impersonation",
      "📱 Mobile-first — works from your phone",
      "🔔 WhatsApp / SMS alerts via Termii post-deploy",
      "📈 72-hour post-deployment monitoring with auto-rollback",
      "⚡ Feature Activation Engine — turn features ON/OFF live",
    ],
    download_url: "/api/deploy/download/deployment-ai-v2.zip",
    github_url:   "https://github.com/dunazoe/dunazoe-os/releases/tag/v2.0.0",
    size:         "~2.4 MB",
    runtime:      "Node.js 20+",
  },
  {
    version: "v1.5.0",
    label:   "Deployment AI Lite",
    date:    "June 2026",
    tag:     "LEGACY",
    tagColor: "var(--warning)",
    description: "Original audit engine + deploy guide. No activation engine or monitoring.",
    features: [
      "🔒 Basic security audit",
      "📄 Step-by-step deploy guide (CEO mode)",
      "🌐 Multi-provider support",
    ],
    download_url: "/api/deploy/download/deployment-ai-v1.5.zip",
    github_url:   "https://github.com/dunazoe/dunazoe-os/releases/tag/v1.5.0",
    size:         "~1.1 MB",
    runtime:      "Node.js 18+",
  },
];

const INSTALL_STEPS = [
  { step: "1", icon: "📥", title: "Download the ZIP", desc: "Click the download button for the latest release (v2.0.0)." },
  { step: "2", icon: "📂", title: "Extract the archive", desc: "Unzip to any folder on your machine (or Replit/VPS)." },
  { step: "3", icon: "⚙️", title: "Configure .env", desc: "Copy .env.example → .env and fill in your DATABASE_URL, JWT_SECRET, and service URLs." },
  { step: "4", icon: "🚀", title: "Run the app", desc: "npm install && npm start — opens on port 4027." },
  { step: "5", icon: "🔑", title: "Login as Superuser", desc: "Use your admin credentials. All deployment controls are on the dashboard." },
];

export default function DeployDownloadPage() {
  const [downloading, setDownloading] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  async function handleDownload(release) {
    setDownloading(release.version);
    try {
      // Try to trigger real download from API
      const token = localStorage.getItem("dunazoe_token");
      const r = await fetch(release.download_url, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok && r.headers.get("content-type")?.includes("zip")) {
        const blob = await r.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `dunazoe-deployment-ai-${release.version}.zip`;
        a.click();
        URL.revokeObjectURL(a.href);
      } else {
        // Fallback: open GitHub releases
        window.open(release.github_url, "_blank");
      }
    } catch (_) {
      window.open(release.github_url, "_blank");
    } finally {
      setTimeout(() => setDownloading(null), 2000);
    }
  }

  return (
    <PageShell
      title="Deployment AI Download"
      icon="📥"
      authRequired={true}
      subtitle="Standalone app for one-button deployment from your phone or PC"
      breadcrumb={[{ href: "/deploy", label: "Deploy" }, { label: "Download" }]}
      actions={<Link href="/deploy" className="btn btn-ghost btn-sm">← Deploy Dashboard</Link>}
    >
      {/* Hero */}
      <div style={{
        padding: "32px", borderRadius: "20px", marginBottom: "32px",
        background: "linear-gradient(135deg, rgba(0,102,255,0.15) 0%, rgba(0,163,255,0.08) 100%)",
        border: "1px solid rgba(0,163,255,0.25)", textAlign: "center",
      }}>
        <div style={{ fontSize: "3.5rem", marginBottom: "12px" }}>🤖</div>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 900, marginBottom: "8px" }} className="text-gradient">
          DUNAZOE Deployment AI
        </h1>
        <p style={{ color: "var(--text-secondary)", maxWidth: "520px", margin: "0 auto 20px", lineHeight: 1.7 }}>
          The standalone superuser control panel that audits your entire platform, blocks unsafe deploys, and gives you one-button production deployment from any device.
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => handleDownload(RELEASES[0])} disabled={!!downloading} className="btn btn-primary btn-lg">
            {downloading === RELEASES[0].version ? "⏳ Preparing…" : "📥 Download Latest (v2.0.0)"}
          </button>
          <a href={RELEASES[0].github_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-lg">
            🐙 View on GitHub
          </a>
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "10px" }}>
          {RELEASES[0].size} · Requires {RELEASES[0].runtime}
        </p>
      </div>

      {/* Feature list */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div className="card-body">
          <h2 style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: "16px" }}>✅ What's Included in v2.0.0</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {RELEASES[0].features.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start", padding: "8px 0" }}>
                <span style={{ flexShrink: 0, fontSize: "1rem" }}>{f.slice(0, 2)}</span>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{f.slice(2).trim()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Installation */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div className="card-body">
          <button type="button" onClick={() => setShowInstall(x => !x)} style={{
            background: "none", border: "none", cursor: "pointer", width: "100%",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <h2 style={{ fontWeight: 800, fontSize: "1.1rem" }}>🛠️ Installation Guide</h2>
            <span style={{ color: "var(--text-muted)" }}>{showInstall ? "▲" : "▼"}</span>
          </button>
          {showInstall && (
            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {INSTALL_STEPS.map(s => (
                <div key={s.step} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
                    background: "var(--dz-gradient)", display: "flex", alignItems: "center",
                    justifyContent: "center", fontWeight: 800, fontSize: "0.85rem",
                  }}>{s.step}</div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>{s.icon} {s.title}</p>
                    <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "2px" }}>{s.desc}</p>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: "8px", padding: "12px", background: "rgba(0,163,255,0.06)", borderRadius: "10px", fontSize: "0.82rem" }}>
                <p style={{ fontWeight: 700, marginBottom: "4px" }}>📱 Running from your phone?</p>
                <p style={{ color: "var(--text-secondary)" }}>Import the repo to Replit → set Secrets → click Run. See <Link href="/deploy/self" style={{ color: "var(--dz-blue)" }}>Self-Deploy guide</Link>.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* All releases */}
      <h2 style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: "14px" }}>📦 All Releases</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {RELEASES.map(r => (
          <div key={r.version} className="card">
            <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <p style={{ fontWeight: 800, fontSize: "1rem" }}>{r.label}</p>
                  <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "0.65rem", fontWeight: 800, color: r.tagColor, background: `${r.tagColor}22`, border: `1px solid ${r.tagColor}44` }}>{r.tag}</span>
                </div>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{r.description}</p>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>{r.version} · {r.date} · {r.size} · {r.runtime}</p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => handleDownload(r)} disabled={!!downloading} className="btn btn-primary btn-sm">
                  {downloading === r.version ? "⏳" : "📥"} Download
                </button>
                <a href={r.github_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">🐙 GitHub</a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Live dashboard link */}
      <div style={{ marginTop: "32px", padding: "20px", borderRadius: "14px", background: "rgba(0,200,150,0.06)", border: "1px solid rgba(0,200,150,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>🌐 Use the Live Deployment AI Instead?</p>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>The full Deployment AI cockpit is already running in your DUNAZOE dashboard.</p>
        </div>
        <Link href="/deploy" className="btn btn-primary btn-sm">Open Live Dashboard →</Link>
      </div>
    </PageShell>
  );
}
