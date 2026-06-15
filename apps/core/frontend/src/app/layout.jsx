import "./globals.css";
export const metadata = {
  title: "DUNAZOE — Buy Anything · Sell Everything · Ship Worldwide",
  description: "Nigeria's AI-powered super e-commerce + fintech platform.",
  themeColor: "#0A0E1A",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/assets/dunazoe-logo.jpg" type="image/jpeg" />
        <meta name="theme-color" content="#0A0E1A" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DUNAZOE" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="dunazoe-body">{children}</body>
    </html>
  );
}
