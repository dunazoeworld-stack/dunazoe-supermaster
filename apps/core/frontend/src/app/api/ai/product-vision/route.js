import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 10;
const PROVIDER_TIMEOUT_MS = 15_000;
const requestLog = new Map();

const VALID_CATEGORIES = new Set([
  "fashion", "phones_&_tablets", "food_&_groceries", "beauty_&_health",
  "electronics", "solar_energy", "baby_&_kids", "agriculture",
  "home_&_living", "sports", "books_&_education",
]);

function fetchWithTimeout(url, options = {}, timeoutMs = PROVIDER_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

async function responseJson(response) {
  const text = await response.text();
  try { return JSON.parse(text); }
  catch { throw new Error("AI provider returned invalid JSON"); }
}

// Extract one JSON object without accepting a greedy multi-object match.
function parseObject(text) {
  const source = String(text || "").replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const start = source.indexOf("{");
  if (start < 0) throw new Error("No JSON object in AI response");
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') quoted = false;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      try { return JSON.parse(source.slice(start, i + 1)); }
      catch { throw new Error("AI provider returned malformed JSON"); }
    }
  }
  throw new Error("Incomplete JSON object in AI response");
}

function validateResult(value, source) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI response is not an object");
  }
  if (typeof value.name !== "string" || value.name.trim().length < 2) {
    throw new Error("AI response is missing a valid product name");
  }
  if (typeof value.description !== "string" || value.description.trim().length < 10) {
    throw new Error("AI response is missing a valid description");
  }
  if (!VALID_CATEGORIES.has(value.category)) {
    throw new Error("AI response contains an invalid product category");
  }
  const confidence = Number(value.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("AI response contains an invalid confidence score");
  }
  for (const field of ["colors", "sizes", "features", "tags"]) {
    if (value[field] !== undefined && !Array.isArray(value[field])) {
      throw new Error(`AI response field ${field} must be an array`);
    }
  }
  return {
    ...value,
    confidence,
    colors: Array.isArray(value.colors) ? value.colors.filter(v => typeof v === "string").slice(0, 20) : [],
    sizes: Array.isArray(value.sizes) ? value.sizes.filter(v => typeof v === "string").slice(0, 20) : [],
    features: Array.isArray(value.features) ? value.features.filter(v => typeof v === "string").slice(0, 10) : [],
    tags: Array.isArray(value.tags) ? value.tags.filter(v => typeof v === "string").slice(0, 20) : [],
    source,
  };
}

function authorizeAndRateLimit(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET || "";
  if (!token || !secret) return { ok: false, status: 401, error: "Authentication required." };
  let identity;
  try { identity = jwt.verify(token, secret); }
  catch { return { ok: false, status: 401, error: "Invalid or expired token." }; }

  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = `${identity.id || identity.user_id || "user"}:${forwarded || "unknown"}`;
  const now = Date.now();
  const recent = (requestLog.get(key) || []).filter(timestamp => now - timestamp < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    requestLog.set(key, recent);
    return { ok: false, status: 429, error: "Vision analysis limit reached. Please try again in a minute." };
  }
  recent.push(now);
  requestLog.set(key, recent);
  return { ok: true };
}

function validImageInput(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 12 * 1024 * 1024) return false;
  if (/^https?:\/\//i.test(value)) return true;
  return /^data:image\/(?:jpeg|jpg|png|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value);
}

// ──────────────────────────────────────────────────────────────────────────────
// DUNAZOE — Product Vision AI  (server-side)
// Supports: OpenAI GPT-4o · xAI Grok Vision · Google Gemini 1.5 Flash
// Falls back to self-dependent heuristic analysis when no API key is configured.
// Returns a fully structured product listing object from a product image.
// ──────────────────────────────────────────────────────────────────────────────

