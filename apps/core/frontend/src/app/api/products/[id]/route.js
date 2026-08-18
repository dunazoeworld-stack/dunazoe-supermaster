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
  let updateBody = { ...body };
  if (!isSoftDelete && (body.price !== undefined || body.base_price !== undefined)) {
    // Edits from older clients send the customer-facing price. Treat that as
    // final_price and derive the stored vendor base price to avoid a second 5%.
    const basePrice = Number.isFinite(parseFloat(body.base_price))
      ? parseFloat(body.base_price)
      : parseFloat(body.price) / 1.05;
    const systemCharge = Math.round(basePrice * 0.05 * 100) / 100;
    const finalPrice = Math.round(basePrice + systemCharge);
    updateBody = {
      ...body,
      base_price: basePrice,
      system_charge: Math.round((finalPrice - basePrice) * 100) / 100,
      final_price: finalPrice,
      price: finalPrice,
    };
  }

  // ── 1. Try gateway first ────────────────────────────────────────────────────
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const token = (request.headers.get("Authorization") || "");
    const res   = await fetch(`${GATEWAY}/products/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json", Authorization: token },
      body:    JSON.stringify(updateBody),
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
        await pool.query(`
          ALTER TABLE products
            ADD COLUMN IF NOT EXISTS base_price NUMERIC(12,2),
            ADD COLUMN IF NOT EXISTS system_charge NUMERIC(12,2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS final_price NUMERIC(12,2)
        `);
        if (updateBody.name        !== undefined) { sets.push(`name=$${$i++}`);        vals.push(updateBody.name); }
        if (updateBody.description !== undefined) { sets.push(`description=$${$i++}`); vals.push(updateBody.description); }
        if (updateBody.price       !== undefined) { sets.push(`price=$${$i++}`);       vals.push(parseFloat(updateBody.price)); }
        if (updateBody.base_price  !== undefined) { sets.push(`base_price=$${$i++}`);  vals.push(parseFloat(updateBody.base_price)); }
        if (updateBody.system_charge !== undefined) { sets.push(`system_charge=$${$i++}`); vals.push(parseFloat(updateBody.system_charge)); }
        if (updateBody.final_price !== undefined) { sets.push(`final_price=$${$i++}`); vals.push(parseFloat(updateBody.final_price)); }
        if (updateBody.stock       !== undefined) { sets.push(`stock=$${$i++}`);       vals.push(parseInt(updateBody.stock)); }
        if (updateBody.category    !== undefined) { sets.push(`category=$${$i++}`);    vals.push(updateBody.category); }
        if (updateBody.weight      !== undefined) { sets.push(`weight=$${$i++}`);      vals.push(parseFloat(updateBody.weight)); }
        if (updateBody.dimensions  !== undefined) { sets.push(`dimensions=$${$i++}`);  vals.push(updateBody.dimensions); }
          if (sets.length > 0) {
            sets.push(`updated_at=NOW()`);
            vals.push(numId);
            await pool.query(`UPDATE products SET ${sets.join(", ")} WHERE id=$${$i}`, vals);
          }
        }

        _mirrorToLocalStore(id, updateBody, isSoftDelete);
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
  const updated = _mirrorToLocalStore(id, updateBody, isSoftDelete);
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
      const allowed = ["name", "description", "price", "base_price", "system_charge", "final_price", "stock", "category", "weight", "dimensions"];
      allowed.forEach(k => { if (body[k] !== undefined) store[idx][k] = body[k]; });
    }
    writeStore(store);
    return true;
  } catch { return false; }
}
