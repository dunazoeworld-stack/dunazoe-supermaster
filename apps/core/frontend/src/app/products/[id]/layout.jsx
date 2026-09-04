/**
 * Server-side layout for product detail pages.
 * Exports generateMetadata so OG tags are rendered at request time —
 * before any client-side JS runs. This lets WhatsApp, Facebook, Twitter,
 * and Google all pick up the correct product image, title, and price.
 */

// Use relative URL for server-side fetch within the same Next.js process,
// or fall back to the configured API URL (never hardcode localhost).
const SITE_URL_ENV = process.env.NEXT_PUBLIC_SITE_URL || "";
const VERCEL_URL_ENV = process.env.VERCEL_URL || "";
const _origin = SITE_URL_ENV
  ? SITE_URL_ENV
  : VERCEL_URL_ENV
    ? `https://${VERCEL_URL_ENV}`
    : "http://localhost:5000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || `${_origin}/api`;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://dunazoe.com";
const FALLBACK_IMAGE = `${SITE_URL}/og-default.png`;

export async function generateMetadata({ params }) {
  const { id } = await params;

  let product = null;
  try {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      next: { revalidate: 300 }, // cache 5 min — products change occasionally
    });
    if (res.ok) {
      const data = await res.json();
      product = data.product || data;
    }
  } catch (_) {
    // Service unreachable — fall back to generic metadata below
  }

  if (!product) {
    return {
      title: "Product — DUNAZOE",
      description: "Discover amazing products on DUNAZOE, Nigeria's AI-powered marketplace.",
      openGraph: {
        title: "DUNAZOE Marketplace",
        description: "Shop, sell, and ship on Nigeria's leading AI marketplace.",
        images: [{ url: FALLBACK_IMAGE, width: 1200, height: 630, alt: "DUNAZOE" }],
        type: "website",
        locale: "en_NG",
        siteName: "DUNAZOE",
      },
    };
  }

  // Pick the best image: handle array, JSON string array, or plain URL
  let parsedImages = product.images;
  if (typeof parsedImages === "string") {
    try { parsedImages = JSON.parse(parsedImages); } catch (_) {}
  }
  const rawImage =
    (Array.isArray(parsedImages) && parsedImages[0]) ||
    (typeof parsedImages === "string" && parsedImages) ||
    product.image_url ||
    product.image ||
    FALLBACK_IMAGE;
  // Social crawlers require a public absolute URL; local data URIs are not valid OG images.
  const imageString = typeof rawImage === "string" ? rawImage.trim() : "";
  const normalizedImage = imageString.startsWith("http://")
    ? `https://${imageString.slice("http://".length)}`
    : imageString;
  const ogImage = !normalizedImage || normalizedImage.startsWith("data:")
    ? FALLBACK_IMAGE
    : normalizedImage.startsWith("/")
      ? `${SITE_URL}${normalizedImage}`
      : normalizedImage;

  const price    = parseFloat(product.price || 0);
  const currency = "NGN";
  const title    = `${product.name || "Product"} — DUNAZOE`;
  const desc     = product.description
    ? product.description.slice(0, 200)
    : `Buy ${product.name} on DUNAZOE. Secure payment · Fast delivery · Escrow protected.`;

  const productUrl = product.short_slug
    ? `${SITE_URL}/p/${product.short_slug}`
    : `${SITE_URL}/products/${id}`;

  return {
    title,
    description: desc,
    openGraph: {
      title:       product.name || "Product on DUNAZOE",
      description: desc,
      url:         productUrl,
      type:        "website",
      locale:      "en_NG",
      siteName:    "DUNAZOE",
      images: [
        {
          url:    ogImage,
          width:  1200,
          height: 630,
          alt:    product.name || "Product image",
        },
      ],
    },
    twitter: {
      card:        "summary_large_image",
      title:       product.name || "Product on DUNAZOE",
      description: desc,
      images:      [ogImage],
      site:        "@dunazoe",
    },
    alternates: { canonical: productUrl },
    // Product-specific structured metadata
    other: {
      "og:type":                 "product",
      "og:price:amount":         price.toFixed(2),
      "og:price:currency":       currency,
      "product:price:amount":    price.toFixed(2),
      "product:price:currency":  currency,
      "og:availability":         "in stock",
    },
  };
}

export default function ProductDetailLayout({ children }) {
  return children;
}
