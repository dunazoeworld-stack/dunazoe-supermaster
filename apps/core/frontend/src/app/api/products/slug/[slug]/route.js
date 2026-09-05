import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import pool from "../../../../../lib/db.js";
import { getPublicSiteUrl } from "../../../../../lib/public-url.js";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";
const STORE_PATH = path.join(process.cwd(), "local_data", "products.json");

function localSlug(product) {
  if (product.short_slug || product.product_slug) return product.short_slug || product.product_slug;
  const prefix = String(product.name || "product").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28) || "product";
  return `${prefix}-${crypto.createHash("sha256").update(String(product.id || product.name)).digest("hex").slice(0, 10)}`;
}

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
    String(product.product_slug || "") === decoded ||
    localSlug(product) === decoded ||
    String(product.shareable_link || "").endsWith(`/p/${decoded}`)
  );
  if (local) {
    const shortSlug = localSlug(local);
    return NextResponse.json({
      success: true,
      product: {
        ...local,
        short_slug: shortSlug,
        product_slug: local.product_slug || shortSlug,
        canonical_url: local.canonical_url || `https://dunazoe.com/p/${shortSlug}`,
        shareable_link: local.shareable_link || `https://dunazoe.com/p/${shortSlug}`,
        share_image_url: local.share_image_url || `${getPublicSiteUrl()}/api/products/share-image/${encodeURIComponent(shortSlug)}`,
        source: "local_store",
      },
    });
  }

  if (process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL) {
    try {
      const result = await pool.query(
        `SELECT p.*, v.business_name, v.city, v.state, v.rating
         FROM products p LEFT JOIN vendors v ON p.vendor_id=v.id
         WHERE p.is_active=TRUE
           AND (p.short_slug=$1 OR p.product_slug=$1 OR p.shareable_link=$2 OR p.canonical_url=$2)
         LIMIT 1`,
        [decoded, `https://dunazoe.com/p/${decoded}`]
      );
      if (result.rows[0]) return NextResponse.json({ success: true, product: result.rows[0] });
    } catch (error) {
      console.error("[products/slug] DB lookup failed:", error.message);
    }
  }

  return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
}