/**
 * Products API — tries the gateway first (localhost:3000).
 * Falls back to local JSON store when gateway is offline.
 * Supports search by product ID (PRD-XXXXX or raw number) and vendor ID (VND-XXXXX).
 */
import { NextResponse } from "next/server";
import fs   from "fs";
import path from "path";

const GATEWAY   = process.env.GATEWAY_URL || "http://localhost:3000";
const STORE_PATH = path.join(process.cwd(), "local_data", "products.json");

const SERVICE_CHARGE_PCT = 0.05;

// ── Local store helpers ─────────────────────────────────────────────────────
function readStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function writeStore(arr) {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(arr, null, 2), "utf8");
  } catch (e) { console.error("[ProductsStore] write failed:", e.message); }
}

// Parse ID from formats like PRD-00001, VND-00001 or raw numbers
function parseId(str) {
  if (!str) return null;
  const clean = str.toString().replace(/^(PRD|VND|ORD|PAY)-?0*/i, "").trim();
  const num = parseInt(clean, 10);
  return isNaN(num) ? null : num;
}

// ── GET — list / search products (supports ID search) ────────────────────────
export async function GET(request) {
  const { search } = new URL(request.url);
  const params     = new URLSearchParams(search);
  const token      = request.headers.get("Authorization") || "";
  const q          = (params.get("q") || "").trim();

  // ── ID-based search: resolve before calling gateway ──────────────────────
  // If q looks like PRD-XXXXX or a number, pass raw id param to gateway
  let idSearch = null;
  if (/^(PRD-?\d+|\d{3,})$/i.test(q)) {
    idSearch = parseId(q);
    if (idSearch) params.set("product_id", idSearch);
  }
  if (/^VND-?\d+$/i.test(q)) {
    const vid = parseId(q);
    if (vid) params.set("vendor_id", vid);
  }

  // 1. Try live gateway
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res   = await fetch(`${GATEWAY}/products?${params.toString()}`, {
      headers: { Authorization: token },
      signal:  ctrl.signal,
    });
    clearTimeout(timer);
    const d = await res.json();
    if (d.products && Array.isArray(d.products) && d.products.length > 0) {
      return NextResponse.json(d, { status: res.status });
    }
    // Gateway online but empty — merge with local store
    const local    = readStore();
    const merged   = mergeProducts(d.products || [], local, params);
    return NextResponse.json({ ...d, products: merged, total: merged.length, offline_merged: local.length > 0 }, { status: res.status });
  } catch (_) {
    // Gateway offline — serve from local store
    const local    = readStore();
    const filtered = filterProducts(local, params);
    return NextResponse.json({
      success:  true,
      products: filtered,
      total:    filtered.length,
      page:     1,
      offline:  true,
      source:   "local_store",
    }, { status: 200 });
  }
}

