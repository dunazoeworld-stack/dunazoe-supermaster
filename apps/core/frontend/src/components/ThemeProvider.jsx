"use client";
/**
 * DUNAZOE Theme Provider
 * Manages light / dark / system theme across the entire app.
 * Stores preference in localStorage under "dunazoe_theme".
 * Injects [data-theme="light"|"dark"] on <html> so CSS selectors work.
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";

const ThemeContext = createContext({ theme: "system", resolvedTheme: "dark", setTheme: () => {} });

export function useTheme() { return useContext(ThemeContext); }

function getSystemTheme() {
  if (typeof window === "undefined" || !window.matchMedia) return null;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function getAutomaticTheme() {
  return getSystemTheme() || (typeof window !== "undefined" && new Date().getHours() >= 6 && new Date().getHours() < 18 ? "light" : "dark");
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("system"); // "light" | "dark" | "system"
  const [resolved, setResolved] = useState("dark");

  // Read stored preference on mount
  useEffect(() => {
    const stored = localStorage.getItem("dunazoe_theme") || "system";
    setThemeState(stored);
    const r = stored === "system" ? getAutomaticTheme() : stored;
    setResolved(r);
    document.documentElement.setAttribute("data-theme", r);
  }, []);

  // Listen for system preference changes
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => {
      const r = getAutomaticTheme();
      setResolved(r);
      document.documentElement.setAttribute("data-theme", r);
    };
    mq.addEventListener("change", handler);
    const clock = window.setInterval(handler, 60 * 1000);
    return () => {
      mq.removeEventListener("change", handler);
      window.clearInterval(clock);
    };
  }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    localStorage.setItem("dunazoe_theme", next);
    const r = next === "system" ? getAutomaticTheme() : next;
    setResolved(r);
    document.documentElement.setAttribute("data-theme", r);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme: resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── Compact toggle button ────────────────────────────────────────────────────
export function ThemeToggle({ compact = false }) {
  const { theme, setTheme } = useTheme();

  const OPTIONS = [
    { value: "light",  icon: "☀️", label: "Light"  },
    { value: "dark",   icon: "🌙", label: "Dark"   },
    { value: "system", icon: "⚙️", label: "System" },
  ];

  if (compact) {
    // Single-button cycle: light → dark → system → light …
    const idx  = OPTIONS.findIndex(o => o.value === theme);
    const next = OPTIONS[(idx + 1) % OPTIONS.length];
    return (
      <button
        onClick={() => setTheme(next.value)}
        title={`Theme: ${theme}. Click for ${next.label}`}
        aria-label={`Switch to ${next.label} theme`}
        style={{
          background: "none", border: "1px solid var(--border)", borderRadius: "8px",
          padding: "5px 9px", cursor: "pointer", fontSize: "1rem", lineHeight: 1,
          color: "var(--text-secondary)", transition: "border-color 0.2s",
        }}
      >
        {OPTIONS[idx].icon}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: "4px", background: "var(--surface)", borderRadius: "10px", padding: "3px" }}>
      {OPTIONS.map(o => (
        <button
          key={o.value}
          onClick={() => setTheme(o.value)}
          title={o.label}
          aria-label={`${o.label} theme`}
          style={{
            background: theme === o.value ? "var(--elevated)" : "transparent",
            border: theme === o.value ? "1px solid var(--border-strong)" : "1px solid transparent",
            borderRadius: "7px", padding: "5px 10px", cursor: "pointer",
            fontSize: "0.8rem", fontWeight: 600,
            color: theme === o.value ? "var(--text)" : "var(--text-muted)",
            transition: "all 0.2s", display: "flex", alignItems: "center", gap: "4px",
          }}
        >
          <span>{o.icon}</span>
          <span style={{ fontSize: "0.75rem" }}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
