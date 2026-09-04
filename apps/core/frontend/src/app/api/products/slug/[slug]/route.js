import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import pool from "../../../../../lib/db.js";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";
const STORE_PATH = path.join(process.cwd(), "local_data", "products.json");

function readStore() {
  try {
    const data = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

export async function GET(_request, { params }) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);

  try {
    const response = await fetch(`${GATEWAY}/products/slug/${encodeURIComponent(decoded)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) return NextResponse.json(await response.json(), { status: response.status });
  } catch (_) {}

  const local = readStore().find(product =>
    String(product.short_slug || "") === decoded ||
    String(product.shareable_link || "").endsWith(`/p/${decoded}`)
  );
  if (local) return NextResponse.json({ success: true, product: { ...local, source: "local_store" } });

  if (process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL) {
    try {
      const result = await pool.query(
        `SELECT p.*, v.business_name, v.city, v.state, v.rating
         FROM products p LEFT JOIN vendors v ON p.vendor_id=v.id
         WHERE p.is_active=TRUE
           AND (p.short_slug=$1 OR p.shareable_link=$2)
         LIMIT 1`,
        [decoded, `dunazoe.com/p/${decoded}`]
      );
      if (result.rows[0]) return NextResponse.json({ success: true, product: result.rows[0] });
    } catch (error) {
      console.error("[products/slug] DB lookup failed:", error.message);
    }
  }

  return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
}