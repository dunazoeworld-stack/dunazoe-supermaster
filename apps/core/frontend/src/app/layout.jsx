import "./globals.css";

export const metadata = {
  title: "DUNAZOE — Buy Anything · Sell Everything · Ship Worldwide",
  description: "Nigeria's AI-powered super e-commerce + fintech platform. Shop, sell, save with Ajo, and ship worldwide.",
  keywords: "ecommerce, Nigeria, marketplace, fintech, ajo, savings, shipping",
  authors: [{ name: "DUNAZOE" }],
  creator: "DUNAZOE",
  themeColor: "#0066FF",
  colorScheme: "dark",
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
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
        <link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192" />
        <link rel="icon" href="/assets/dunazoe-logo.jpg" type="image/jpeg" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="HandheldFriendly" content="true" />
      </head>
      <body>{children}</body>
    </html>
  );
}