const VISION_PROMPT = `You are a product listing specialist for DUNAZOE, Nigeria's leading e-commerce marketplace. Analyze this product image carefully and generate an accurate, compelling listing.

Return ONLY a valid JSON object — no markdown, no explanation, no code fences. Just raw JSON:
{
  "name": "Specific product name — include brand, model, colour, variant if visible (e.g. 'Nike Air Force 1 White Leather Sneakers'). Capitalise properly. Be concise but descriptive.",
  "description": "2–3 sentences. Highlight key features, quality signals, and why Nigerian buyers will love it. Use natural, persuasive language.",
  "category": "EXACTLY one of: fashion|phones_&_tablets|food_&_groceries|beauty_&_health|electronics|solar_energy|baby_&_kids|agriculture|home_&_living|sports|books_&_education",
  "weight_kg": 0.5,
  "dimensions": "L×W×H in cm, e.g. 30×20×10cm. Use null if not applicable.",
  "material": "Primary material, e.g. Cotton, Leather, Stainless Steel. Use null if unclear.",
  "brand": "Brand name if clearly visible on the product or packaging. Use null if not visible.",
  "colors": ["list", "of", "visible", "colors"],
  "sizes": ["visible size or variant options, or [] if not shown"],
  "features": ["3 to 6 concise product features inferred from the image"],
  "tags": ["5 to 7 relevant search keywords buyers would type to find this product"],
  "confidence": 0.85
}

Weight estimation guide (use these ranges):
- Mobile phones: 0.15–0.25 kg  | Tablets: 0.3–0.8 kg  | Laptops: 1.5–2.5 kg
- T-shirts / tops: 0.2–0.4 kg  | Jeans / trousers: 0.4–0.7 kg  | Dresses: 0.3–0.5 kg
- Sneakers / shoes: 0.5–1.2 kg | Sandals: 0.2–0.5 kg  | Bags / handbags: 0.3–1.5 kg
- Wristwatches: 0.05–0.2 kg    | Jewellery: 0.02–0.1 kg | Sunglasses: 0.02–0.05 kg
- Cosmetics / creams (200 ml): 0.2–0.3 kg | Perfume (50 ml): 0.1–0.15 kg
- Food packages (500 ml–1 L): 0.5–1.2 kg | Dry food (1 kg bag): 1.0 kg
- Books: 0.2–0.8 kg each | School bags: 0.5–1.0 kg
- Solar panels (portable): 2–5 kg | Small inverter: 3–8 kg
- Kitchen blenders: 2–4 kg | Toasters: 1–2 kg | Electric irons: 1–1.5 kg
- Baby clothing: 0.1–0.2 kg | Baby shoes: 0.1–0.3 kg | Toys: 0.2–2 kg`;

// ── OpenAI GPT-4o Vision ──────────────────────────────────────────────────────
async function callOpenAI(imageUrl, apiKey) {
  const r = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: [
        { type: "text", text: VISION_PROMPT },
        { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
      ]}],
      max_tokens: 700, temperature: 0.15,
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await responseJson(r);
  const text = d.choices?.[0]?.message?.content || "";
  return validateResult(parseObject(text), "openai_gpt4o");
}

