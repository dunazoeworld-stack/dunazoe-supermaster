/**
 * GET /api/products/[id]
 * Returns a single product by id.
 * Checks the gateway first, then falls back to the local JSON store
 * (which holds vendor-submitted products when microservices are offline).
 */
import { NextResponse } from "next/server";
import fs   from "fs";
import path from "path";
import pool from "../../../../lib/db.js";

const GATEWAY    = process.env.GATEWAY_URL || "http://localhost:3000";
const STORE_PATH = path.join(process.cwd(), "local_data", "products.json");

function readStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}


export async function GET(request, { params }) {
  const { id } = await params;

  // 1 ── Try live gateway ────────────────────────────────────────────────────
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res   = await fetch(`${GATEWAY}/products/${id}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const d = await res.json();
      if (d && (d.id || d.product)) {
        return NextResponse.json(d.product || d, { status: 200 });
      }
    }
  } catch (_) { /* gateway offline — fall through */ }

  // 2 ── Try local JSON store (local_XXXX ids or gateway ids saved locally) ──
  const local = readStore();
  const found = local.find(p => String(p.id) === String(id));
  if (found) {
    return NextResponse.json({ ...found, source: "local_store" }, { status: 200 });
  }

  // 3 ── Try database directly ───────────────────────────────────────────────
  if (process.env.DATABASE_URL) {
    try {
      // id may be numeric (DB row) or string (local_ prefix)
      const isNumeric = /^\d+$/.test(id);
      if (isNumeric) {
        const r = await pool.query(
          `SELECT p.*, v.business_name, v.city, v.state
           FROM products p
           LEFT JOIN vendors v ON p.vendor_id = v.id
           WHERE p.id = $1 AND p.is_active = TRUE`,
          [parseInt(id, 10)]
        );
        if (r.rows.length > 0) {
          const row = r.rows[0];
          // Normalise images field (stored as text JSON in DB)
          let images = [];
          try { images = JSON.parse(row.images || "[]"); } catch { images = []; }
          return NextResponse.json({ ...row, images, source: "database" }, { status: 200 });
        }
      }
    } catch (e) {
      console.error("[products/[id]] DB error:", e.message);
    }
  }

  return NextResponse.json({ error: "Product not found", id }, { status: 404 });
}
