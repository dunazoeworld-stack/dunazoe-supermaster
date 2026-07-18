/**
 * Product Image Upload — Cloudinary REST API via native fetch + Node crypto.
 * NO external SDK required. Uses Node.js built-in 'crypto' for SHA-1 signing.
 * Credentials read inside handler (Next.js App Router env-timing fix).
 */
import { NextResponse } from "next/server";
import crypto from "crypto";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request) {
  // ── Credentials — read INSIDE handler (env is fully resolved here) ─────────
  const CLOUD_NAME = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const API_KEY    = (process.env.CLOUDINARY_API_KEY    || "").trim();
  const API_SECRET = (process.env.CLOUDINARY_API_SECRET || "").trim();

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    console.error(
      `[Upload] Missing creds — CLOUD_NAME:${!!CLOUD_NAME} KEY:${!!API_KEY} SECRET:${!!API_SECRET}`
    );
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

    // ── MIME validation ──────────────────────────────────────────────────────
    const mime = (file.type || "").toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { success: false, error: `Unsupported type: ${mime || "unknown"}. Use JPEG, PNG, or WebP.` },
        { status: 400 }
      );
    }

    // ── Magic-byte check ─────────────────────────────────────────────────────
    const bytes  = await file.arrayBuffer();
    const header = new Uint8Array(bytes.slice(0, 4));
    const isJpeg = header[0] === 0xFF && header[1] === 0xD8;
    const isPng  = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;
    const isWebp = header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46;
    const isGif  = mime.includes("gif");
    if (!isJpeg && !isPng && !isWebp && !isGif) {
      return NextResponse.json(
        { success: false, error: "File header does not match a valid image." },
        { status: 400 }
      );
    }

    // ── Build signed upload request ──────────────────────────────────────────
    const timestamp = Math.round(Date.now() / 1000).toString();
    const folder    = "dunazoe_products";

    // Params to sign — must be sorted alphabetically, exclude api_key/file/resource_type
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature    = crypto
      .createHash("sha1")
      .update(paramsToSign + API_SECRET)
      .digest("hex");

    // ── Build multipart form for Cloudinary REST API ─────────────────────────
    const uploadForm = new FormData();
    uploadForm.append("file",      new Blob([bytes], { type: mime }), file.name || "upload");
    uploadForm.append("api_key",   API_KEY);
    uploadForm.append("timestamp", timestamp);
    uploadForm.append("signature", signature);
    uploadForm.append("folder",    folder);
    uploadForm.append("eager",     "w_1200,h_1200,c_limit/q_auto:good/f_auto");

    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
    const response  = await fetch(uploadUrl, { method: "POST", body: uploadForm });
    const result    = await response.json();

    if (!response.ok || result.error) {
      const msg = result.error?.message || `Cloudinary ${response.status}`;
      console.error("[Upload] Cloudinary error:", msg);
      return NextResponse.json({ success: false, error: `Upload failed: ${msg}` }, { status: 502 });
    }

    if (result.secure_url) {
      console.log(`[Upload] ✅ Cloudinary OK: ${result.public_id}`);
      return NextResponse.json({
        success:   true,
        url:       result.secure_url,
        public_id: result.public_id,
        format:    result.format,
        bytes:     result.bytes,
        width:     result.width,
        height:    result.height,
      });
    }

    throw new Error("Cloudinary returned no secure_url");

  } catch (err) {
    const msg = err?.message || "Unknown error";
    console.error("[Upload] Fatal:", msg);
    return NextResponse.json({ success: false, error: `Upload failed: ${msg}` }, { status: 500 });
  }
}
