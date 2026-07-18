/**
 * Digital File Upload — Cloudinary REST API (raw resource type).
 * Supports PDF, ZIP, MP4, PSD, EPUB, APK and 30+ formats up to 100 MB.
 * Uses Node.js built-in crypto for SHA-1 signing — no SDK dependency.
 */
import { NextResponse } from "next/server";
import crypto from "crypto";

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

const ALLOWED_EXTENSIONS = new Set([
  "pdf","zip","rar","7z","tar","gz",
  "mp4","mov","avi","mkv","webm",
  "mp3","wav","flac","aac",
  "psd","ai","eps","svg","fig",
  "doc","docx","xls","xlsx","ppt","pptx","odt","ods",
  "epub","mobi","djvu",
  "apk","ipa",
  "py","js","ts","jsx","tsx","json","csv","xml",
  "ttf","otf","woff","woff2",
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
        { success: false, error: `File too large. Maximum size is 100 MB.` },
        { status: 413 }
      );
    }

    // Extension whitelist
    const name      = file.name || "";
    const ext       = name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { success: false, error: `File type '.${ext}' not supported.` },
        { status: 400 }
      );
    }

    // Sign upload — resource_type is in the URL path, NOT a form param, so exclude from sig
    const timestamp = Math.round(Date.now() / 1000).toString();
    const folder    = "dunazoe_digital_products";
    const signParams = { folder, timestamp };
    const paramsToSign = Object.keys(signParams)
      .sort()
      .map(k => `${k}=${signParams[k]}`)
      .join("&");
    const signature = crypto
      .createHash("sha1")
      .update(paramsToSign + API_SECRET)
      .digest("hex");

    const uploadForm = new FormData();
    uploadForm.append("file",      new Blob([bytes]), name);
    uploadForm.append("api_key",   API_KEY);
    uploadForm.append("timestamp", timestamp);
    uploadForm.append("signature", signature);
    uploadForm.append("folder",    folder);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`;
    const response  = await fetch(uploadUrl, { method: "POST", body: uploadForm });
    const result    = await response.json();

    if (!response.ok || result.error) {
      const msg = result.error?.message || `Cloudinary ${response.status}`;
      return NextResponse.json({ success: false, error: `Upload failed: ${msg}` }, { status: 502 });
    }

    console.log(`[DigitalUpload] ✅ ${result.public_id}`);
    return NextResponse.json({
      success:   true,
      url:       result.secure_url,
      public_id: result.public_id,
      bytes:     result.bytes,
      format:    result.format,
      filename:  name,
    });

  } catch (err) {
    console.error("[DigitalUpload] Fatal:", err?.message);
    return NextResponse.json({ success: false, error: `Upload failed: ${err?.message}` }, { status: 500 });
  }
}
