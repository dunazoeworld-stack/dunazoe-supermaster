"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function VendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/vendors?limit=24&status=active`)
      .then(r => r.json())
      .then(d => setVendors(d.vendors || []))
      .catch(() => setVendors([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageShell title="Vendors" icon="🏪" authRequired={false}
      subtitle="Discover verified sellers and their product catalogues"
      actions={<Link href="/register?role=vendor" className="btn btn-primary btn-sm">Start Selling</Link>}>
      {loading ? (
        <div className="grid-auto">{Array(8).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: "160px", borderRadius: "16px" }} />)}</div>
      ) : vendors.length > 0 ? (
        <div className="grid-auto">
          {vendors.map(v => (
            <Link key={v.id} href={`/products?vendor=${v.id}`} className="card" style={{ textDecoration: "none", display: "block" }}>
              <div className="card-body" style={{ textAlign: "center" }}>
                <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "var(--dz-gradient)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: "1.4rem", fontWeight: 800, color: "#fff" }}>
                  {(v.business_name || "?")[0].toUpperCase()}
                </div>
                <p style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.business_name}</p>
                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "8px" }}>{v.city || "Nigeria"}</p>
                <div style={{ display: "flex", gap: "6px", justifyContent: "center", flexWrap: "wrap" }}>
                  {v.verified_auto && <span className="badge badge-success">✓ Verified</span>}
                  {v.rating > 0 && <span className="badge badge-info">⭐ {parseFloat(v.rating).toFixed(1)}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">🏪</span>
          <p className="empty-title">No vendors yet</p>
          <p className="empty-body">Be the first to sell on DUNAZOE and reach thousands of buyers.</p>
          <Link href="/register?role=vendor" className="btn btn-primary">Become a Vendor</Link>
        </div>
      )}
    </PageShell>
  );
}
