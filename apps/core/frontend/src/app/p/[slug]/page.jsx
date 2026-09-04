import { notFound } from "next/navigation";
import ProductDetailPage from "../../products/[id]/page";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://dunazoe.com";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || `http://localhost:${process.env.PORT || 5000}/api`;

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
  const image = Array.isArray(product.images) ? product.images[0] : product.image_url;
  const url = `${SITE_URL}/p/${slug}`;
  return {
    title: `${product.name || "Product"} — DUNAZOE`,
    description: product.description || `Buy ${product.name} on DUNAZOE.`,
    alternates: { canonical: url },
    openGraph: {
      title: product.name || "Product on DUNAZOE",
      description: product.description || `Buy ${product.name} on DUNAZOE.`,
      url,
      type: "website",
      images: image && !String(image).startsWith("data:") ? [{ url: image }] : undefined,
    },
  };
}

export default async function ShortProductPage({ params }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product?.id) notFound();
  return <ProductDetailPage resolvedId={String(product.id)} />;
}