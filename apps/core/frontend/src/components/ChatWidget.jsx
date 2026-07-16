"use client";
/**
 * DUNAZOE Chat Widget — REST polling (no socket.io-client dependency)
 * Socket.IO upgrade available when socket.io-client is installed.
 */
import { useState, useEffect, useRef, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

function Bubble({ msg, myId }) {
  const isOwn = msg.sender_id === myId;
  const t = msg.created_at
    ? new Date(msg.created_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })
    : "";
  return (
    <div style={{ display: "flex", justifyContent: isOwn ? "flex-end" : "flex-start", marginBottom: "8px" }}>
      <div style={{
        maxWidth: "75%", padding: "9px 13px",
        borderRadius: isOwn ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        background: isOwn ? "var(--dz-gradient)" : "rgba(255,255,255,0.08)",
        color: "#fff", fontSize: "0.85rem", lineHeight: 1.5,
      }}>
        <p>{msg.message}</p>
        <p style={{ fontSize: "0.65rem", color: isOwn ? "rgba(255,255,255,0.6)" : "var(--text-muted)", marginTop: "3px", textAlign: "right" }}>{t}</p>
      </div>
    </div>
  );
}

export default function ChatWidget() {
  const [open,       setOpen]       = useState(false);
  const [user,       setUser]       = useState(null);
  const [token,      setToken]      = useState("");
  const [convos,     setConvos]     = useState([]);
  const [active,     setActive]     = useState(null);  // { receiver_id, name }
  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState("");
  const [unread,     setUnread]     = useState(0);
  const [sending,    setSending]    = useState(false);
  const bottomRef  = useRef(null);
  const pollConvos = useRef(null);
  const pollMsgs   = useRef(null);

  // ── Read user/token once ──────────────────────────────────────
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("dunazoe_user") || "null");
      const t = localStorage.getItem("dunazoe_token") || "";
      if (u && t) { setUser(u); setToken(t); }
    } catch (_) {}
  }, []);

  // ── Listen for "Chat Vendor" button event ─────────────────────
  useEffect(() => {
    function handler(e) {
      if (!e.detail) return;
      setActive({ receiver_id: e.detail.receiver_id, name: e.detail.name || "Vendor" });
      setOpen(true);
    }
    document.addEventListener("dz:open-chat", handler);
    return () => document.removeEventListener("dz:open-chat", handler);
  }, []);

  // ── Poll conversations (every 20 s) ───────────────────────────
  const loadConvos = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${API}/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const d = await r.json();
      const list = d.conversations || [];
      setConvos(list);
      setUnread(list.reduce((a, c) => a + (c.unread || 0), 0));
    } catch (_) {}
  }, [token]);

  useEffect(() => {
    if (!user || !token) return;
    loadConvos();
    pollConvos.current = setInterval(loadConvos, 20000);
    return () => clearInterval(pollConvos.current);
  }, [user, token, loadConvos]);

  // ── Poll messages for active conversation (every 5 s) ─────────
  const loadMsgs = useCallback(async () => {
    if (!token || !active) return;
    try {
      const r = await fetch(`${API}/chat/messages?with=${active.receiver_id}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const d = await r.json();
      setMessages(d.messages || []);
    } catch (_) {}
  }, [token, active]);

  useEffect(() => {
    if (!active) { clearInterval(pollMsgs.current); return; }
    setMessages([]);
    loadMsgs();
    pollMsgs.current = setInterval(loadMsgs, 5000);
    return () => clearInterval(pollMsgs.current);
  }, [active, loadMsgs]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────
  async function send(e) {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || !active || sending) return;
    setInput("");
    setSending(true);
    // Optimistic
    const opt = { id: `opt-${Date.now()}`, sender_id: user.id, receiver_id: active.receiver_id, message: msg, created_at: new Date().toISOString() };
    setMessages(m => [...m, opt]);
    try {
      await fetch(`${API}/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ receiver_id: active.receiver_id, message: msg }),
      });
      // Refresh to get server-assigned ID
      setTimeout(loadMsgs, 800);
    } catch (_) {}
    setSending(false);
  }

  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? "Close chat" : "Open chat"}
        style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 9000,
          width: "56px", height: "56px", borderRadius: "50%",
          background: "var(--dz-gradient)", border: "none", cursor: "pointer",
          fontSize: "1.3rem", boxShadow: "0 4px 24px rgba(0,102,255,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.2s",
        }}
      >
        {open ? "✕" : "💬"}
        {!open && unread > 0 && (
          <span style={{
            position: "absolute", top: "2px", right: "2px",
            minWidth: "18px", height: "18px", borderRadius: "9px",
            background: "var(--danger)", border: "2px solid var(--bg)",
            fontSize: "0.6rem", fontWeight: 800, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
          }}>{unread > 99 ? "99+" : unread}</span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: "92px", right: "24px", zIndex: 9000,
          width: "340px", height: "480px", borderRadius: "20px",
          background: "rgba(6,13,31,0.97)", border: "1px solid var(--border)",
          backdropFilter: "blur(24px)", display: "flex", flexDirection: "column",
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)", overflow: "hidden",
        }}>

          {/* Header */}
          <div style={{
            padding: "14px 16px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: "10px",
            background: "rgba(0,163,255,0.06)",
          }}>
            {active ? (
              <>
                <button type="button" onClick={() => { setActive(null); setMessages([]); }} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "1rem" }}>←</button>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>{active.name}</p>
                  <p style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Live · 5s refresh</p>
                </div>
              </>
            ) : (
              <>
                <span style={{ fontSize: "1.2rem" }}>💬</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>Messages</p>
                  <p style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Vendor · Buyer chats</p>
                </div>
                <button type="button" onClick={loadConvos} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.8rem" }}>↻</button>
              </>
            )}
          </div>

          {/* Body */}
          {!active ? (
            <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
              {convos.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--text-muted)" }}>
                  <p style={{ fontSize: "2rem", marginBottom: "8px" }}>💬</p>
                  <p style={{ fontSize: "0.82rem" }}>No conversations yet.</p>
                  <p style={{ fontSize: "0.75rem", marginTop: "6px" }}>Chat vendors from any product page.</p>
                </div>
              ) : convos.map(c => (
                <button key={c.id || c.other_user_id} type="button"
                  onClick={() => setActive({ receiver_id: c.other_user_id, name: c.other_user_name || "User" })}
                  style={{
                    width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: "12px",
                    background: "transparent", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "10px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--dz-gradient)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 800, fontSize: "0.85rem" }}>
                    {(c.other_user_name || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text)" }}>{c.other_user_name || "User"}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.last_message || "—"}</p>
                  </div>
                  {c.unread > 0 && (
                    <span style={{ minWidth: "18px", height: "18px", borderRadius: "9px", background: "var(--dz-blue)", fontSize: "0.65rem", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{c.unread}</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 12px", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                    <p>Say hello! 👋</p>
                  </div>
                ) : messages.map((m, i) => (
                  <Bubble key={m.id || i} msg={m} myId={user.id} />
                ))}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={send} style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", display: "flex", gap: "8px" }}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Type a message…"
                  disabled={sending}
                  style={{
                    flex: 1, padding: "9px 12px", borderRadius: "12px",
                    background: "rgba(255,255,255,0.07)", border: "1px solid var(--border)",
                    color: "var(--text)", fontSize: "0.85rem", outline: "none",
                  }}
                />
                <button type="submit" disabled={!input.trim() || sending} style={{
                  padding: "9px 14px", borderRadius: "12px", background: "var(--dz-gradient)",
                  border: "none", cursor: "pointer", color: "#fff", fontSize: "0.85rem",
                }}>→</button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
