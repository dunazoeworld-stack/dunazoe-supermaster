/**
 * DUNAZOE — Deployment AI Download API
 * Serves the standalone deployment AI app as a ZIP.
 * Falls back to redirecting to GitHub releases if file not found.
 */
import { NextResponse } from "next/server";
import path from "path";

const GITHUB_RELEASES = {
  "deployment-ai-v2.zip": "https://github.com/dunazoe/dunazoe-os/releases/download/v2.0.0/deployment-ai-v2.zip",
  "deployment-ai-v1.5.zip": "https://github.com/dunazoe/dunazoe-os/releases/download/v1.5.0/deployment-ai-v1.5.zip",
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const filename = path.basename(request.url.split("/").pop() || "");

  const githubUrl = GITHUB_RELEASES[filename];
  if (githubUrl) {
    return NextResponse.redirect(githubUrl, 302);
  }

  // Default: redirect to latest release
  return NextResponse.redirect(
    "https://github.com/dunazoe/dunazoe-os/releases",
    302
  );
}