// ── xAI Grok-2 Vision ────────────────────────────────────────────────────────
async function callXAI(imageUrl, apiKey) {
  const r = await fetchWithTimeout("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "grok-2-vision-latest",
      messages: [{ role: "user", content: [
        { type: "text", text: VISION_PROMPT },
        { type: "image_url", image_url: { url: imageUrl } },
      ]}],
      max_tokens: 700, temperature: 0.15,
    }),
  });
  if (!r.ok) throw new Error(`xAI ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await responseJson(r);
  const text = d.choices?.[0]?.message?.content || "";
  return validateResult(parseObject(text), "xai_grok2");
}

// ── Google Gemini 1.5 Flash Vision ───────────────────────────────────────────
async function callGemini(imageUrl, apiKey) {
  let b64;
  let mime = "image/jpeg";
  if (imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:([^;,]+);base64,(.+)$/s);
    if (!match) throw new Error("Invalid image data URL");
    mime = match[1];
    b64 = match[2];
  } else {
    const imgRes = await fetchWithTimeout(imageUrl, {}, 10_000);
    if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
    const imgBuf = await imgRes.arrayBuffer();
    b64 = Buffer.from(imgBuf).toString("base64");
    mime = (imgRes.headers.get("content-type") || "image/jpeg").split(";")[0];
  }

  const r = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: VISION_PROMPT },
          { inline_data: { mime_type: mime, data: b64 } },
        ]}],
        generationConfig: { temperature: 0.15, maxOutputTokens: 700 },
      }),
    },
  );
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d    = await responseJson(r);
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return validateResult(parseObject(text), "gemini_flash");
}

// ── Self-Dependent Heuristic Fallback ─────────────────────────────────────────
// Analyzes image filename/URL patterns and applies rule-based product data
// estimation. Works entirely without any external API keys.
function selfDependentAnalysis(imageUrl, product_type = "physical") {
  const url    = (imageUrl || "").toLowerCase();
  const fname  = url.split("/").pop().split("?")[0].replace(/[-_]/g, " ");

  // Category detection from filename/URL keywords
  const CATEGORY_RULES = [
    { cat: "phones_&_tablets",   words: ["phone","iphone","samsung","xiaomi","tecno","infinix","tablet","ipad","android","smartphone"] },
    { cat: "fashion",            words: ["shirt","dress","shoe","sneaker","boot","jean","trouser","blouse","jacket","bag","handbag","sandal","cap","hat","cloth","wear","fashion","skirt","gown","nike","adidas","puma"] },
    { cat: "electronics",        words: ["laptop","computer","tv","television","speaker","earphone","headphone","printer","camera","monitor","keyboard","mouse","usb","charger","powerbank","router","modem"] },
    { cat: "beauty_&_health",    words: ["cream","lotion","perfume","serum","makeup","lipstick","skincare","hair","shampoo","gel","soap","deodorant","cologne"] },
    { cat: "food_&_groceries",   words: ["food","rice","beans","palm","oil","tomato","spice","flour","sugar","drink","juice","water","milk","egg"] },
    { cat: "home_&_living",      words: ["chair","table","sofa","bed","mattress","curtain","rug","lamp","vase","mirror","shelf","fan","cooker","blender","pot","plate","cup"] },
    { cat: "solar_energy",       words: ["solar","panel","inverter","battery","generator","watt","volt","energy"] },
    { cat: "baby_&_kids",        words: ["baby","kid","child","diaper","toy","stroller","feeding","pampers"] },
    { cat: "sports",             words: ["sport","gym","fitness","bicycle","bike","ball","jersey","track","dumbbell","yoga"] },
    { cat: "books_&_education",  words: ["book","textbook","novel","education","study","notebook","pen","pencil"] },
    { cat: "agriculture",        words: ["farm","seed","fertilizer","pesticide","crop","livestock","poultry"] },
  ];

  let category = "home_&_living";
  for (const rule of CATEGORY_RULES) {
    if (rule.words.some(w => fname.includes(w) || url.includes(w))) {
      category = rule.cat;
      break;
    }
  }

  // Weight estimation from category
  const WEIGHT_MAP = {
    "phones_&_tablets":   0.2,
    "fashion":            0.4,
    "electronics":        1.5,
    "beauty_&_health":    0.25,
    "food_&_groceries":   1.0,
    "home_&_living":      2.0,
    "solar_energy":       3.5,
    "baby_&_kids":        0.5,
    "sports":             1.0,
    "books_&_education":  0.4,
    "agriculture":        2.0,
  };

  const weight_kg = WEIGHT_MAP[category] || 0.5;

  // Generate a basic name from filename words (title-case, remove extensions)
  const words = fname.replace(/\.[a-z0-9]+$/, "").trim().split(/\s+/).filter(w => w.length > 2);
  const productName = words.length > 1
    ? words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ").slice(0, 60)
    : `Quality ${category.replace(/_&_/g, " & ").split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} Product`;

  // Category-specific tags
  const TAG_MAP = {
    "phones_&_tablets":  ["smartphone", "mobile phone", "android", "buy phone Nigeria", "best price"],
    "fashion":           ["fashion", "clothing", "style", "buy clothes Nigeria", "latest fashion"],
    "electronics":       ["electronics", "gadget", "technology", "buy online Nigeria", "quality electronics"],
    "beauty_&_health":   ["beauty", "skincare", "health", "body care", "cosmetics Nigeria"],
    "food_&_groceries":  ["food", "groceries", "fresh", "organic", "buy food online"],
    "home_&_living":     ["home decor", "furniture", "household", "interior", "Nigeria"],
    "solar_energy":      ["solar", "renewable energy", "power backup", "generator alternative", "clean energy"],
    "baby_&_kids":       ["baby products", "kids", "children", "parenting", "newborn"],
    "sports":            ["fitness", "sports equipment", "gym", "workout", "exercise"],
    "books_&_education": ["education", "books", "learning", "school supplies", "study"],
    "agriculture":       ["farming", "agriculture", "crop", "livestock", "farm supplies"],
  };

  const catLabel = category.replace(/_&_/g, " & ").split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  return {
    name:       productName,
    description: `Premium quality ${catLabel.toLowerCase()} product available on DUNAZOE. Fast delivery across Nigeria with escrow-protected payment. Buy with confidence — 30-day buyer guarantee included.`,
    category,
    weight_kg,
    dimensions: null,
    material:   null,
    brand:      null,
    colors:     [],
    sizes:      [],
    features:   [],
    tags:       TAG_MAP[category] || ["quality product", "buy online Nigeria", "fast delivery"],
    confidence: 0.45,
    source:     "self_dependent_heuristic",
    note:       "Auto-generated without API key. Review and edit fields for best results. Add OPENAI_API_KEY, XAI_API_KEY, or GEMINI_API_KEY in the Deployment AI for smarter analysis.",
  };
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req) {
  try {
    const auth = authorizeAndRateLimit(req);
    if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const { image_url, product_type = "physical" } = await req.json();
    if (!validImageInput(image_url)) {
      return NextResponse.json({ success: false, error: "A valid public image URL or image data is required." }, { status: 400 });
    }

    const errors = [];

    // 1 — OpenAI GPT-4o
    if (process.env.OPENAI_API_KEY) {
      try {
        const result = await callOpenAI(image_url, process.env.OPENAI_API_KEY);
        return NextResponse.json({ success: true, ...result });
      } catch (e) { errors.push(`OpenAI: ${e.message}`); }
    }

    // 2 — xAI Grok Vision
    if (process.env.XAI_API_KEY) {
      try {
        const result = await callXAI(image_url, process.env.XAI_API_KEY);
        return NextResponse.json({ success: true, ...result });
      } catch (e) { errors.push(`xAI: ${e.message}`); }
    }

    // 3 — Google Gemini Flash
    if (process.env.GEMINI_API_KEY) {
      try {
        const result = await callGemini(image_url, process.env.GEMINI_API_KEY);
        return NextResponse.json({ success: true, ...result });
      } catch (e) { errors.push(`Gemini: ${e.message}`); }
    }

    // 4 — Self-dependent heuristic fallback (always works, no API key needed)
    const heuristic = selfDependentAnalysis(image_url, product_type);
    return NextResponse.json({
      success: true,
      ...heuristic,
      errors: errors.length ? errors : undefined,
    });

  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
