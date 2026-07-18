/**
 * Product Image Upload — Cloudinary Node.js SDK v2.
 * CRITICAL: credentials read INSIDE the handler, not at module level.
 * Next.js populates process.env before handler runs but AFTER module eval,
 * so top-level const reads always return "". Reading inside the handler fixes this.
 * Uses uploader.upload() with base64 data-URI — no stream piping required.
 */
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request) {
  // ── Read credentials inside handler — env is fully resolved here ──────────
  const CLOUD_NAME = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const API_KEY    = (process.env.CLOUDINARY_API_KEY    || "").trim();
  const API_SECRET = (process.env.CLOUDINARY_API_SECRET || "").trim();

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    console.error(
      `[Upload] Missing creds — CLOUD_NAME:${!!CLOUD_NAME} API_KEY:${!!API_KEY} API_SECRET:${!!API_SECRET}`
    );
    return NextResponse.json(
      { success: false, error: "Image upload service not configured — contact support." },
      { status: 503 }
    );
  }

  // Configure SDK on every cold-start (idempotent)
  cloudinary.config({ cloud_name: CLOUD_NAME, api_key: API_KEY, api_secret: API_SECRET, secure: true });

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

    // ── Upload via SDK base64 data-URI (no require('stream') needed) ─────────
    const base64  = Buffer.from(bytes).toString("base64");
    const dataUri = `data:${mime};base64,${base64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder:          "dunazoe_products",
      resource_type:   "image",
      transformation:  [
        { width: 1200, height: 1200, crop: "limit" },
        { quality: "auto:good" },
        { fetch_format: "auto" },
      ],
      unique_filename: true,
    });

    if (result?.secure_url) {
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
