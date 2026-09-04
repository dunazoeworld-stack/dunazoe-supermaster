import { notFound } from "next/navigation";
import ProductDetailPage from "../../products/[id]/page";
import { getPublicSiteUrl, normalizePublicImage } from "../../../lib/public-url.js";

const SITE_URL = getPublicSiteUrl();
const configuredApi = process.env.NEXT_PUBLIC_API_URL;
const API_BASE = configuredApi && /^https?:\/\//i.test(configuredApi)
  ? configuredApi
  : `http://127.0.0.1:${process.env.PORT || 5000}/api`;

async function getProduct(slug) {
  try {
    const response = await fetch(`${API_BASE}/products/slug/${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json();
    return data.product || data;
  } catch { return null; }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Product — DUNAZOE" };
  const image = Array.isArray(product.images) ? product.images[0] : product.image_url || product.images;
  const imageUrl = normalizePublicImage(product.share_image_url || image);
  const url = `${SITE_URL}/p/${slug}`;
  const description = product.description || `Buy ${product.name} on DUNAZOE. Secure checkout and fast delivery.`;
  return {
    title: `${product.name || "Product"} — DUNAZOE`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${product.name || "Product"} | DUNAZOE`,
      description,
      url,
      siteName: "DUNAZOE",
      locale: "en_NG",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: product.name || "DUNAZOE product" }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name || "Product"} | DUNAZOE`,
      description,
      images: [imageUrl],
    },
    other: {
      "og:type": "product",
      "og:price:amount": String(product.final_price ?? product.price ?? 0),
      "og:price:currency": "NGN",
    },
  };
}

export default async function ShortProductPage({ params }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product?.id) notFound();
  return <ProductDetailPage resolvedId={String(product.id)} />;
}