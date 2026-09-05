import assert from "node:assert/strict";

const base = (process.env.BASE_URL || "http://127.0.0.1:5000").replace(/\/+$/, "");

async function get(path) {
  const response = await fetch(`${base}${path}`);
  const body = await response.arrayBuffer();
  return { response, body, text: () => Buffer.from(body).toString("utf8") };
}

const list = await get("/api/products");
assert.equal(list.response.status, 200, "product list API should be available");
const listData = JSON.parse(list.text());
const product = listData.products?.[0];
assert.ok(product?.id, "product list should contain at least one product");

const slug = product.short_slug || product.product_slug;
assert.ok(slug, "product should expose a short slug");

const slugResult = await get(`/api/products/slug/${encodeURIComponent(slug)}`);
assert.equal(slugResult.response.status, 200, "short-slug API should resolve");
const resolved = JSON.parse(slugResult.text()).product;
assert.equal(resolved.short_slug, slug, "short-slug API should preserve the slug");
assert.match(resolved.canonical_url, /^https:\/\/dunazoe\.com\/p\//, "canonical URL should use the public HTTPS site");
assert.match(resolved.share_image_url || "", /\/api\/products\/share-image\//, "local products should expose a public image endpoint");

const page = await get(`/p/${encodeURIComponent(slug)}`);
assert.equal(page.response.status, 200, "short product page should render");
const html = page.text();
assert.match(html, /(?:property|name)="og:type" content="website"/, "valid website OG type should be present");
assert.match(html, /property="og:image" content="https:\/\/dunazoe\.com\/api\/products\/share-image\//, "OG image should use the public product image endpoint");
assert.match(html, /name="twitter:card" content="summary_large_image"/, "Twitter summary card should be present");

const image = await get(`/api/products/share-image/${encodeURIComponent(slug)}`);
assert.equal(image.response.status, 200, "product share image endpoint should render");
assert.match(image.response.headers.get("content-type") || "", /^image\/jpeg/, "share image should be crawler-friendly JPEG");
assert.ok(image.body.byteLength > 1000, "share image should not be an empty fallback response");

console.log(`product-sharing checks passed for ${slug}`);