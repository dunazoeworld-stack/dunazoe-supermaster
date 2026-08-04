/**
 * /api/products/[id]
 * GET  — fetch single product (gateway → local store → DB)
 * PUT  — update product (vendor owner, admin, or superuser only)
 *        body: { name, description, price, stock, category, weight, dimensions, status }
 *        status = "deleted" triggers soft-delete
 */
import { NextResponse } from "next/server";
import fs   from "fs";
import path from "path";
import pool from "../../../../lib/db.js";
import jwt  from "jsonwebtoken";

const GATEWAY    = process.env.GATEWAY_URL  || "http://localhost:3000";
const STORE_PATH = path.join(process.cwd(), "local_data", "products.json");
const JWT_SECRET = process.env.JWT_SECRET   || process.env.SESSION_SECRET || "";
const ADMIN_ROLES = ["admin", "super_admin", "cto", "superuser"];

// ── Local store helpers ────────────────────────────────────────────────────────
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
  } catch (e) { console.error("[products/[id]] store write failed:", e.message); }
}

// ── JWT helper ────────────────────────────────────────────────────────────────
function verifyAuth(request) {
  try {
    const token = (request.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!token || !JWT_SECRET) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch { return null; }
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(request, { params }) {
  const { id } = await params;

  // 1 ── Try live gateway ────────────────────────────────────────────────────────
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

  // 2 ── Try local JSON store ────────────────────────────────────────────────────
  const local = readStore();
  const found = local.find(p => String(p.id) === String(id));
  if (found) {
    return NextResponse.json({ ...found, source: "local_store" }, { status: 200 });
  }

  // 3 ── Try database directly ───────────────────────────────────────────────────
  if (process.env.DATABASE_URL) {
    try {
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

// ── PUT — edit or soft-delete product ─────────────────────────────────────────
export async function PUT(request, { params }) {
  const { id } = await params;

  // Authenticate
  const payload = verifyAuth(request);
  if (!payload) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }

  let body = {};
  try { body = await request.json(); } catch (_) {}

  const isAdmin      = ADMIN_ROLES.includes(payload.role);
  const isSoftDelete = body.status === "deleted";

  // ── 1. Try gateway first ────────────────────────────────────────────────────
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const token = (request.headers.get("Authorization") || "");
    const res   = await fetch(`${GATEWAY}/products/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json", Authorization: token },
      body:    JSON.stringify(body),
      signal:  ctrl.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const d = await res.json();
      if (d.success || d.product) {
        // Mirror change to local store
        _mirrorToLocalStore(id, body, isSoftDelete);
        return NextResponse.json({ success: true, product: d.product || d });
      }
    }
  } catch (_) { /* gateway offline — fall through to direct DB */ }

  // ── 2. Direct DB update ─────────────────────────────────────────────────────
  if (process.env.DATABASE_URL) {
    try {
      const isNumeric = /^\d+$/.test(id);
      if (isNumeric) {
        const numId = parseInt(id, 10);

        // Ownership check — vendor may only edit their own products
        if (!isAdmin) {
          const own = await pool.query(
            `SELECT vendor_id FROM products
             WHERE id = $1 LIMIT 1`,
            [numId]
          );
          if (own.rows.length === 0) {
            return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
          }
          // Get vendor_id for this user
          const vRow = await pool.query(
            `SELECT id FROM vendors WHERE user_id = $1 LIMIT 1`,
            [payload.id]
          ).catch(() => ({ rows: [] }));
          const userVendorId = vRow.rows[0]?.id;
          if (String(own.rows[0].vendor_id) !== String(userVendorId)) {
            return NextResponse.json({ success: false, error: "You do not own this product." }, { status: 403 });
          }
        }

        if (isSoftDelete) {
          // Soft delete — preserve historical order data
          await pool.query(
            `UPDATE products SET is_active = FALSE, status = 'deleted', updated_at = NOW() WHERE id = $1`,
            [numId]
          );
          console.log(`[products] Soft-deleted product ${numId} by user ${payload.id}`);
        } else {
          // Edit — only update fields that were provided
          const sets = [];
          const vals = [];
          let $i = 1;
          if (body.name        !== undefined) { sets.push(`name=$${$i++}`);        vals.push(body.name); }
          if (body.description !== undefined) { sets.push(`description=$${$i++}`); vals.push(body.description); }
          if (body.price       !== undefined) { sets.push(`price=$${$i++}`);       vals.push(parseFloat(body.price)); }
          if (body.stock       !== undefined) { sets.push(`stock=$${$i++}`);       vals.push(parseInt(body.stock)); }
          if (body.category    !== undefined) { sets.push(`category=$${$i++}`);    vals.push(body.category); }
          if (body.weight      !== undefined) { sets.push(`weight=$${$i++}`);      vals.push(parseFloat(body.weight)); }
          if (body.dimensions  !== undefined) { sets.push(`dimensions=$${$i++}`);  vals.push(body.dimensions); }
          if (sets.length > 0) {
            sets.push(`updated_at=NOW()`);
            vals.push(numId);
            await pool.query(`UPDATE products SET ${sets.join(", ")} WHERE id=$${$i}`, vals);
          }
        }

        _mirrorToLocalStore(id, body, isSoftDelete);
        return NextResponse.json({
          success: true,
          message: isSoftDelete ? "Product removed." : "Product updated.",
        });
      }
    } catch (e) {
      console.error("[products/[id] PUT] DB error:", e.message);
      return NextResponse.json({ success: false, error: "Database error. Please try again." }, { status: 500 });
    }
  }

  // ── 3. Local store only (no DB) ─────────────────────────────────────────────
  const updated = _mirrorToLocalStore(id, body, isSoftDelete);
  if (updated) {
    return NextResponse.json({ success: true, message: isSoftDelete ? "Product removed." : "Product updated." });
  }

  return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
}

// Helper: keep local JSON store in sync
function _mirrorToLocalStore(id, body, isSoftDelete) {
  try {
    const store = readStore();
    const idx   = store.findIndex(p => String(p.id) === String(id));
    if (idx === -1) return false;
    if (isSoftDelete) {
      store.splice(idx, 1); // remove from local listing
    } else {
      const allowed = ["name", "description", "price", "stock", "category", "weight", "dimensions"];
      allowed.forEach(k => { if (body[k] !== undefined) store[idx][k] = body[k]; });
    }
    writeStore(store);
    return true;
  } catch { return false; }
}
