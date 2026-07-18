/**
 * Digital Product File Upload — Cloudinary SDK v2 (raw resource type).
 * Accepts any file type (PDF, ZIP, MP4, etc.) up to 100 MB.
 * Credentials read inside handler for same reason as product-image route.
 */
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

const ALLOWED_EXT = new Set([
  "pdf","zip","rar","7z","tar","gz",
  "mp4","mov","avi","mkv","webm",
  "mp3","wav","aac","flac",
  "psd","ai","sketch","fig","xd",
  "docx","xlsx","pptx","txt","csv",
  "epub","mobi","azw",
  "exe","apk","dmg","pkg","msi",
  "js","ts","py","java","html","css","json",
  "png","jpg","jpeg","webp","svg","gif",
]);

export async function POST(request) {
  const CLOUD_NAME = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const API_KEY    = (process.env.CLOUDINARY_API_KEY    || "").trim();
  const API_SECRET = (process.env.CLOUDINARY_API_SECRET || "").trim();

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return NextResponse.json(
      { success: false, error: "File upload service not configured — contact support." },
      { status: 503 }
    );
  }

  cloudinary.config({ cloud_name: CLOUD_NAME, api_key: API_KEY, api_secret: API_SECRET, secure: true });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ success: false, error: "No file provided." }, { status: 400 });
    }

    // Size check
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: `File too large (max 100 MB). Your file: ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB` },
        { status: 400 }
      );
    }

    // Extension check
    const ext = (file.name || "").split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json(
        { success: false, error: `File type .${ext} is not supported.` },
        { status: 400 }
      );
    }

    // Upload as raw resource (preserves original file)
    const base64  = Buffer.from(bytes).toString("base64");
    const mime    = file.type || "application/octet-stream";
    const dataUri = `data:${mime};base64,${base64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder:          "dunazoe_digital_products",
      resource_type:   "raw",
      public_id:       `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
      unique_filename: false,
      overwrite:       false,
    });

    if (result?.secure_url) {
      console.log(`[DigitalUpload] ✅ OK: ${result.public_id}`);
      return NextResponse.json({
        success:   true,
        url:       result.secure_url,
        public_id: result.public_id,
        bytes:     result.bytes,
        format:    result.format || ext,
        filename:  file.name,
      });
    }

    throw new Error("Cloudinary returned no secure_url");

  } catch (err) {
    const msg = err?.message || "Unknown error";
    console.error("[DigitalUpload] Fatal:", msg);
    return NextResponse.json({ success: false, error: `File upload failed: ${msg}` }, { status: 500 });
  }
}
