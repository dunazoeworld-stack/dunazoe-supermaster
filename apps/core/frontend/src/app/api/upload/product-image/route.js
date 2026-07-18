/**
 * Product Image Upload — uses Cloudinary Node.js SDK (v2) for server-side upload.
 * SDK handles all signing internally — eliminates manual SHA1 signature bugs.
 * Validates MIME type + magic bytes before upload.
 */
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

// .trim() prevents trailing newline/whitespace from env secrets causing auth failures
const CLOUD_NAME  = (process.env.CLOUDINARY_CLOUD_NAME  || "").trim();
const API_KEY     = (process.env.CLOUDINARY_API_KEY     || "").trim();
const API_SECRET  = (process.env.CLOUDINARY_API_SECRET  || "").trim();
const FOLDER      = "dunazoe_products";

// Configure once per cold start
if (CLOUD_NAME && API_KEY && API_SECRET) {
  cloudinary.config({ cloud_name: CLOUD_NAME, api_key: API_KEY, api_secret: API_SECRET, secure: true });
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Upload buffer to Cloudinary using SDK upload_stream (handles signing automatically). */
async function uploadBuffer(buffer, mimeType) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: FOLDER,
        resource_type: "image",
        transformation: [
          { width: 1200, height: 1200, crop: "limit" },
          { quality: "auto:good" },
          { fetch_format: "auto" },
        ],
        unique_filename: true,
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
    // Write buffer directly to the upload stream
    const { Readable } = require("stream");
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(stream);
  });
}

export async function POST(request) {
  // ── Guard: credentials ──────────────────────────────────────────────────────
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    console.error("[Upload] Missing Cloudinary credentials — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET");
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
    const mime = (file.type || "").toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { success: false, error: `Unsupported file type: ${mime || "unknown"}. Use JPEG, PNG, or WebP.` },
        { status: 400 }
      );
    }

    // ── Magic-byte check ───────────────────────────────────────────────────────
    const bytes = await file.arrayBuffer();
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

    // ── Upload via SDK (no manual signing needed) ──────────────────────────────
    const result = await uploadBuffer(Buffer.from(bytes), mime);

    if (result?.secure_url) {
      console.log(`[Upload] ✅ Cloudinary upload OK: ${result.public_id}`);
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

    throw new Error("Cloudinary returned no URL");

  } catch (err) {
    console.error("[Upload] Error:", err.message || err);
    const msg = err.message?.includes("Must supply api_key")
      ? "Upload credentials invalid — check CLOUDINARY_API_KEY."
      : err.message?.includes("Unknown API key")
      ? "Unknown Cloudinary API key — verify CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY."
      : `Upload failed: ${err.message || "Unknown error"}`;
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
