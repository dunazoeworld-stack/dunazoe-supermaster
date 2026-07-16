"use client";
/**
 * DUNAZOE Notification Bell
 * Polls notification-service via gateway. Shows badge + dropdown.
 */
import { useState, useEffect, useRef } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const TYPE_ICONS = {
  order:    "📦",
  payment:  "💳",
  delivery: "🚚",
  chat:     "💬",
  promo:    "🎁",
  security: "🔒",
  system:   "⚙️",
  info:     "ℹ️",
};

export default function NotificationBell() {
  const [open,   setOpen]   = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const [token,  setToken]  = useState("");
  const [user,   setUser]   = useState(null);
  const pollRef  = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("dunazoe_user") || "null");
      const t = localStorage.getItem("dunazoe_token") || "";
      if (u && t) { setUser(u); setToken(t); }
    } catch (_) {}
  }, []);

  const load = async () => {
    if (!token) return;
    try {
      const r = await fetch(`${API}/notifications?limit=15`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return;
      const d = await r.json();
      const list = d.notifications || [];
      setNotifs(list);
      setUnread(list.filter(n => !n.is_read).length);
    } catch (_) {}
  };

  useEffect(() => {
    if (user && token) {
      load();
      pollRef.current = setInterval(load, 20000);
    }
    return () => clearInterval(pollRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function markRead(id) {
    try {
      await fetch(`${API}/notifications/${id}/read`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      setNotifs(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
      setUnread(c => Math.max(0, c - 1));
    } catch (_) {}
  }

  async function markAllRead() {
    try {
      await fetch(`${API}/notifications/read-all`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      setNotifs(n => n.map(x => ({ ...x, is_read: true })));
      setUnread(0);
    } catch (_) {}
  }

  if (!user) return null;

  return (
    <div style={{ position: "relative" }} ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
        style={{
          position: "relative", background: "none", border: "none", cursor: "pointer",
          padding: "7px", borderRadius: "9px", color: "var(--text-secondary)", fontSize: "1.2rem",
          display: "flex", alignItems: "center",
        }}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: "absolute", top: "2px", right: "2px", minWidth: "16px", height: "16px",
            borderRadius: "8px", background: "var(--danger)", border: "1.5px solid var(--bg)",
            fontSize: "0.6rem", fontWeight: 800, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
          }}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "44px", right: 0, zIndex: 9999,
          width: "320px", maxHeight: "420px",
          background: "rgba(6,13,31,0.98)", border: "1px solid var(--border)",
          borderRadius: "16px", backdropFilter: "blur(20px)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>🔔 Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", color: "var(--dz-blue)", fontWeight: 600 }}>
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {notifs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-muted)" }}>
                <p style={{ fontSize: "1.8rem", marginBottom: "8px" }}>🔔</p>
                <p style={{ fontSize: "0.82rem" }}>No notifications yet</p>
              </div>
            ) : notifs.map(n => (
              <div key={n.id} onClick={() => !n.is_read && markRead(n.id)} style={{
                padding: "12px 16px", borderBottom: "1px solid var(--border)",
                background: n.is_read ? "transparent" : "rgba(0,163,255,0.05)",
                cursor: n.is_read ? "default" : "pointer",
                display: "flex", gap: "10px", alignItems: "flex-start",
              }}>
                <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{TYPE_ICONS[n.type] || "ℹ️"}</span>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <p style={{ fontWeight: n.is_read ? 500 : 700, fontSize: "0.82rem", color: "var(--text)", marginBottom: "2px" }}>{n.title}</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", WebkitLineClamp: 2, display: "-webkit-box", WebkitBoxOrient: "vertical" }}>{n.body}</p>
                  <p style={{ fontSize: "0.67rem", color: "var(--text-muted)", marginTop: "3px" }}>
                    {n.created_at ? new Date(n.created_at).toLocaleString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                  </p>
                </div>
                {!n.is_read && <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--dz-blue)", flexShrink: 0, marginTop: "4px" }} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