// ── POST — create product (price is finalized at listing time) ────────────────
export async function POST(request) {
  const token = request.headers.get("Authorization") || "";
  let body = {};
  try { body = await request.json(); } catch (_) {}

  const submittedImages = Array.isArray(body.images)
    ? body.images
    : (typeof body.images === "string" ? [body.images] : []);
  if (process.env.NODE_ENV === "production" && submittedImages.some(image => String(image).startsWith("data:"))) {
    return NextResponse.json({
      success: false,
      error: "Images must be uploaded to the configured image service before publishing in production.",
    }, { status: 422 });
  }

  if (body.price || body.base_price) {
    const basePrice = Number.isFinite(parseFloat(body.base_price))
      ? parseFloat(body.base_price)
      : parseFloat(body.price);
    const systemCharge = Math.round(basePrice * SERVICE_CHARGE_PCT * 100) / 100;
    const finalPrice = Math.round(basePrice + systemCharge);
    body = {
      ...body,
      base_price: basePrice,
      system_charge: Math.round((finalPrice - basePrice) * 100) / 100,
      final_price: finalPrice,
      price: finalPrice,
    };
  }

  // 1. Try live gateway
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res   = await fetch(`${GATEWAY}/products`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body:    JSON.stringify(body),
      signal:  ctrl.signal,
    });
    clearTimeout(timer);
    const d = await res.json();
    // Also save to local store as backup
    if (d.success || d.product_id) {
      saveToLocal(body, d.product_id || d.id || `gw_${Date.now()}`);
    }
    return NextResponse.json(d, { status: res.status });
  } catch (_) {
    // Gateway offline — save to local store
    const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    saveToLocal(body, localId);
    return NextResponse.json({
      success:         true,
      product_id:      localId,
      queued:          false,
      status:          "published",
      ai_badge:        body.name ? `✨ ${body.name.slice(0, 20)}` : "📦 New Product",
      demand_score:    0.7,
      shareable_link:  null,
      message:         "Product saved and visible in the marketplace.",
      source:          "local_store",
    }, { status: 201 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function saveToLocal(body, id) {
  const store   = readStore();
  const without = store.filter(p => p.id !== id);
  const record  = {
    id,
    name:          body.name         || "Unnamed Product",
    description:   body.description  || "",
    price:         parseFloat(body.price) || 0,
    base_price:    body.base_price ? parseFloat(body.base_price) : parseFloat(body.price) || 0,
    system_charge: body.system_charge ? parseFloat(body.system_charge) : 0,
    final_price:   body.final_price ? parseFloat(body.final_price) : parseFloat(body.price) || 0,
    category:      body.category      || "general",
    type:          body.type          || body.product_type || "physical",
    product_type:  body.type          || body.product_type || "physical",
    images:        Array.isArray(body.images) ? body.images : [],
    ajo_enabled:   body.ajo_enabled   || false,
    ajo_weeks:     body.ajo_weeks     || null,
    sizes:         body.sizes         || [],
    colors:        body.colors        || [],
    brand:         body.brand         || null,
    stock_quantity:body.stock_quantity || null,
    status:        "published",
    created_at:    new Date().toISOString(),
    vendor_id:     body.vendor_id     || "local",
  };
  writeStore([record, ...without]);
}

function filterProducts(products, params) {
  let list = [...products];
  const q      = (params.get("q") || "").toLowerCase().trim();
  const cat    = (params.get("category") || "").toLowerCase().trim();
  const vendor = (params.get("vendor") || "").toLowerCase().trim();
  const prodId = params.get("product_id");
  const vendId = params.get("vendor_id");

  // ID-based filtering (highest priority)
  if (prodId) {
    list = list.filter(p => String(p.id) === String(prodId));
  } else if (vendId) {
    list = list.filter(p => String(p.vendor_id) === String(vendId));
  } else {
    if (q) {
      list = list.filter(p => {
        const name = (p.name || "").toLowerCase();
        const desc = (p.description || "").toLowerCase();
        const pid  = String(p.id || "");
        const vid  = String(p.vendor_id || "");
        // Also match on PRD-XXXXX format
        const prdFormat = `prd-${pid.padStart(5, "0")}`;
        const vndFormat = `vnd-${vid.padStart(5, "0")}`;
        return name.includes(q) || desc.includes(q) || pid === q || vid === q
          || prdFormat.includes(q.toLowerCase()) || vndFormat.includes(q.toLowerCase());
      });
    }
    if (cat)  list = list.filter(p => (p.category || "").toLowerCase().includes(cat));
    if (vendor === "me") list = list;
  }

  const limit = parseInt(params.get("limit") || "24", 10);
  return list.slice(0, limit);
}

function mergeProducts(gateway, local, params) {
  const gatewayIds = new Set((gateway).map(p => String(p.id)));
  const uniqueLocal = local.filter(p => !gatewayIds.has(String(p.id)));
  return filterProducts([...gateway, ...uniqueLocal], params);
}
