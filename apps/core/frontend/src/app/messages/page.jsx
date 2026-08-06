"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const PLACEHOLDER_CONVOS = [
  { id: "sys", name: "DUNAZOE Support", avatar: "🛡️", lastMsg: "Welcome to DUNAZOE! How can we help?", time: "Just now", unread: 1, isSupport: true },
];

export default function MessagesPage() {
  const [user,     setUser]     = useState(null);
  const [selected, setSelected] = useState(null);
  const [convos,   setConvos]   = useState(PLACEHOLDER_CONVOS);
  const [input,    setInput]    = useState("");
  const [msgs,     setMsgs]     = useState({
    sys: [
      { id: 1, from: "support", text: "Welcome to DUNAZOE! 👋 How can we help you today?", time: new Date().toISOString() },
    ],
  });
  const bottomRef = useRef(null);

  useEffect(() => {
    try { setUser(JSON.parse(localStorage.getItem("dunazoe_user") || "{}")); } catch (_) {}
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected, msgs]);

  function send() {
    if (!input.trim() || !selected) return;
    const text = input.trim();
    setInput("");
    setMsgs(prev => ({
      ...prev,
      [selected]: [
        ...(prev[selected] || []),
        { id: Date.now(), from: "me", text, time: new Date().toISOString() },
      ],
    }));
    // Auto-reply from support after 1.2s
    if (selected === "sys") {
      setTimeout(() => {
        setMsgs(prev => ({
          ...prev,
          sys: [
            ...(prev.sys || []),
            { id: Date.now() + 1, from: "support", text: "Thanks for reaching out! Our team will respond shortly. For urgent issues please email support@dunazoe.com 📧", time: new Date().toISOString() },
          ],
        }));
      }, 1200);
    }
  }

  function fmtTime(iso) {
    try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch (_) { return ""; }
  }

  const convo = convos.find(c => c.id === selected);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--border)", padding: "20px 0" }}>
        <div className="container">
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>💬 Messages</h1>
        </div>
      </div>

      <div className="container" style={{ flex: 1, display: "flex", gap: "0", overflow: "hidden", maxHeight: "calc(100vh - 100px)" }}>
        {/* Conversation list */}
        <div style={{
          width: selected ? "280px" : "100%", flexShrink: 0,
          borderRight: selected ? "1px solid var(--border)" : "none",
          overflowY: "auto", paddingTop: "16px",
        }} className="msg-sidebar">
          {convos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>💬</div>
              <p style={{ fontWeight: 600 }}>No messages yet</p>
              <p style={{ fontSize: "0.84rem", marginTop: "6px" }}>Message a vendor from any product page, or contact support below.</p>
              <Link href="/support" style={{ display: "inline-block", marginTop: "16px", padding: "8px 20px", borderRadius: "10px", background: "var(--dz-blue)", color: "#fff", textDecoration: "none", fontWeight: 600, fontSize: "0.88rem" }}>
                Contact Support
              </Link>
            </div>
          ) : (
            convos.map(c => (
              <div key={c.id} onClick={() => { setSelected(c.id); setConvos(prev => prev.map(x => x.id === c.id ? { ...x, unread: 0 } : x)); }}
                style={{
                  display: "flex", gap: "12px", padding: "14px 16px", borderRadius: "12px", cursor: "pointer",
                  background: selected === c.id ? "rgba(0,163,255,0.08)" : "transparent",
                  border: selected === c.id ? "1px solid rgba(0,163,255,0.18)" : "1px solid transparent",
                  marginBottom: "4px", transition: "all 0.15s",
                }}
              >
                <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>
                  {c.avatar}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: c.unread ? 700 : 600, fontSize: "0.9rem" }}>{c.name}</span>
                    {c.unread > 0 && (
                      <span style={{ background: "var(--dz-blue)", color: "#fff", borderRadius: "20px", padding: "1px 7px", fontSize: "0.72rem", fontWeight: 700 }}>{c.unread}</span>
                    )}
                  </div>
                  <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.lastMsg}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Chat window */}
        {selected && convo ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Chat header */}
            <div style={{ borderBottom: "1px solid var(--border)", padding: "14px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: "1.1rem", padding: "4px" }}>←</button>
              <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>
                {convo.avatar}
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem" }}>{convo.name}</p>
                {convo.isSupport && <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--dz-blue)" }}>● Online</p>}
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {(msgs[selected] || []).map(m => (
                <div key={m.id} style={{ display: "flex", flexDirection: m.from === "me" ? "row-reverse" : "row", gap: "8px", alignItems: "flex-end" }}>
                  {m.from !== "me" && (
                    <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", flexShrink: 0 }}>
                      {convo.avatar}
                    </div>
                  )}
                  <div style={{
                    maxWidth: "68%", padding: "10px 14px", borderRadius: m.from === "me" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: m.from === "me" ? "var(--dz-blue)" : "var(--surface)",
                    color: m.from === "me" ? "#fff" : "var(--text)", fontSize: "0.88rem", lineHeight: 1.5,
                  }}>
                    {m.text}
                    <div style={{ fontSize: "0.7rem", opacity: 0.65, marginTop: "4px", textAlign: "right" }}>{fmtTime(m.time)}</div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ borderTop: "1px solid var(--border)", padding: "12px 20px", display: "flex", gap: "10px" }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
                placeholder="Type a message…"
                style={{ flex: 1, padding: "10px 14px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "0.9rem", outline: "none" }}
              />
              <button onClick={send} disabled={!input.trim()} style={{
                padding: "10px 18px", borderRadius: "12px", background: input.trim() ? "var(--dz-blue)" : "var(--surface)", color: input.trim() ? "#fff" : "var(--text-muted)",
                border: "none", cursor: input.trim() ? "pointer" : "default", fontWeight: 700, fontSize: "0.9rem", transition: "all 0.15s",
              }}>
                Send
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .msg-sidebar { width: 100% !important; border-right: none !important; }
        }
      `}</style>
    </div>
  );
}
