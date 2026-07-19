import { NextResponse } from "next/server";

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
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
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
  const d = await r.json();
  const text = d.choices?.[0]?.message?.content || "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON in OpenAI response");
  return { ...JSON.parse(m[0]), source: "openai_gpt4o" };
}

// ── xAI Grok-2 Vision ────────────────────────────────────────────────────────
async function callXAI(imageUrl, apiKey) {
  const r = await fetch("https://api.x.ai/v1/chat/completions", {
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
  const d = await r.json();
  const text = d.choices?.[0]?.message?.content || "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON in xAI response");
  return { ...JSON.parse(m[0]), source: "xai_grok2" };
}

// ── Google Gemini 1.5 Flash Vision ───────────────────────────────────────────
async function callGemini(imageUrl, apiKey) {
  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) });
  if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
  const imgBuf = await imgRes.arrayBuffer();
  const b64    = Buffer.from(imgBuf).toString("base64");
  const mime   = (imgRes.headers.get("content-type") || "image/jpeg").split(";")[0];

  const r = await fetch(
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
  const d    = await r.json();
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const m    = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON in Gemini response");
  return { ...JSON.parse(m[0]), source: "gemini_flash" };
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
    tags:       TAG_MAP[category] || ["quality product", "buy online Nigeria", "fast delivery"],
    confidence: 0.45,
    source:     "self_dependent_heuristic",
    note:       "Auto-generated without API key. Review and edit fields for best results. Add OPENAI_API_KEY, XAI_API_KEY, or GEMINI_API_KEY in the Deployment AI for smarter analysis.",
  };
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req) {
  try {
    const { image_url, product_type = "physical" } = await req.json();
    if (!image_url) {
      return NextResponse.json({ success: false, error: "image_url required" }, { status: 400 });
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
