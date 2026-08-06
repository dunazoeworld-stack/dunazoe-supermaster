"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const ICONS = {
  order:    "📦",
  payment:  "💳",
  wallet:   "💰",
  delivery: "🚚",
  system:   "🔔",
  promo:    "🎁",
  kyc:      "🪪",
  vendor:   "🏪",
  default:  "🔔",
};

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationsPage() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("all");   // all | unread
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("dunazoe_token") || "";
      const res   = await fetch("/api/notifications", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const d = await res.json();
      setItems(Array.isArray(d.notifications) ? d.notifications : []);
      setOffline(Boolean(d.offline));
    } catch (_) {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markAllRead() {
    try {
      const token = localStorage.getItem("dunazoe_token") || "";
      await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setItems(prev => prev.map(n => ({ ...n, read: true })));
    } catch (_) {}
  }

  async function markRead(id) {
    try {
      const token = localStorage.getItem("dunazoe_token") || "";
      await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (_) {}
  }

  const visible   = filter === "unread" ? items.filter(n => !n.read) : items;
  const unreadCnt = items.filter(n => !n.read).length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", padding: "0 0 48px" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--border)", padding: "24px 0 20px" }}>
        <div className="container">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>🔔 Notifications</h1>
              {unreadCnt > 0 && (
                <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  {unreadCnt} unread
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {/* Filter pills */}
              {["all", "unread"].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: "6px 14px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", border: "none",
                  background: filter === f ? "var(--dz-blue)" : "var(--surface)",
                  color:      filter === f ? "#fff" : "var(--text-secondary)",
                  transition: "all 0.15s",
                }}>
                  {f === "all" ? `All (${items.length})` : `Unread (${unreadCnt})`}
                </button>
              ))}
              {unreadCnt > 0 && (
                <button onClick={markAllRead} style={{
                  padding: "6px 14px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                  border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)",
                }}>
                  Mark all read
                </button>
              )}
              <button onClick={load} style={{
                padding: "6px 10px", borderRadius: "10px", fontSize: "0.88rem", cursor: "pointer",
                border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)",
              }} title="Refresh">⟳</button>
            </div>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: "24px" }}>
        {offline && (
          <div style={{ padding: "12px 16px", background: "rgba(255,170,0,0.12)", border: "1px solid rgba(255,170,0,0.3)", borderRadius: "10px", color: "#ffaa00", marginBottom: "16px", fontSize: "0.85rem" }}>
            ⚠️ Notification service is offline — showing cached data only.
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "12px" }}>⏳</div>
            Loading notifications…
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🔔</div>
            <p style={{ fontWeight: 600, marginBottom: "6px" }}>
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
            <p style={{ fontSize: "0.85rem" }}>We'll notify you about orders, payments, and promotions here.</p>
            {filter === "unread" && (
              <button onClick={() => setFilter("all")} style={{ marginTop: "16px", padding: "8px 20px", borderRadius: "10px", background: "var(--dz-blue)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>
                View all
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {visible.map(n => {
              const icon = ICONS[n.type] || ICONS.default;
              return (
                <div
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  style={{
                    display: "flex", gap: "14px", alignItems: "flex-start",
                    padding: "14px 16px", borderRadius: "12px",
                    background: n.read ? "transparent" : "rgba(0,163,255,0.05)",
                    border: n.read ? "1px solid transparent" : "1px solid rgba(0,163,255,0.15)",
                    cursor: n.read ? "default" : "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontSize: "1.4rem", minWidth: "36px", textAlign: "center", marginTop: "2px" }}>{icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <p style={{ margin: 0, fontWeight: n.read ? 500 : 700, fontSize: "0.9rem", color: "var(--text)" }}>
                        {n.title || "Notification"}
                      </p>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
                        {!n.read && (
                          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--dz-blue)", display: "inline-block" }} />
                        )}
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {timeAgo(n.created_at)}
                        </span>
                      </div>
                    </div>
                    <p style={{ margin: "3px 0 0", fontSize: "0.84rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {n.message || n.body || ""}
                    </p>
                    {n.link && (
                      <Link href={n.link} style={{ fontSize: "0.8rem", color: "var(--dz-blue)", textDecoration: "none", fontWeight: 600, display: "inline-block", marginTop: "6px" }}>
                        View →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
