/**
 * Deploy section layout — overrides the PWA manifest with the
 * Deployment AI / Superuser distinct manifest so "Add to Home Screen"
 * installs the rocket icon instead of the main DUNAZOE shopping icon.
 *
 * NOTE: In Next.js 14 App Router, never render <head> directly in a layout —
 * use the metadata / viewport exports instead.
 */

export const metadata = {
  manifest: "/manifest-deploy.json",
  title: {
    default: "DUNAZOE Superuser",
    template: "%s · DUNAZOE Control",
  },
  description: "DUNAZOE Deployment AI & Superuser Control Panel — remote control for the 34-service platform.",
  appleWebApp: {
    title: "DZ Control",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  themeColor: "#FF6B00",
};

export default function DeployLayout({ children }) {
  return children;
}
