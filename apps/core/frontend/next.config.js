/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  // Allow Replit's proxied preview origins so the browser console stays clean
  allowedDevOrigins: [
    "*.replit.dev",
    "*.repl.co",
    "*.replit.app",
    "*.picard.replit.dev",
    "*.janeway.replit.dev",
  ],
  // Silence the workspace-root warning from Turbopack (multiple lockfiles)
  turbopack: {
    root: __dirname,
  },
};
module.exports = nextConfig;
