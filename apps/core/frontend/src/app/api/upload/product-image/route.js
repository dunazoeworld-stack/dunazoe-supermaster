/**
 * Next.js App Router API — proxy for product image upload
 * Forwards multipart/form-data to upload-service (port 4020)
 * so the frontend never needs to hardcode the microservice URL.
 */
import { NextResponse } from "next/server";

const UPLOAD_SERVICE = process.env.UPLOAD_SERVICE_URL || "http://localhost:4020";

export async function POST(request) {
  try {
    const token = request.headers.get("Authorization") || "";
    const formData = await request.formData();

    // Forward directly to upload-service
    const resp = await fetch(`${UPLOAD_SERVICE}/upload/product-image`, {
      method: "POST",
      headers: {
        Authorization: token,
        // Do NOT set Content-Type — let fetch set multipart boundary
      },
      body: formData,
    });

    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (err) {
    console.error("[Upload proxy] error:", err.message);
    return NextResponse.json(
      { success: false, error: "Upload service unavailable" },
      { status: 503 }
    );
  }
}
