const DEFAULT_SITE_URL = "https://dunazoe.com";

export function getPublicSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  return String(configured).replace(/\/+$/, "");
}

export function toPublicUrl(value, fallbackPath = "") {
  const raw = String(value || "").trim();
  if (/^https?:\/\//i.test(raw)) return raw.replace(/^http:\/\//i, "https://");
  if (raw.startsWith("/")) return `${getPublicSiteUrl()}${raw}`;
  if (raw) return `https://${raw}`;
  return fallbackPath ? `${getPublicSiteUrl()}${fallbackPath}` : getPublicSiteUrl();
}

export function productShareUrl(product) {
  if (!product) return getPublicSiteUrl();
  const slug = product.canonical_url || product.short_slug || product.product_slug;
  if (slug) {
    const candidate = toPublicUrl(slug);
    if (candidate.includes("/p/")) return candidate;
    return `${getPublicSiteUrl()}/p/${encodeURIComponent(String(slug).replace(/^.*\/p\//, ""))}`;
  }
  return `${getPublicSiteUrl()}/products/${encodeURIComponent(String(product.id || ""))}`;
}

export function normalizePublicImage(value, fallback = `${getPublicSiteUrl()}/og-default.png`) {
  const raw = String(value || "").trim();
  if (!raw || raw.startsWith("data:")) return fallback;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("http://")) return `https://${raw.slice("http://".length)}`;
  if (raw.startsWith("/")) return `${getPublicSiteUrl()}${raw}`;
  return raw;
}

function firstProductImage(product) {
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

export function productShareImageUrl(product, identifier = "") {
  const configured = String(product?.share_image_url || "").trim();
  if (configured && !configured.startsWith("data:") && (/^https?:\/\//i.test(configured) || configured.startsWith("/") || configured.startsWith("//"))) {
    return normalizePublicImage(configured);
  }

  const direct = firstProductImage(product);
  if (direct && !direct.startsWith("data:") && (/^https?:\/\//i.test(direct) || direct.startsWith("/") || direct.startsWith("//"))) {
    return normalizePublicImage(direct);
  }

  const key = identifier || product?.short_slug || product?.product_slug || product?.id;
  return key
    ? `${getPublicSiteUrl()}/api/products/share-image/${encodeURIComponent(String(key))}`
    : `${getPublicSiteUrl()}/og-default.png`;
}