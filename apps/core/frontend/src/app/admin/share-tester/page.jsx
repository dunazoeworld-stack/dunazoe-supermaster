"use client";

import { useEffect, useState } from "react";
import PageShell from "../../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const ADMIN_ROLES = ["admin", "super_admin", "superuser", "cto"];

function readMeta(document, selector) {
  return document.querySelector(selector)?.getAttribute("content") || "";
}

export default function ProductShareTesterPage() {
  const [user, setUser] = useState(null);
  const [slug, setSlug] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try { setUser(JSON.parse(localStorage.getItem("dunazoe_user") || "null")); } catch (_) {}
  }, []);

  async function inspect(event) {
    event.preventDefault();
    const cleanSlug = slug.trim();
    if (!cleanSlug) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const productResponse = await fetch(`${API}/products/slug/${encodeURIComponent(cleanSlug)}`);
      const product = await productResponse.json().catch(() => ({}));
      const pageResponse = await fetch(`/p/${encodeURIComponent(cleanSlug)}`, { cache: "no-store" });
      const html = await pageResponse.text();
      const parsed = new DOMParser().parseFromString(html, "text/html");
      const shareImage = product.share_image_url || product.shareImageUrl || "";
      setResult({
        product,
        pageStatus: pageResponse.status,
        productStatus: productResponse.status,
        title: parsed.title || "",
        canonical: parsed.querySelector('link[rel="canonical"]')?.getAttribute("href") || "",
        ogTitle: readMeta(parsed, 'meta[property="og:title"]'),
        ogDescription: readMeta(parsed, 'meta[property="og:description"]'),
        ogImage: readMeta(parsed, 'meta[property="og:image"]'),
        ogUrl: readMeta(parsed, 'meta[property="og:url"]'),
        ogType: readMeta(parsed, 'meta[property="og:type"]'),
        twitterCard: readMeta(parsed, 'meta[name="twitter:card"]'),
        twitterTitle: readMeta(parsed, 'meta[name="twitter:title"]'),
        twitterImage: readMeta(parsed, 'meta[name="twitter:image"]'),
        shareImage,
      });
    } catch (inspectionError) {
      setError(inspectionError.message || "Could not inspect this product.");
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;
  if (!ADMIN_ROLES.includes(user.role)) {
    return (
      <PageShell title="Product Share Tester" icon="🔗" authRequired>
        <div className="alert alert-error">Access restricted to administrators.</div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Product Share Tester" icon="🔗" authRequired
      subtitle="Inspect the public product page, crawler metadata, and share image without publishing or sending a message.">
      <form onSubmit={inspect} style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
        <input className="form-input" value={slug} onChange={event => setSlug(event.target.value)}
          placeholder="Enter product slug, e.g. dc-solar-bulb-e6b55aef1b" style={{ flex: 1, minWidth: "240px" }} />
        <button className="btn btn-primary" disabled={loading}>{loading ? "Checking…" : "Inspect Share Metadata"}</button>
      </form>
      {error && <div className="alert alert-error">{error}</div>}
      {result && (
        <div style={{ display: "grid", gap: "16px" }}>
          <div className="card"><div className="card-body">
            <h3 style={{ marginBottom: "10px" }}>Validation</h3>
            <p>Product API: <strong>{result.productStatus}</strong> · Public page: <strong>{result.pageStatus}</strong></p>
            <p>Canonical: <a href={result.canonical} target="_blank" rel="noreferrer">{result.canonical || "missing"}</a></p>
            <p>Title: <strong>{result.title || "missing"}</strong></p>
          </div></div>
          <div className="card"><div className="card-body">
            <h3 style={{ marginBottom: "10px" }}>OpenGraph and Twitter</h3>
            {[
              ["og:title", result.ogTitle], ["og:description", result.ogDescription],
              ["og:image", result.ogImage], ["og:url", result.ogUrl], ["og:type", result.ogType],
              ["twitter:card", result.twitterCard], ["twitter:title", result.twitterTitle],
              ["twitter:image", result.twitterImage],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "grid", gridTemplateColumns: "145px 1fr", gap: "8px", borderBottom: "1px solid var(--border)", padding: "8px 0", fontSize: "0.82rem" }}>
                <strong>{label}</strong><span style={{ overflowWrap: "anywhere", color: value ? "var(--text)" : "var(--danger)" }}>{value || "missing"}</span>
              </div>
            ))}
          </div></div>
          <div className="card"><div className="card-body">
            <h3 style={{ marginBottom: "10px" }}>Share image preview</h3>
            {result.shareImage
              ? <img src={result.shareImage} alt="Product share preview" style={{ display: "block", width: "min(100%, 600px)", aspectRatio: "1200 / 630", objectFit: "cover", borderRadius: "12px", border: "1px solid var(--border)" }} />
              : <p className="alert alert-error">No share image URL was returned.</p>}
          </div></div>
        </div>
      )}
    </PageShell>
  );
}