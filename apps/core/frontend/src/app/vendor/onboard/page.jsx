"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import PageShell from "../../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const CATEGORIES = [
  "Fashion","Phones & Tablets","Food & Groceries","Beauty & Health",
  "Electronics","Solar Energy","Baby & Kids","Services","Agriculture",
  "Home & Living","Sports","Books & Education",
];

const PRODUCT_TYPES = [
  { id: "physical", icon: "📦", label: "Physical Product", desc: "Tangible item shipped to buyer" },
  { id: "digital",  icon: "💾", label: "Digital Product",  desc: "File/software delivered online" },
  { id: "service",  icon: "🛠️", label: "Service",          desc: "Work or skill you offer" },
];

const LOGISTICS_OPTIONS = [
  { id: "shipbubble", label: "Shipbubble", icon: "📮" },
  { id: "gigm",       label: "GIGM",       icon: "🚌" },
  { id: "jumia",      label: "Jumia Express", icon: "🟡" },
  { id: "self",       label: "Self Delivery", icon: "🛵" },
];

const LICENSE_TYPES = ["Personal use","Commercial use","Extended license","Resale rights","Open source"];

// ─── Small helpers ────────────────────────────────────────────────────────────
function Tag({ label, onRemove }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4px",
      padding: "4px 10px", borderRadius: "999px", background: "rgba(0,163,255,0.12)",
      border: "1px solid rgba(0,163,255,0.3)", fontSize: "0.8rem", fontWeight: 600, color: "var(--dz-blue)",
    }}>
      {label}
      {onRemove && (
        <button type="button" onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", lineHeight: 1, padding: "0 2px", fontSize: "0.75rem" }}>✕</button>
      )}
    </span>
  );
}

