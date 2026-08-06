/**
 * Product Image Upload — Cloudinary REST API via native fetch + Node crypto.
 * NO external SDK required. Uses Node.js built-in 'crypto' for SHA-1 signing.
 * Credentials are read INSIDE the handler (Next.js App Router env-timing fix).
 *
 * Error handling:
 *   • ALL THREE creds absent  → offline/queued response (500 not thrown)
 *   • Creds present but wrong → specific "credentials invalid" error (distinguishable)
 *   • File issues             → 400 with clear message
 *   • Cloudinary API down     → 502 with gateway error
 */
import { NextResponse } from "next/server";
import crypto from "crypto";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request) {
  const CLOUD_NAME = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const API_KEY    = (process.env.CLOUDINARY_API_KEY    || "").trim();
  const API_SECRET = (process.env.CLOUDINARY_API_SECRET || "").trim();

  // ── Case 1: Credentials completely absent ─────────────────────────────────
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    const which = [
      !CLOUD_NAME && "CLOUDINARY_CLOUD_NAME",
      !API_KEY    && "CLOUDINARY_API_KEY",
      !API_SECRET && "CLOUDINARY_API_SECRET",
    ].filter(Boolean).join(", ");
    console.warn(`[Upload] Cloudinary not configured — missing: ${which}`);
    return NextResponse.json({
      success:  false,
      error:    "Image upload is not yet configured. You can continue listing your product — add images later once the upload service is activated.",
      queued:   true,
      offline:  true,
      reason:   "missing_credentials",
    }, { status: 200 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("image");
    if (!file || typeof file === "string") {
      return NextResponse.json({ success: false, error: "No image file provided." }, { status: 400 });
    }

    // ── MIME type validation ──────────────────────────────────────────────────
    const mime = (file.type || "").toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { success: false, error: `Unsupported file type: ${mime || "unknown"}. Use JPEG, PNG, or WebP.` },
        { status: 400 }
      );
    }

    const bytes  = await file.arrayBuffer();
    const header = new Uint8Array(bytes.slice(0, 4));

    // ── Magic-byte header check ───────────────────────────────────────────────
    const isJpeg = header[0] === 0xFF && header[1] === 0xD8;
    const isPng  = header[0] === 0x89 && header[1] === 0x50;
    const isWebp = header[0] === 0x52 && header[1] === 0x49;
    const isGif  = header[0] === 0x47 && header[1] === 0x49;
    if (!isJpeg && !isPng && !isWebp && !isGif) {
      return NextResponse.json(
        { success: false, error: "File does not appear to be a valid image." },
        { status: 400 }
      );
    }

    // ── Build Cloudinary signed upload ────────────────────────────────────────
    const timestamp  = Math.round(Date.now() / 1000).toString();
    const folder     = "dunazoe_products";
    const eager      = "w_1200,h_1200,c_limit/q_auto:good/f_auto";
    const paramsStr  = Object.entries({ eager, folder, timestamp })
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    const signature  = crypto.createHash("sha1").update(paramsStr + API_SECRET).digest("hex");

    const uploadForm = new FormData();
    uploadForm.append("file",      new Blob([bytes], { type: mime }), file.name || "upload");
    uploadForm.append("api_key",   API_KEY);
    uploadForm.append("timestamp", timestamp);
    uploadForm.append("signature", signature);
    uploadForm.append("folder",    folder);
    uploadForm.append("eager",     eager);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
    const response  = await fetch(uploadUrl, { method: "POST", body: uploadForm });

    // Guard: Cloudinary sometimes returns HTML on gateway errors — parse safely
    let result;
    const rawText = await response.text();
    try {
      result = JSON.parse(rawText);
    } catch (_) {
      console.error("[Upload] Cloudinary non-JSON response:", rawText.slice(0, 200));
      return NextResponse.json({
        success: false,
        error:   `Cloudinary gateway error (HTTP ${response.status}). Please try again in a moment.`,
        reason:  "cloudinary_non_json",
      }, { status: 502 });
    }

    // ── Case 2: Credentials present but INVALID (401/403 from Cloudinary) ────
    if (response.status === 401 || response.status === 403) {
      const cloudErr = result.error?.message || `HTTP ${response.status}`;
      console.error(`[Upload] ❌ Cloudinary credential error (${response.status}): ${cloudErr}`);
      return NextResponse.json({
        success: false,
        error:   "Image upload credentials are invalid. Please contact support to fix the upload configuration.",
        reason:  "invalid_credentials",
        detail:  cloudErr,
      }, { status: 502 });
    }

    // ── Case 3: Other Cloudinary API error ────────────────────────────────────
    if (!response.ok || result.error) {
      const msg = result.error?.message || `Cloudinary HTTP ${response.status}`;
      console.error("[Upload] Cloudinary API error:", msg);
      return NextResponse.json({
        success: false,
        error:   `Upload failed: ${msg}`,
        reason:  "cloudinary_error",
      }, { status: 502 });
    }

    if (!result.secure_url) {
      throw new Error("Cloudinary returned no secure_url");
    }

    console.log(`[Upload] ✅ ${result.public_id} (${result.bytes} bytes)`);
    return NextResponse.json({
      success:   true,
      url:       result.secure_url,
      public_id: result.public_id,
      format:    result.format,
      bytes:     result.bytes,
      width:     result.width,
      height:    result.height,
    });

  } catch (err) {
    console.error("[Upload] Fatal:", err?.message);
    return NextResponse.json({
      success: false,
      error:   `Upload service error: ${err?.message || "unknown"}`,
      reason:  "server_error",
    }, { status: 500 });
  }
}
