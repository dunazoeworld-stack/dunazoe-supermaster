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
      </head>
      <body className="dunazoe-body">{children}</body>
    </html>
  );
}
