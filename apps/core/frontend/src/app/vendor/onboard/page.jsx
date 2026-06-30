"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const CATEGORIES = ["Fashion","Phones & Tablets","Food & Groceries","Beauty & Health","Electronics","Solar Energy","Baby & Kids","Services","Agriculture","Home & Living","Sports","Books & Education"];
const PRODUCT_TYPES = [
  { id: "physical", icon: "📦", label: "Physical Product", desc: "Tangible item shipped to buyer" },
  { id: "digital", icon: "💻", label: "Digital Product", desc: "File/software delivered online" },
  { id: "service", icon: "⚡", label: "Service", desc: "Work or skill you offer" },
];

export default function VendorOnboardPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    business_name: "", state: "", city: "", type: "direct",
    name: "", description: "", category: "", price: "", product_type: "physical",
    ajo_enabled: false, ajo_weeks: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isVendor, setIsVendor] = useState(false);

  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem("dunazoe_user") || "{}"); setIsVendor(u.role === "vendor"); } catch (_) {}
  }, []);

  const F = (key, val) => setForm(f => ({ ...f, [key]: val }));

  async function handleSubmit(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const token = localStorage.getItem("dunazoe_token");
      let vendorId = null;
      if (!isVendor) {
        const vRes = await fetch(`${API}/vendor/onboard`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ business_name: form.business_name, state: form.state, city: form.city, type: form.type }),
        });
        const vData = await vRes.json();
        if (!vData.success) { setError(vData.error || "Vendor setup failed."); setLoading(false); return; }
        vendorId = vData.vendor_id;
        const u = JSON.parse(localStorage.getItem("dunazoe_user") || "{}");
        localStorage.setItem("dunazoe_user", JSON.stringify({ ...u, role: "vendor" }));
        setIsVendor(true);
      }
      const pRes = await fetch(`${API}/products`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vendor_id: vendorId,
          name: form.name, description: form.description, category: form.category,
          price: parseFloat(form.price), type: form.product_type,
          ajo_enabled: form.ajo_enabled, ajo_weeks: form.ajo_weeks ? parseInt(form.ajo_weeks) : null,
        }),
      });
      const pData = await pRes.json();
      if (pData.success || pData.product) setSuccess(true);
      else setError(pData.error || "Failed to add product.");
    } catch (_) { setError("Connection error. Please try again."); }
    finally { setLoading(false); }
  }

  if (success) return (
    <PageShell title="Product Added!" icon="✅" authRequired={true}>
      <div style={{ textAlign: "center", padding: "60px 24px" }}>
        <div style={{ fontSize: "4rem", marginBottom: "16px" }}>🎉</div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "8px" }} className="text-gradient">Your product is live!</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>Buyers can now discover and purchase from your store.</p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/vendor/dashboard" className="btn btn-primary">View Dashboard →</Link>
          <button onClick={() => { setSuccess(false); setStep(isVendor ? 2 : 1); setForm(f => ({ ...f, name: "", description: "", price: "" })); }} className="btn btn-outline">Add Another Product</button>
        </div>
      </div>
    </PageShell>
  );

  return (
    <PageShell title={isVendor ? "Add Product" : "Start Selling"} icon="🏪" authRequired={true}
      subtitle={isVendor ? "Add a new product to your store" : "Set up your store on DUNAZOE"}
      breadcrumb={[{ href: "/vendor/dashboard", label: "Vendor Dashboard" }, { label: isVendor ? "Add Product" : "Onboard" }]}>
      <div style={{ display: "flex", gap: "8px", marginBottom: "32px" }}>
        {(!isVendor ? [1,2] : [2]).map((s) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.78rem", fontWeight: 700, background: step >= s ? "var(--dz-gradient)" : "var(--elevated)", border: `1.5px solid ${step >= s ? "var(--dz-blue)" : "var(--border)"}` }}>
              {s}
            </div>
            <span style={{ fontSize: "0.82rem", color: step >= s ? "var(--text)" : "var(--text-muted)" }}>{s === 1 ? "Store Setup" : "Add Product"}</span>
            {s === 1 && !isVendor && <span style={{ color: "var(--border)", margin: "0 4px" }}>→</span>}
          </div>
        ))}
      </div>
      {error && <div className="alert alert-error" style={{ marginBottom: "16px" }}>⚠️ {error}</div>}
      <form onSubmit={step === 1 ? (e => { e.preventDefault(); setStep(2); }) : handleSubmit}>
        {step === 1 && !isVendor && (
          <div className="card"><div className="card-body">
            <h3 style={{ fontWeight: 700, marginBottom: "16px" }}>Store Information</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="form-group"><label className="form-label">Business Name</label><input className="form-input" required value={form.business_name} onChange={e => F("business_name", e.target.value)} placeholder="e.g. Temi Stores" /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div className="form-group"><label className="form-label">State</label><input className="form-input" required value={form.state} onChange={e => F("state", e.target.value)} placeholder="Lagos" /></div>
                <div className="form-group"><label className="form-label">City</label><input className="form-input" required value={form.city} onChange={e => F("city", e.target.value)} placeholder="Ikeja" /></div>
              </div>
              <div className="form-group">
                <label className="form-label">Store Type</label>
                <select className="form-input" value={form.type} onChange={e => F("type", e.target.value)}>
                  <option value="direct">Direct Sale</option>
                  <option value="delivery">Delivery Service</option>
                  <option value="pickup_station">Pickup Station</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ marginTop: "20px", width: "100%", justifyContent: "center" }}>Continue →</button>
          </div></div>
        )}
        {(step === 2 || isVendor) && (
          <div className="card"><div className="card-body">
            <h3 style={{ fontWeight: 700, marginBottom: "16px" }}>Product Details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                {PRODUCT_TYPES.map(pt => (
                  <button key={pt.id} type="button" onClick={() => F("product_type", pt.id)} style={{ padding: "12px", borderRadius: "12px", border: `1.5px solid ${form.product_type === pt.id ? "var(--dz-blue)" : "var(--border)"}`, background: form.product_type === pt.id ? "var(--dz-gradient-soft)" : "transparent", cursor: "pointer", textAlign: "center" }}>
                    <span style={{ fontSize: "1.3rem", display: "block", marginBottom: "4px" }}>{pt.icon}</span>
                    <p style={{ fontWeight: 600, fontSize: "0.78rem", color: "var(--text)" }}>{pt.label}</p>
                  </button>
                ))}
              </div>
              <div className="form-group"><label className="form-label">Product Name</label><input className="form-input" required value={form.name} onChange={e => F("name", e.target.value)} placeholder="e.g. Lagos Jollof Rice Spice Pack" /></div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" rows={3} value={form.description} onChange={e => F("description", e.target.value)} placeholder="Describe your product…" style={{ resize: "vertical" }} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div className="form-group"><label className="form-label">Category</label>
                  <select className="form-input" required value={form.category} onChange={e => F("category", e.target.value)}>
                    <option value="">Select…</option>
                    {CATEGORIES.map(c => <option key={c} value={c.toLowerCase().replace(/\s&\s/g, "_").replace(/\s/g, "_")}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Price (₦)</label><input className="form-input" type="number" min="1" required value={form.price} onChange={e => F("price", e.target.value)} placeholder="e.g. 5000" /></div>
              </div>
              {form.product_type === "physical" && (
                <div style={{ padding: "12px", background: "var(--surface)", borderRadius: "10px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                    <input type="checkbox" checked={form.ajo_enabled} onChange={e => F("ajo_enabled", e.target.checked)} style={{ accentColor: "var(--dz-blue)", width: "16px", height: "16px" }} />
                    <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>⬡ Enable Ajo (installment) buying</span>
                  </label>
                  {form.ajo_enabled && (
                    <div className="form-group" style={{ marginTop: "10px" }}>
                      <label className="form-label">Ajo Duration (weeks)</label>
                      <input className="form-input" type="number" min="4" max="52" value={form.ajo_weeks} onChange={e => F("ajo_weeks", e.target.value)} placeholder="e.g. 12" />
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              {!isVendor && step === 2 && <button type="button" onClick={() => setStep(1)} className="btn btn-ghost">← Back</button>}
              <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ flex: 1, justifyContent: "center" }}>
                {loading ? "Publishing…" : "🚀 Publish Product"}
              </button>
            </div>
          </div></div>
        )}
      </form>
    </PageShell>
  );
}
