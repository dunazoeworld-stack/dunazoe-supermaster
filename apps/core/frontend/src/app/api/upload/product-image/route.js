/**
 * Product Image Upload — direct to Cloudinary with signed request.
 * Replaces the old proxy to upload-service (port 4020).
 * Validates MIME, signs with SHA-1, retries up to 3× on 5xx.
 */
import { NextResponse } from "next/server";
import crypto from "crypto";

// .trim() prevents trailing newline/whitespace from Replit secrets causing "Invalid Signature"
const CLOUD_NAME = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
const API_KEY    = (process.env.CLOUDINARY_API_KEY    || "").trim();
const API_SECRET = (process.env.CLOUDINARY_API_SECRET || "").trim();
const FOLDER     = "dunazoe_products";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Retry a fetch up to maxAttempts; exponential backoff on 5xx / network error. */
async function fetchWithRetry(url, options, maxAttempts = 3) {
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 35_000);
      const resp = await fetch(url, { ...options, signal: ctrl.signal });
      clearTimeout(timer);
      if (resp.ok || resp.status < 500) return resp;
      lastErr = new Error(`Cloudinary responded with HTTP ${resp.status}`);
    } catch (err) {
      lastErr = err;
    }
    if (i < maxAttempts - 1) {
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  throw lastErr;
}

export async function POST(request) {
  // ── Guard: credentials ──────────────────────────────────────────────────────
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    console.error("[Upload] Missing Cloudinary credentials");
    return NextResponse.json(
      { success: false, error: "Image upload service not configured — contact support." },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("image");
    if (!file || typeof file === "string") {
      return NextResponse.json({ success: false, error: "No image provided." }, { status: 400 });
    }

    // ── MIME validation ────────────────────────────────────────────────────────
    const mime = file.type?.toLowerCase() || "";
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { success: false, error: `Unsupported file type: ${mime || "unknown"}. Use JPEG, PNG, or WebP.` },
        { status: 400 }
      );
    }

    // ── Magic-byte check (JPEG / PNG) ──────────────────────────────────────────
    const bytes = await file.arrayBuffer();
    const header = new Uint8Array(bytes.slice(0, 4));
    const isJpeg = header[0] === 0xFF && header[1] === 0xD8;
    const isPng  = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;
    const isWebp = new TextDecoder().decode(header) === "RIFF";
    if (!isJpeg && !isPng && !isWebp && !mime.includes("gif")) {
      return NextResponse.json(
        { success: false, error: "File header does not match a valid image." },
        { status: 400 }
      );
    }

    // ── Cloudinary signed upload ───────────────────────────────────────────────
    const timestamp = Math.round(Date.now() / 1000);
    // Params must be sorted alphabetically (Cloudinary requirement)
    const paramsToSign = `folder=${FOLDER}&timestamp=${timestamp}`;
    const signature = crypto
      .createHash("sha1")
      .update(paramsToSign + API_SECRET)
      .digest("hex");

    const uploadForm = new FormData();
    uploadForm.append("file", new Blob([bytes], { type: mime }), file.name || "upload");
    uploadForm.append("api_key",   API_KEY);
    uploadForm.append("timestamp", String(timestamp));
    uploadForm.append("folder",    FOLDER);
    uploadForm.append("signature", signature);

    const resp = await fetchWithRetry(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: "POST", body: uploadForm }
    );

    const data = await resp.json();

    if (data.secure_url) {
      return NextResponse.json({
        success:   true,
        url:       data.secure_url,
        public_id: data.public_id,
        format:    data.format,
        bytes:     data.bytes,
        width:     data.width,
        height:    data.height,
      });
    }

    const errMsg = data.error?.message || "Cloudinary upload failed.";
    console.error("[Upload] Cloudinary error:", errMsg);
    return NextResponse.json({ success: false, error: errMsg }, { status: 400 });

  } catch (err) {
    console.error("[Upload] Fatal error:", err.message);
    return NextResponse.json(
      { success: false, error: `Upload failed: ${err.message}` },
      { status: 500 }
    );
  }
}
