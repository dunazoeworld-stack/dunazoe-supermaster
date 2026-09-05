import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { getPublicSiteUrl } from "../../../../../lib/public-url.js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";
const STORE_PATH = path.join(process.cwd(), "local_data", "products.json");
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

function readStore() {
  try {
    const value = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    return Array.isArray(value) ? value : [];
  } catch (_) {
    return [];
  }
}

function slugFor(product) {
  if (product.short_slug || product.product_slug) return product.short_slug || product.product_slug;
  const prefix = String(product.name || "product").toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 28) || "product";
  return `${prefix}-${crypto.createHash("sha256").update(String(product.id || product.name)).digest("hex").slice(0, 10)}`;
}

function firstImage(product) {
  let images = product?.images || product?.image_urls || product?.image_url || product?.image;
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images);
      images = Array.isArray(parsed) ? parsed[0] : images;
    } catch (_) {}
  } else if (Array.isArray(images)) {
    images = images[0];
  }
  return String(images || "").trim();
}

async function resolveProduct(key) {
  const decoded = decodeURIComponent(key);
  const local = readStore().find(product =>
    String(product.id) === decoded ||
    String(product.short_slug || "") === decoded ||
    String(product.product_slug || "") === decoded ||
    slugFor(product) === decoded ||
    String(product.shareable_link || "").endsWith(`/p/${decoded}`)
  );
  if (local) return local;

  try {
    const response = await fetch(`${GATEWAY}/products/slug/${encodeURIComponent(decoded)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const data = await response.json();
      return data.product || data;
    }
  } catch (_) {}

  if (/^\d+$/.test(decoded)) {
    try {
      const response = await fetch(`http://127.0.0.1:${process.env.PORT || 5000}/api/products/${encodeURIComponent(decoded)}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) return await response.json();
    } catch (_) {}
  }
  return null;
}

function decodeDataUri(value) {
  const match = String(value || "").match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/i);
  if (!match) return null;
  const mime = match[1] || "application/octet-stream";
  const bytes = match[2]
    ? Buffer.from(match[3], "base64")
    : Buffer.from(decodeURIComponent(match[3]), "utf8");
  return { mime, bytes };
}

function isPrivateHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  if (host === "localhost" || host === "::1" || host.endsWith(".local")) return true;
  if (/^(127|10)\./.test(host) || /^192\.168\./.test(host)) return true;
  const match = host.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

async function readImage(value) {
  const dataUri = decodeDataUri(value);
  if (dataUri) return dataUri;

  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || isPrivateHost(url.hostname)) return null;
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8000) });
  if (!response.ok) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) return null;
  const mime = response.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
  return mime.startsWith("image/") ? { mime, bytes } : null;
}

async function fallbackImage() {
  const file = path.join(process.cwd(), "public", "og-default.png");
  return { mime: "image/png", bytes: fs.readFileSync(file) };
}

export async function GET(_request, { params }) {
  const { slug } = await params;
  try {
    const product = await resolveProduct(slug);
    const source = product && firstImage(product);
    const original = source ? await readImage(source).catch(() => null) : null;
    const image = original || await fallbackImage();
    const jpeg = await sharp(image.bytes)
      .resize(1200, 630, { fit: "cover", position: "centre" })
      .jpeg({ quality: 88, progressive: true })
      .toBuffer();

    return new Response(jpeg, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": CACHE_CONTROL,
        "Content-Length": String(jpeg.length),
      },
    });
  } catch (error) {
    console.error("[product-share-image] failed:", error.message);
    try {
      const image = await fallbackImage();
      return new Response(image.bytes, {
        status: 200,
        headers: { "Content-Type": image.mime, "Cache-Control": CACHE_CONTROL },
      });
    } catch (_) {
      return new Response(`Image unavailable on ${getPublicSiteUrl()}`, {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
  }
}