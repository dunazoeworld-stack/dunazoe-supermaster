/**
 * Products API — tries the gateway first (localhost:3000).
 * When the gateway is offline, falls back to a local JSON file store at
 * apps/core/frontend/local_data/products.json so that vendor-published
 * products remain visible even without running microservices.
 */
import { NextResponse } from "next/server";
import fs   from "fs";
import path from "path";

const GATEWAY   = process.env.GATEWAY_URL || "http://localhost:3000";
const STORE_PATH = path.join(process.cwd(), "local_data", "products.json");

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

// ── GET — list / search products ────────────────────────────────────────────
export async function GET(request) {
  const { search } = new URL(request.url);
  const params     = new URLSearchParams(search);
  const token      = request.headers.get("Authorization") || "";

  // 1. Try live gateway
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res   = await fetch(`${GATEWAY}/products${search}`, {
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

// ── POST — create product ────────────────────────────────────────────────────
export async function POST(request) {
  const token = request.headers.get("Authorization") || "";
  let body = {};
  try { body = await request.json(); } catch (_) {}

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
    // Also save to local store as backup (so it shows even if gateway clears)
    if (d.success || d.product_id) {
      saveToLocal(body, d.product_id || d.id || `gw_${Date.now()}`);
    }
    return NextResponse.json(d, { status: res.status });
  } catch (_) {
    // Gateway offline — save to local store and return queued response
    const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    saveToLocal(body, localId);
    return NextResponse.json({
      success:         true,
      product_id:      localId,
      queued:          false,        // NOT queued — it IS saved to local store
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
  // Avoid duplicates: overwrite if same id
  const without = store.filter(p => p.id !== id);
  const record  = {
    id,
    name:          body.name         || "Unnamed Product",
    description:   body.description  || "",
    price:         parseFloat(body.price) || 0,
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
    vendor_id:     "local",
  };
  writeStore([record, ...without]);
}

function filterProducts(products, params) {
  let list = [...products];
  const q    = (params.get("q") || "").toLowerCase().trim();
  const cat  = (params.get("category") || "").toLowerCase().trim();
  const vendor = (params.get("vendor") || "").toLowerCase().trim();
  if (q)    list = list.filter(p => (p.name || "").toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q));
  if (cat)  list = list.filter(p => (p.category || "").toLowerCase().includes(cat));
  if (vendor === "me") list = list; // all local products are "mine" when offline
  const limit = parseInt(params.get("limit") || "24", 10);
  return list.slice(0, limit);
}

function mergeProducts(gateway, local, params) {
  const gatewayIds = new Set((gateway).map(p => String(p.id)));
  const uniqueLocal = local.filter(p => !gatewayIds.has(String(p.id)));
  return filterProducts([...gateway, ...uniqueLocal], params);
}