function TagInput({ placeholder, items, onAdd, onRemove }) {
  const [val, setVal] = useState("");
  function add() {
    const v = val.trim();
    if (v && !items.includes(v)) { onAdd(v); setVal(""); }
  }
  return (
    <div>
      <div style={{ display: "flex", gap: "8px" }}>
        <input className="form-input" value={val} onChange={e => setVal(e.target.value)}
          placeholder={placeholder} style={{ flex: 1 }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" onClick={add} className="btn btn-outline btn-sm">Add</button>
      </div>
      {items.length > 0 && (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
          {items.map(item => <Tag key={item} label={item} onRemove={() => onRemove(item)} />)}
        </div>
      )}
    </div>
  );
}

// ─── Smart image compression: adaptive quality targeting (< 600 KB, max 1600px) ─
async function compressImage(file) {
  return new Promise(resolve => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      // Scale down to max 1600 px while preserving aspect ratio
      const MAX = 1600;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width >= height) { height = Math.round(height * MAX / width); width = MAX; }
        else                 { width  = Math.round(width  * MAX / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);

      // Adaptive quality: step down until < 600 KB or hit quality floor 0.65
      const TARGET_BYTES = 600 * 1024;
      const QUALITIES    = [0.95, 0.85, 0.75, 0.65];
      let qi = 0;

      function tryBlob() {
        canvas.toBlob(blob => {
          if (!blob) {
            // WebP not supported — fall back to JPEG
            canvas.toBlob(jblob => resolve(jblob
              ? new File([jblob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" })
              : file), "image/jpeg", 0.82);
            return;
          }
          // Accept if under target OR we've reached the quality floor
          if (blob.size <= TARGET_BYTES || qi === QUALITIES.length - 1) {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" }));
          } else {
            qi++;
            tryBlob(); // try next quality level
          }
        }, "image/webp", QUALITIES[qi]);
      }
      tryBlob();
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

/** Upload one file with exponential-backoff retry (max 3 attempts). */
async function uploadWithRetry(file, token, apiBase, maxAttempts = 3) {
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    if (!navigator.onLine) throw new Error("You are offline — image will upload when you reconnect.");
    try {
      const fd = new FormData();
      fd.append("image", file);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30_000);
      const r = await fetch(`${apiBase}/upload/product-image`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
        body: fd, signal: ctrl.signal,
      });
      clearTimeout(timer);
      const d = await r.json();
      if (d.success && d.url) return d;
      if (r.status < 500) throw new Error(d.error || "Upload failed"); // 4xx: do not retry
      lastErr = new Error(d.error || `Server error ${r.status}`);
    } catch (err) { lastErr = err; }
    if (i < maxAttempts - 1) await new Promise(res => setTimeout(res, Math.pow(2, i) * 1200));
  }
  throw lastErr;
}

// ─── Image upload tile ────────────────────────────────────────────────────────
function ImageUploadTile({ url, onRemove }) {
  return (
    <div style={{
      width: "80px", height: "80px", borderRadius: "10px", overflow: "hidden", position: "relative",
      background: url ? `url(${url}) center/cover no-repeat` : "var(--surface)",
      border: "1.5px solid var(--border)",
    }}>
      {url && (
        <button type="button" onClick={onRemove} style={{
          position: "absolute", top: "3px", right: "3px", width: "20px", height: "20px",
          borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: "none", cursor: "pointer",
          color: "#fff", fontSize: "0.65rem", display: "flex", alignItems: "center", justifyContent: "center",
        }}>✕</button>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function VendorOnboardPage() {
  const [step,    setStep]    = useState(1);
  const [isVendor,setIsVendor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);
  const [aiTip,           setAiTip]           = useState(null);
  const [aiLoading,       setAiLoading]       = useState(false);
  // ── Vision AI state ────────────────────────────────────────────────────────
  const [aiVision,        setAiVision]        = useState(null);   // vision analysis result
  const [aiVisionLoading, setAiVisionLoading] = useState(false);  // loading indicator
  const [aiApplied,       setAiApplied]       = useState({});     // which fields were AI-filled
  const fileRef = useRef(null);

  // ── vendor step ──────────────────────────────────────────────
  const [vendor, setVendor] = useState({ business_name: "", state: "", city: "", type: "direct" });

  // ── product fields ───────────────────────────────────────────
  const [product, setProduct] = useState({
    name: "", description: "", category: "", price: "", cost: "",
    product_type: "physical",
    ajo_enabled: false, ajo_weeks: "",
    // physical
    weight: "", dimensions: "", brand: "", material: "", stock_quantity: "",
    country_of_origin: "Nigeria", dispatch_time: "1-3 business days",
    return_policy: "30-day return policy",
    // digital
    file_format: "", file_size: "", license_type: "Personal use",
    language: "English", compatibility: "", drm_protected: false,
    updates_included: true,
    // service
    service_duration: "", service_area: "", service_includes: "",
    service_excludes: "", booking_note: "",
    // logistics
    logistics_providers: ["shipbubble"],
    self_delivery_zones: [],
  });
  const [colors,    setColors]    = useState([]);
  const [sizes,     setSizes]     = useState([]);
  const [images,    setImages]    = useState([]); // [{url, public_id}]
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(""); // "" | "Compressing…" | "Uploading (1/2)…" | etc.
  const [digitalFile, setDigitalFile] = useState(null);   // {name, size, url} for digital products
  const [digitalUploading, setDigitalUploading] = useState(false);
  const digitalFileRef = useRef(null);

  const P = (k, v) => setProduct(p => ({ ...p, [k]: v }));
  const V = (k, v) => setVendor(p => ({ ...p, [k]: v }));

  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem("dunazoe_user") || "{}"); setIsVendor(u.role === "vendor"); } catch (_) {}
  }, []);

  // ── AI listing assistant ──────────────────────────────────────
  async function runAI(imageUrls = []) {
    if (!product.name && !product.category && imageUrls.length === 0) return;
    setAiLoading(true);
    try {
      const token = localStorage.getItem("dunazoe_token");
      const r = await fetch(`${API}/products/ai/assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name:        product.name,
          cost:        product.cost || product.price,
          category:    product.category,
          ajo_weeks:   product.ajo_weeks || 0,
          description: product.description,
          image_urls:  imageUrls,          // AI analyses uploaded images
          product_type: product.product_type,
        }),
      });
      const d = await r.json();
      if (d.success) setAiTip(d);
    } catch (_) {}
    finally { setAiLoading(false); }
  }

  // ── Digital file upload ───────────────────────────────────────
  async function handleDigitalFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX = 100 * 1024 * 1024; // 100 MB
    if (file.size > MAX) { setError("Digital file must be under 100 MB."); return; }
    setDigitalUploading(true); setError("");
    try {
      const token = localStorage.getItem("dunazoe_token");
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${API}/upload/digital-file`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const d = await r.json();
      if (d.success && d.url) {
        setDigitalFile({ name: file.name, size: (file.size / (1024 * 1024)).toFixed(1) + " MB", url: d.url });
        if (!product.file_size) P("file_size", (file.size / (1024 * 1024)).toFixed(1) + " MB");
        const ext = file.name.split(".").pop()?.toUpperCase() || "";
        if (!product.file_format && ext) P("file_format", ext);
      } else {
        // Store locally until service is available
        setDigitalFile({ name: file.name, size: (file.size / (1024 * 1024)).toFixed(1) + " MB", url: null, queued: true });
        if (!product.file_size) P("file_size", (file.size / (1024 * 1024)).toFixed(1) + " MB");
        const ext = file.name.split(".").pop()?.toUpperCase() || "";
        if (!product.file_format && ext) P("file_format", ext);
      }
    } catch (_) {
      setDigitalFile({ name: file.name, size: (file.size / (1024 * 1024)).toFixed(1) + " MB", url: null, queued: true });
      const ext = file.name.split(".").pop()?.toUpperCase() || "";
      if (!product.file_size) P("file_size", (file.size / (1024 * 1024)).toFixed(1) + " MB");
      if (!product.file_format && ext) P("file_format", ext);
    } finally {
      setDigitalUploading(false);
      if (digitalFileRef.current) digitalFileRef.current.value = "";
    }
  }

  // ── Image upload — compress + retry + offline detection ──────────────────────
  async function handleImageUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (images.length + files.length > 5) {
      setError("Maximum 5 images allowed."); return;
    }
    if (!navigator.onLine) {
      setError("You appear to be offline. Please reconnect and try again."); return;
    }
    setUploading(true); setError("");
    const token = localStorage.getItem("dunazoe_token");
    const newImages = [];
    for (let idx = 0; idx < files.length; idx++) {
      const raw = files[idx];
      try {
        // Step 1: compress client-side
        setUploadProgress(`Compressing image ${idx + 1} of ${files.length}…`);
        const compressed = await compressImage(raw);

        // Step 2: upload with retry
        setUploadProgress(`Uploading image ${idx + 1} of ${files.length}…`);
        const d = await uploadWithRetry(compressed, token, API);
        const img = { url: d.url, public_id: d.public_id };
        setImages(prev => [...prev, img]);
        newImages.push(img);
      } catch (err) {
        setError(`Image ${idx + 1}: ${err.message || "Upload failed — check connection."}`);
      }
    }
    setUploading(false); setUploadProgress("");
    if (fileRef.current) fileRef.current.value = "";

    // Auto-run AI analysis after successful image upload
    if (newImages.length > 0) {
      const allUrls = [...images, ...newImages].map(i => i.url).filter(Boolean);
      runAI(allUrls);
    }
  }

  // ── Submit ────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      // ── Guard: require at least one uploaded image ──────────────
      if (images.length === 0) {
        setError("Please upload at least one product image before publishing. Images boost visibility and buyer trust.");
        setLoading(false);
        return;
      }

      const token = localStorage.getItem("dunazoe_token");
      if (!isVendor) {
        const vRes = await fetch(`${API}/vendor/onboard`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(vendor),
        });
        const vData = await vRes.json();
        if (!vData.success) { setError(vData.error || "Vendor setup failed."); setLoading(false); return; }
        const u = JSON.parse(localStorage.getItem("dunazoe_user") || "{}");
        localStorage.setItem("dunazoe_user", JSON.stringify({ ...u, role: "vendor" }));
        setIsVendor(true);
      }

      // Build metadata payload
      const meta = {
        sizes:   sizes,
        colors:  colors,
        tags:    [],
        weight:  product.weight || null,
        dimensions:         product.dimensions || null,
        brand:              product.brand || null,
        material:           product.material || null,
        stock_quantity:     product.stock_quantity ? parseInt(product.stock_quantity) : null,
        country_of_origin:  product.country_of_origin || null,
        dispatch_time:      product.dispatch_time || null,
        return_policy:      product.return_policy || null,
        // digital
        file_format:        product.file_format || null,
        file_size:          product.file_size || null,
        license_type:       product.license_type || null,
        language:           product.language || null,
        compatibility:      product.compatibility || null,
        drm_protected:      product.drm_protected,
        updates_included:   product.updates_included,
        // service
        service_duration:   product.service_duration || null,
        service_area:       product.service_area || null,
        service_includes:   product.service_includes || null,
        service_excludes:   product.service_excludes || null,
        booking_note:       product.booking_note || null,
        // logistics
        logistics_providers:    product.logistics_providers,
        self_delivery_zones:    product.self_delivery_zones,
      };

      const payload = {
        name:         product.name,
        description:  product.description,
        category:     product.category,
        price:        parseFloat(product.price),
        cost:         product.cost ? parseFloat(product.cost) : undefined,
        type:         product.product_type,
        product_type: product.product_type,
        ajo_enabled:  product.ajo_enabled,
        ajo_weeks:    product.ajo_weeks ? parseInt(product.ajo_weeks) : null,
        images:       images.map(i => i.url),
        ...meta,
      };
      const pRes = await fetch(`${API}/products`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const pData = await pRes.json();
      if (pData.success || pData.product_id) {
        // ── Save to localStorage store so /products page shows this immediately ──
        try {
          const existing = JSON.parse(localStorage.getItem("dunazoe_products_store") || "[]");
          const localRecord = {
            id:           pData.product_id || `local_${Date.now()}`,
            name:         payload.name,
            description:  payload.description || "",
            price:        payload.price,
            category:     payload.category,
            type:         payload.product_type,
            product_type: payload.product_type,
            images:       payload.images,
            ajo_enabled:  payload.ajo_enabled,
            sizes:        meta.sizes || [],
            colors:       meta.colors || [],
            brand:        meta.brand || null,
            status:       "published",
            created_at:   new Date().toISOString(),
          };
          const filtered = existing.filter(p => p.id !== localRecord.id);
          localStorage.setItem("dunazoe_products_store", JSON.stringify([localRecord, ...filtered].slice(0, 200)));
        } catch (_) {}
        setSuccess(pData);
      } else setError(pData.error || "Failed to add product.");
    } catch (_) { setError("Connection error. Please try again."); }
    finally { setLoading(false); }
  }

  // ── Success screen ────────────────────────────────────────────
  if (success) {
    const shareUrl = success.shareable_link ? `https://${success.shareable_link}` : "";
    return (
      <PageShell title="Product Published!" icon="✅" authRequired={true}>
        <div style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ fontSize: "4rem", marginBottom: "16px" }}>🎉</div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "8px" }} className="text-gradient">Your product is live!</h2>
          {success.ai_badge && (
            <div style={{ display: "inline-block", padding: "4px 14px", background: "rgba(0,163,255,0.1)", borderRadius: "999px", marginBottom: "12px", fontSize: "0.88rem", fontWeight: 700, color: "var(--dz-blue)" }}>
              {success.ai_badge} · Demand score: {((success.demand_score || 0) * 100).toFixed(0)}%
            </div>
          )}
          <p style={{ color: "var(--text-secondary)", marginBottom: "8px" }}>Buyers can now discover and purchase from your store.</p>
          {success.ai_suggested_price && (
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "24px" }}>
              💡 AI suggested price: ₦{parseFloat(success.ai_suggested_price).toLocaleString("en-NG")}
            </p>
          )}
          {/* Share buttons */}
          {shareUrl && (
            <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap", marginBottom: "24px" }}>
              <a href={`https://wa.me/?text=${encodeURIComponent(`Check out '${product.name}' on DUNAZOE: ${shareUrl}`)}`}
                target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                📤 Share on WhatsApp
              </a>
              <button onClick={() => { navigator.clipboard.writeText(shareUrl); }} className="btn btn-outline btn-sm">
                🔗 Copy Link
              </button>
            </div>
          )}
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/vendor/dashboard" className="btn btn-primary">View Dashboard →</Link>
            <button onClick={() => {
              setSuccess(false);
              setStep(isVendor ? 2 : 1);
              setProduct(p => ({ ...p, name: "", description: "", price: "", cost: "" }));
              setImages([]);
              setColors([]);
              setSizes([]);
              setAiTip(null);
            }} className="btn btn-outline">Add Another Product</button>
          </div>
        </div>
      </PageShell>
    );
  }

  const toggleLogistics = (id) => {
    setProduct(p => ({
      ...p,
      logistics_providers: p.logistics_providers.includes(id)
        ? p.logistics_providers.filter(x => x !== id)
        : [...p.logistics_providers, id],
    }));
  };

  return (
    <PageShell
      title={isVendor ? "Add Product" : "Start Selling"}
      icon="🏪"
      authRequired={true}
      subtitle={isVendor ? "Add a new product to your store" : "Set up your store on DUNAZOE"}
      breadcrumb={[{ href: "/vendor/dashboard", label: "Vendor Dashboard" }, { label: isVendor ? "Add Product" : "Onboard" }]}
    >
      {/* Step indicator */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "32px" }}>
        {(!isVendor ? [1, 2] : [2]).map((s) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "0.78rem", fontWeight: 700,
              background: step >= s ? "var(--dz-gradient)" : "var(--elevated)",
              border: `1.5px solid ${step >= s ? "var(--dz-blue)" : "var(--border)"}`,
            }}>{s}</div>
            <span style={{ fontSize: "0.82rem", color: step >= s ? "var(--text)" : "var(--text-muted)" }}>
              {s === 1 ? "Store Setup" : "Add Product"}
            </span>
            {s === 1 && !isVendor && <span style={{ color: "var(--border)", margin: "0 4px" }}>→</span>}
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: "16px" }}>⚠️ {error}</div>}

      <form onSubmit={step === 1 ? (e => { e.preventDefault(); setStep(2); }) : handleSubmit}>

        {/* ── STEP 1: Store Setup ───────────────────────────── */}
        {step === 1 && !isVendor && (
          <div className="card"><div className="card-body">
            <h3 style={{ fontWeight: 700, marginBottom: "16px" }}>Store Information</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="form-group">
                <label className="form-label">Business Name</label>
                <input className="form-input" required value={vendor.business_name} onChange={e => V("business_name", e.target.value)} placeholder="e.g. Temi Stores" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <input className="form-input" required value={vendor.state} onChange={e => V("state", e.target.value)} placeholder="Lagos" />
                </div>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input className="form-input" required value={vendor.city} onChange={e => V("city", e.target.value)} placeholder="Ikeja" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Store Type</label>
                <select className="form-input" value={vendor.type} onChange={e => V("type", e.target.value)}>
                  <option value="direct">Direct Sale</option>
                  <option value="delivery">Delivery Service</option>
                  <option value="pickup_station">Pickup Station</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ marginTop: "20px", width: "100%", justifyContent: "center" }}>
              Continue →
            </button>
          </div></div>
        )}

        {/* ── STEP 2: Product Details ───────────────────────── */}
        {(step === 2 || isVendor) && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Product type selector */}
            <div className="card"><div className="card-body">
              <h3 style={{ fontWeight: 700, marginBottom: "14px" }}>Product Type</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                {PRODUCT_TYPES.map(pt => (
                  <button key={pt.id} type="button" onClick={() => P("product_type", pt.id)} style={{
                    padding: "14px 8px", borderRadius: "12px", cursor: "pointer", textAlign: "center",
                    border: `1.5px solid ${product.product_type === pt.id ? "var(--dz-blue)" : "var(--border)"}`,
                    background: product.product_type === pt.id ? "rgba(0,163,255,0.1)" : "transparent",
                  }}>
                    <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "4px" }}>{pt.icon}</span>
                    <p style={{ fontWeight: 700, fontSize: "0.78rem", color: "var(--text)" }}>{pt.label}</p>
                    <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>{pt.desc}</p>
                  </button>
                ))}
              </div>
            </div></div>

            {/* Images */}
            <div className="card"><div className="card-body">
              <h3 style={{ fontWeight: 700, marginBottom: "4px" }}>📸 Product Images</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "14px" }}>Up to 5 images. First image is the cover. Cloudinary CDN.</p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                {images.map((img, i) => (
                  <ImageUploadTile key={i} url={img.url} onRemove={() => setImages(prev => prev.filter((_, j) => j !== i))} />
                ))}
                {images.length < 5 && (
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={{
                    width: "80px", height: "80px", borderRadius: "10px", border: "1.5px dashed var(--border-strong)",
                    background: "var(--surface)", cursor: "pointer", display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: "4px", color: "var(--text-muted)",
                  }}>
                    {uploading ? <span className="dz-spinner dz-spinner-sm" /> : <>
                      <span style={{ fontSize: "1.2rem" }}>+</span>
                      <span style={{ fontSize: "0.65rem" }}>Upload</span>
                    </>}
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp" multiple hidden onChange={handleImageUpload} />
              {uploadProgress ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" }}>
                  <span className="dz-spinner dz-spinner-sm" />
                  <p style={{ fontSize: "0.78rem", color: "var(--dz-blue)", fontWeight: 600 }}>{uploadProgress}</p>
                </div>
              ) : images.length === 0 ? (
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "8px" }}>
                  ⚠️ No image = lower visibility. Add at least one photo.
                </p>
              ) : null}
            </div></div>

            {/* Core details */}
            <div className="card"><div className="card-body">
              <h3 style={{ fontWeight: 700, marginBottom: "14px" }}>Core Details</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input className="form-input" required value={product.name} onChange={e => P("name", e.target.value)} placeholder="e.g. Lagos Jollof Rice Spice Pack" />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-input" rows={4} value={product.description} onChange={e => P("description", e.target.value)} placeholder="Describe your product, its features, and why buyers will love it…" style={{ resize: "vertical" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select className="form-input" required value={product.category} onChange={e => P("category", e.target.value)}>
                      <option value="">Select…</option>
                      {CATEGORIES.map(c => (
                        <option key={c} value={c.toLowerCase().replace(/\s&\s/g, "_").replace(/\s/g, "_")}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Price (₦) *</label>
                    <input className="form-input" type="number" min="1" required value={product.price} onChange={e => P("price", e.target.value)} placeholder="e.g. 5000" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Cost Price (₦) <span style={{ color: "var(--text-muted)" }}>— used by AI to suggest optimal price</span></label>
                  <input className="form-input" type="number" min="0" value={product.cost} onChange={e => P("cost", e.target.value)} placeholder="e.g. 3000" />
                </div>

                {/* AI Assist button */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button type="button" onClick={runAI} disabled={aiLoading} className="btn btn-outline btn-sm">
                    {aiLoading ? "🤖 Analysing…" : "🤖 Get AI Listing Tips"}
                  </button>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>AI scores your listing & suggests optimal price</span>
                </div>

                {/* AI tips */}
                {aiTip && (
                  <div style={{ padding: "14px", background: "rgba(0,163,255,0.06)", borderRadius: "12px", border: "1px solid rgba(0,163,255,0.2)" }}>
                    <p style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "8px" }}>🤖 AI Listing Assistant</p>
                    {aiTip.ai_badge && <p style={{ fontSize: "0.82rem", color: "var(--dz-blue)", marginBottom: "4px" }}>{aiTip.ai_badge} · Listing score: {aiTip.listing_score}/10</p>}
                    {aiTip.suggested_price && (
                      <p style={{ fontSize: "0.82rem", color: "var(--success)", marginBottom: "4px" }}>
                        💰 Suggested price: ₦{parseFloat(aiTip.suggested_price).toLocaleString("en-NG")}
                        <button type="button" onClick={() => P("price", String(aiTip.suggested_price))} style={{ marginLeft: "8px", background: "none", border: "none", cursor: "pointer", color: "var(--dz-blue)", fontSize: "0.78rem", fontWeight: 700 }}>Use this →</button>
                      </p>
                    )}
                    {aiTip.title_tips?.length > 0 && (
                      <ul style={{ marginTop: "6px", paddingLeft: "16px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        {aiTip.title_tips.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    )}
                    {aiTip.share_tip && (
                      <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "8px" }}>💡 {aiTip.share_tip}</p>
                    )}
                    {aiTip.ajo_surcharge_note && (
                      <p style={{ fontSize: "0.78rem", color: "var(--warning)", marginTop: "6px" }}>⬡ {aiTip.ajo_surcharge_note}</p>
                    )}
                  </div>
                )}
              </div>
            </div></div>

            {/* ── PHYSICAL FIELDS ───────────────────────────── */}
            {product.product_type === "physical" && (
              <div className="card"><div className="card-body">
                <h3 style={{ fontWeight: 700, marginBottom: "14px" }}>📦 Physical Product Specs</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                  {/* Colors */}
                  <div className="form-group">
                    <label className="form-label">🎨 Available Colors</label>
                    <TagInput
                      placeholder="e.g. Red, #FF0000, Navy Blue — press Enter"
                      items={colors}
                      onAdd={v => setColors(c => [...c, v])}
                      onRemove={v => setColors(c => c.filter(x => x !== v))}
                    />
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Enter color names or hex codes (#FF0000)</p>
                  </div>

                  {/* Sizes */}
                  <div className="form-group">
                    <label className="form-label">📏 Available Sizes</label>
                    <TagInput
                      placeholder="e.g. S, M, L, XL or 38, 39, 40 — press Enter"
                      items={sizes}
                      onAdd={v => setSizes(s => [...s, v])}
                      onRemove={v => setSizes(s => s.filter(x => x !== v))}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div className="form-group">
                      <label className="form-label">⚖️ Weight (kg)</label>
                      <input className="form-input" type="number" step="0.01" min="0" value={product.weight} onChange={e => P("weight", e.target.value)} placeholder="e.g. 0.5" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">📦 Stock Quantity</label>
                      <input className="form-input" type="number" min="0" value={product.stock_quantity} onChange={e => P("stock_quantity", e.target.value)} placeholder="e.g. 50" />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div className="form-group">
                      <label className="form-label">🏷️ Brand</label>
                      <input className="form-input" value={product.brand} onChange={e => P("brand", e.target.value)} placeholder="e.g. Samsung, Nike" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">🧵 Material</label>
                      <input className="form-input" value={product.material} onChange={e => P("material", e.target.value)} placeholder="e.g. Cotton, Leather" />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div className="form-group">
                      <label className="form-label">📐 Dimensions</label>
                      <input className="form-input" value={product.dimensions} onChange={e => P("dimensions", e.target.value)} placeholder="e.g. 30×20×10cm" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">🌍 Made in</label>
                      <input className="form-input" value={product.country_of_origin} onChange={e => P("country_of_origin", e.target.value)} placeholder="Nigeria" />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div className="form-group">
                      <label className="form-label">⏱️ Dispatch Time</label>
                      <input className="form-input" value={product.dispatch_time} onChange={e => P("dispatch_time", e.target.value)} placeholder="1-3 business days" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">🔁 Return Policy</label>
                      <input className="form-input" value={product.return_policy} onChange={e => P("return_policy", e.target.value)} placeholder="30-day return policy" />
                    </div>
                  </div>

                  {/* Ajo */}
                  <div style={{ padding: "12px", background: "var(--surface)", borderRadius: "10px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                      <input type="checkbox" checked={product.ajo_enabled} onChange={e => P("ajo_enabled", e.target.checked)} style={{ accentColor: "var(--dz-blue)", width: "16px", height: "16px" }} />
                      <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>⬡ Enable Ajo (installment) buying</span>
                    </label>
                    {product.ajo_enabled && (
                      <div className="form-group" style={{ marginTop: "10px" }}>
                        <label className="form-label">Ajo Duration (weeks)</label>
                        <input className="form-input" type="number" min="4" max="52" value={product.ajo_weeks} onChange={e => P("ajo_weeks", e.target.value)} placeholder="e.g. 12" />
                      </div>
                    )}
                  </div>
                </div>
              </div></div>
            )}

            {/* ── DIGITAL FIELDS ────────────────────────────── */}
            {product.product_type === "digital" && (
              <div className="card"><div className="card-body">
                <h3 style={{ fontWeight: 700, marginBottom: "14px" }}>💾 Digital Product Info</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                  {/* Digital file upload */}
                  <div className="form-group">
                    <label className="form-label">📁 Upload Your Digital File *</label>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "10px" }}>
                      Upload the file buyers will receive after payment. PDF, ZIP, MP4, PSD, etc. Max 100 MB.
                    </p>
                    {digitalFile ? (
                      <div style={{
                        display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px",
                        borderRadius: "10px", background: digitalFile.queued ? "rgba(255,190,0,0.08)" : "rgba(0,200,130,0.08)",
                        border: `1px solid ${digitalFile.queued ? "rgba(255,190,0,0.3)" : "rgba(0,200,130,0.3)"}`,
                      }}>
                        <span style={{ fontSize: "1.4rem" }}>📄</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{digitalFile.name}</p>
                          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            {digitalFile.size} · {digitalFile.queued ? "⏳ Queued — will sync when service is live" : "✅ Uploaded"}
                          </p>
                        </div>
                        <button type="button" onClick={() => { setDigitalFile(null); }} style={{
                          background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1rem",
                        }}>✕</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => digitalFileRef.current?.click()}
                        disabled={digitalUploading}
                        style={{
                          width: "100%", padding: "18px", borderRadius: "12px",
                          border: "2px dashed var(--border-strong)", background: "var(--surface)",
                          cursor: "pointer", display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center", gap: "6px",
                          color: "var(--text-muted)",
                        }}
                      >
                        {digitalUploading ? (
                          <><span className="dz-spinner dz-spinner-sm" /><span style={{ fontSize: "0.8rem" }}>Uploading…</span></>
                        ) : (
                          <><span style={{ fontSize: "1.8rem" }}>📤</span><span style={{ fontWeight: 700, fontSize: "0.85rem" }}>Click to upload digital file</span><span style={{ fontSize: "0.72rem" }}>PDF, ZIP, MP4, PSD, EPUB, EXE — up to 100 MB</span></>
                        )}
                      </button>
                    )}
                    <input ref={digitalFileRef} type="file" hidden accept=".pdf,.zip,.mp4,.mov,.psd,.ai,.epub,.docx,.xlsx,.png,.jpg,.webp,.exe,.apk,.dmg,.rar,.7z" onChange={handleDigitalFileUpload} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div className="form-group">
                      <label className="form-label">📥 File Format</label>
                      <input className="form-input" value={product.file_format} onChange={e => P("file_format", e.target.value)} placeholder="e.g. PDF, MP4, ZIP, PSD" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">💿 File Size</label>
                      <input className="form-input" value={product.file_size} onChange={e => P("file_size", e.target.value)} placeholder="e.g. 45 MB, 1.2 GB" />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div className="form-group">
                      <label className="form-label">📋 License Type</label>
                      <select className="form-input" value={product.license_type} onChange={e => P("license_type", e.target.value)}>
                        {LICENSE_TYPES.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">🌐 Language</label>
                      <input className="form-input" value={product.language} onChange={e => P("language", e.target.value)} placeholder="e.g. English, Yoruba" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">⚙️ Compatibility / Requirements</label>
                    <input className="form-input" value={product.compatibility} onChange={e => P("compatibility", e.target.value)} placeholder="e.g. Windows 10+, macOS 12+, Android 8+" />
                  </div>
                  <div style={{ display: "flex", gap: "20px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.88rem" }}>
                      <input type="checkbox" checked={product.updates_included} onChange={e => P("updates_included", e.target.checked)} style={{ accentColor: "var(--dz-blue)" }} />
                      <span>🔄 Updates Included</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.88rem" }}>
                      <input type="checkbox" checked={product.drm_protected} onChange={e => P("drm_protected", e.target.checked)} style={{ accentColor: "var(--dz-blue)" }} />
                      <span>🛡️ DRM Protected</span>
                    </label>
                  </div>
                  <div className="alert alert-info" style={{ fontSize: "0.8rem" }}>
                    ⚡ Buyers receive instant download access after payment is confirmed.
                  </div>
                </div>
              </div></div>
            )}

            {/* ── SERVICE FIELDS ────────────────────────────── */}
            {product.product_type === "service" && (
              <div className="card"><div className="card-body">
                <h3 style={{ fontWeight: 700, marginBottom: "14px" }}>🛠️ Service Details</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div className="form-group">
                      <label className="form-label">⏱️ Duration / Turnaround</label>
                      <input className="form-input" value={product.service_duration} onChange={e => P("service_duration", e.target.value)} placeholder="e.g. 2 hours, 3 business days" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">📍 Service Area</label>
                      <input className="form-input" value={product.service_area} onChange={e => P("service_area", e.target.value)} placeholder="e.g. Lagos Island, Remote/Online" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">✅ What's Included</label>
                    <textarea className="form-input" rows={2} value={product.service_includes} onChange={e => P("service_includes", e.target.value)} placeholder="e.g. 1 revision, consultation call, final files" style={{ resize: "vertical" }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">❌ What's NOT Included</label>
                    <textarea className="form-input" rows={2} value={product.service_excludes} onChange={e => P("service_excludes", e.target.value)} placeholder="e.g. Domain purchase, printing costs" style={{ resize: "vertical" }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">📝 Booking Note for Buyers</label>
                    <input className="form-input" value={product.booking_note} onChange={e => P("booking_note", e.target.value)} placeholder="e.g. Please provide brief before booking." />
                  </div>
                </div>
              </div></div>
            )}

            {/* ── LOGISTICS ─────────────────────────────────── */}
            {product.product_type === "physical" && (
              <div className="card"><div className="card-body">
                <h3 style={{ fontWeight: 700, marginBottom: "4px" }}>🚚 Logistics & Delivery</h3>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "14px" }}>Select delivery providers. Include Shipbubble for nationwide coverage.</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "14px" }}>
                  {LOGISTICS_OPTIONS.map(opt => (
                    <button key={opt.id} type="button" onClick={() => toggleLogistics(opt.id)} style={{
                      padding: "10px 14px", borderRadius: "10px", cursor: "pointer", textAlign: "left",
                      border: `1.5px solid ${product.logistics_providers.includes(opt.id) ? "var(--dz-blue)" : "var(--border)"}`,
                      background: product.logistics_providers.includes(opt.id) ? "rgba(0,163,255,0.1)" : "var(--surface)",
                      display: "flex", alignItems: "center", gap: "8px",
                    }}>
                      <span style={{ fontSize: "1.2rem" }}>{opt.icon}</span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>{opt.label}</span>
                      {product.logistics_providers.includes(opt.id) && <span style={{ marginLeft: "auto", color: "var(--dz-blue)" }}>✓</span>}
                    </button>
                  ))}
                </div>

                {/* Self-delivery zones */}
                {product.logistics_providers.includes("self") && (
                  <div className="form-group" style={{ padding: "12px", background: "rgba(0,200,150,0.05)", borderRadius: "10px", border: "1px solid rgba(0,200,150,0.15)" }}>
                    <label className="form-label">🛵 Self-Delivery Coverage (towns/cities)</label>
                    <TagInput
                      placeholder="e.g. Ibadan, Osogbo, Ile-Ife — press Enter"
                      items={product.self_delivery_zones}
                      onAdd={v => P("self_delivery_zones", [...product.self_delivery_zones, v])}
                      onRemove={v => P("self_delivery_zones", product.self_delivery_zones.filter(x => x !== v))}
                    />
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>Buyers in these towns/cities will see "Self Delivery Available"</p>
                  </div>
                )}
              </div></div>
            )}

            {/* Submit */}
            <div style={{ display: "flex", gap: "10px" }}>
              {!isVendor && step === 2 && (
                <button type="button" onClick={() => setStep(1)} className="btn btn-ghost">← Back</button>
              )}
              <button type="submit" disabled={loading || uploading} className="btn btn-primary btn-lg" style={{ flex: 1, justifyContent: "center" }}>
                {loading ? "Publishing…" : uploading ? "Uploading images…" : "🚀 Publish Product"}
              </button>
            </div>
          </div>
        )}
      </form>
    </PageShell>
  );
}
