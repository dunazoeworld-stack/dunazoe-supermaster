/**
 * Server-only social image generation.
 *
 * Cloudinary is deliberately used through its signed REST endpoint instead of
 * the SDK so this stays compatible with the Next.js App Router runtime.
 */
import crypto from "crypto";
import { getPublicSiteUrl, normalizePublicImage } from "./public-url.js";

function xml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function productImage(product) {
  let images = product?.images || product?.image_url || product?.image;
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images);
      images = Array.isArray(parsed) ? parsed[0] : images;
    } catch (_) {}
  } else if (Array.isArray(images)) {
    images = images[0];
  }
  return normalizePublicImage(images);
}

function makeSvg(product) {
  const site = getPublicSiteUrl();
  const name = String(product?.name || "DUNAZOE Product").slice(0, 70);
  const vendor = String(product?.business_name || product?.vendor_name || "DUNAZOE Store").slice(0, 42);
  const price = Number(product?.final_price ?? product?.price ?? 0).toLocaleString("en-NG");
  const image = productImage(product);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#071326"/><stop offset="1" stop-color="#102d59"/></linearGradient></defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <rect x="42" y="42" width="1116" height="546" rx="30" fill="#0d1d37" stroke="#1f69b3" stroke-width="2"/>
    <rect x="78" y="78" width="474" height="474" rx="22" fill="#09172c"/>
    <image href="${xml(image)}" x="78" y="78" width="474" height="474" preserveAspectRatio="xMidYMid slice"/>
    <text x="610" y="136" fill="#54b8ff" font-family="Arial,sans-serif" font-size="34" font-weight="700">DUNAZOE</text>
    <text x="610" y="220" fill="#ffffff" font-family="Arial,sans-serif" font-size="40" font-weight="700">${xml(name)}</text>
    <text x="610" y="314" fill="#8fa8c8" font-family="Arial,sans-serif" font-size="25">by ${xml(vendor)}</text>
    <text x="610" y="420" fill="#54b8ff" font-family="Arial,sans-serif" font-size="50" font-weight="700">₦${xml(price)}</text>
    <text x="610" y="500" fill="#8fa8c8" font-family="Arial,sans-serif" font-size="22">${xml(site.replace(/^https?:\/\//, ""))} · Escrow protected</text>
  </svg>`;
}

export async function generateProductShareImage(product) {
  const cloud = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const key = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const secret = String(process.env.CLOUDINARY_API_SECRET || "").trim();
  if (!cloud || !key || !secret || !product?.id) return null;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "dunazoe_product_shares";
  const publicId = `product-${String(product.short_slug || product.product_slug || product.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const params = { folder, format: "png", overwrite: "true", public_id: publicId, timestamp };
  const signaturePayload = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");
  const signature = crypto.createHash("sha1").update(`${signaturePayload}${secret}`).digest("hex");
  const form = new FormData();
  form.append("file", new Blob([makeSvg(product)], { type: "image/svg+xml" }), `${publicId}.svg`);
  form.append("api_key", key);
  form.append("timestamp", timestamp);
  form.append("folder", folder);
  form.append("format", "png");
  form.append("overwrite", "true");
  form.append("public_id", publicId);
  form.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message || `Share image upload failed (${response.status})`);
  }
  return data.secure_url;
}