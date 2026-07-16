import "./globals.css";
import ChatWidget from "../components/ChatWidget";
import UpdateNotifier from "../components/UpdateNotifier";

export const metadata = {
  title: "DUNAZOE — Buy Anything · Sell Everything · Ship Worldwide",
  description: "Nigeria's AI-powered super e-commerce + fintech platform. Shop, sell, save with Ajo, and ship worldwide.",
  keywords: "ecommerce, Nigeria, marketplace, fintech, ajo, savings, shipping",
  authors: [{ name: "DUNAZOE" }],
  creator: "DUNAZOE",
  appleWebApp: {
    capable: true,
    title: "DUNAZOE",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "DUNAZOE — Buy Anything · Sell Everything · Ship Worldwide",
    description: "Nigeria's AI-powered super marketplace with built-in Ajo savings, escrow protection, and intelligent shipping.",
    type: "website",
    locale: "en_NG",
  },
};

export const viewport = {
  themeColor: "#0066FF",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#0066FF" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DUNAZOE" />
        <meta name="msapplication-TileColor" content="#0066FF" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="HandheldFriendly" content="true" />
      </head>
      <body>
        {children}
        {/* Auto-update banner — appears when a new version is detected */}
        <UpdateNotifier />
        {/* Global floating chat widget — only visible when logged in */}
        <ChatWidget />
      </body>
    </html>
  );
}
