"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const SERVICE_CATS = [
  { icon: "🔧", label: "Repairs", slug: "repairs" },
  { icon: "🎨", label: "Design", slug: "design" },
  { icon: "📸", label: "Photography", slug: "photography" },
  { icon: "💻", label: "Tech", slug: "tech" },
  { icon: "🚚", label: "Delivery", slug: "delivery" },
  { icon: "🏠", label: "Home", slug: "home" },
  { icon: "📚", label: "Tutoring", slug: "tutoring" },
  { icon: "💄", label: "Beauty", slug: "beauty" },
];

export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/products?type=service&limit=24`)
      .then(r => r.json())
      .then(d => setServices(d.products || []))
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageShell title="Services" icon="⚡" authRequired={false}
      subtitle="Book trusted service providers across Nigeria"
      actions={<Link href="/register?role=vendor" className="btn btn-primary btn-sm">Offer a Service</Link>}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "10px", marginBottom: "32px" }}>
        {SERVICE_CATS.map(c => (
          <Link key={c.slug} href={`/products?type=service&category=${c.slug}`}
            style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", padding: "16px 10px", background: "var(--elevated)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", transition: "all 0.2s" }}>
            <span style={{ fontSize: "1.6rem" }}>{c.icon}</span>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", textAlign: "center" }}>{c.label}</span>
          </Link>
        ))}
      </div>
      {loading ? (
        <div className="grid-auto">{Array(6).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: "220px", borderRadius: "16px" }} />)}</div>
      ) : services.length > 0 ? (
        <div className="grid-auto">
          {services.map(s => (
            <Link key={s.id} href={`/products/${s.id}`} className="card" style={{ textDecoration: "none" }}>
              <div className="card-body">
                <p style={{ fontWeight: 700, marginBottom: "6px" }}>{s.name}</p>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "12px" }}>{s.description?.slice(0, 80) || "Professional service"}</p>
                <span style={{ fontWeight: 800, background: "var(--dz-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  ₦{parseFloat(s.price || 0).toLocaleString("en-NG")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">⚡</span>
          <p className="empty-title">No services listed yet</p>
          <p className="empty-body">Be the first to offer a service on DUNAZOE.</p>
          <Link href="/register?role=vendor" className="btn btn-primary">Offer a Service</Link>
        </div>
      )}
    </PageShell>
  );
}
