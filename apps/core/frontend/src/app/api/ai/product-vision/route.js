import { NextResponse } from "next/server";

// ──────────────────────────────────────────────────────────────────────────────
// DUNAZOE — Product Vision AI  (server-side)
// Supports: OpenAI GPT-4o · xAI Grok Vision · Google Gemini 1.5 Flash
// Auto-detects which key is configured and tries in order.
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
  // Fetch image bytes and send as base64 inline_data
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

    // No key configured — or all failed
    return NextResponse.json({
      success: false,
      needs_api_key: !errors.length,
      errors,
      message: errors.length
        ? `Vision AI attempted but failed: ${errors.join(" | ")}`
        : "No AI vision key configured. Add OPENAI_API_KEY, XAI_API_KEY, or GEMINI_API_KEY to enable auto-fill.",
    });

  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
