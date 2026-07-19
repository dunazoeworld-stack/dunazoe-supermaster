/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  // Allow Replit's proxied preview origins so the browser console stays clean
  allowedDevOrigins: [
    "*.replit.dev",
    "*.repl.co",
    "*.replit.app",
    "*.picard.replit.dev",
    "*.janeway.replit.dev",
    "127.0.0.1",
  ],
  // Webpack-mode build: cache compiled pages to disk so cold-start is fast
  // and subsequent page loads come from the filesystem cache.
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,   // keep pages in memory for 60 s
    pagesBufferLength: 3,         // keep max 3 compiled pages in memory at once
  },
  // Trim bundle size in dev: disable source-maps for dependencies
  productionBrowserSourceMaps: false,
};
module.exports = nextConfig;
