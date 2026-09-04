/**
 * Server-side layout for product detail pages.
 * Exports generateMetadata so OG tags are rendered at request time —
 * before any client-side JS runs. This lets WhatsApp, Facebook, Twitter,
 * and Google all pick up the correct product image, title, and price.
 */

// Use relative URL for server-side fetch within the same Next.js process,
// or fall back to the configured API URL (never hardcode localhost).
import { getPublicSiteUrl, productShareImageUrl } from "../../../lib/public-url.js";

const SITE_URL_ENV = getPublicSiteUrl();
const VERCEL_URL_ENV = process.env.VERCEL_URL || "";
const _origin = SITE_URL_ENV
  ? SITE_URL_ENV
  : VERCEL_URL_ENV
    ? `https://${VERCEL_URL_ENV}`
    : `http://127.0.0.1:${process.env.PORT || 5000}`;
const configuredApi = process.env.NEXT_PUBLIC_API_URL;
const API_BASE = configuredApi && /^https?:\/\//i.test(configuredApi)
  ? configuredApi
  : `http://127.0.0.1:${process.env.PORT || 5000}/api`;
const SITE_URL = getPublicSiteUrl();
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

  // Social crawlers cannot use data URIs. Serve local/uploaded images through
  // our stable JPEG endpoint so WhatsApp and Facebook can fetch the preview.
  const ogImage = productShareImageUrl(product, product.short_slug || id);

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
