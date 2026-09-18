"use client";

import ChatWidget from "../../components/ChatWidget";

export default function MessagesPage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div className="container" style={{ paddingTop: "24px", paddingBottom: "24px" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "0 0 14px" }}>Messages</h1>
        <ChatWidget embedded />
      </div>
    </main>
  );
}
