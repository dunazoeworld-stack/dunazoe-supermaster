"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || (data.locked_for_minutes ? `Account locked for ${data.locked_for_minutes} minutes` : "Invalid credentials"));
        return;
      }
      localStorage.setItem("dunazoe_token", data.token);
      localStorage.setItem("dunazoe_user", JSON.stringify({ user_id: data.user_id, name: data.name, email: data.email, role: data.role }));
      if (data.role === "admin" || data.role === "super_admin") router.push("/admin");
      else if (data.role === "vendor") router.push("/vendor/dashboard");
      else router.push("/dashboard");
    } catch (_) { setError("Connection failed. Try again."); }
    finally { setLoading(false); }
  }

  const inp = { width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(0,163,255,0.2)", borderRadius: "10px", color: "#fff", fontSize: "0.95rem", outline: "none" };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0E1A", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: "420px", background: "linear-gradient(145deg,#0D1525,#0A1020)", border: "1px solid rgba(0,163,255,0.2)", borderRadius: "24px", padding: "40px", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <Link href="/"><Image src="/assets/dunazoe-logo.jpg" alt="DUNAZOE" width={72} height={72} style={{ borderRadius: "16px", boxShadow: "0 0 30px rgba(0,163,255,0.45)", border: "2px solid rgba(0,163,255,0.3)", marginBottom: "12px" }} /></Link>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, letterSpacing: "0.08em", background: "linear-gradient(135deg,#00A3FF,#0066FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: "6px" }}>DUNAZOE</h1>
          <p style={{ color: "#8A9AB5", fontSize: "0.88rem" }}>Welcome back. Sign in to continue.</p>
        </div>

        {error && <div data-testid="error-message" style={{ background: "rgba(255,59,92,0.1)", border: "1px solid rgba(255,59,92,0.3)", borderRadius: "10px", padding: "12px", marginBottom: "20px", fontSize: "0.85rem", color: "#FF3B5C" }}>⚠️ {error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "0.82rem", color: "#8A9AB5", marginBottom: "6px", display: "block" }}>Email</label>
            <input name="email" type="email" autoComplete="email" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="your@email.com" required style={inp} />
          </div>

          <div>
            <label style={{ fontSize: "0.82rem", color: "#8A9AB5", marginBottom: "6px", display: "block" }}>Password</label>
            <div style={{ position: "relative" }}>
              <input name="password" type={showPwd ? "text" : "password"} autoComplete="current-password"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••" required
                style={{ ...inp, paddingRight: "48px" }} />
              <button
                type="button"
                aria-label={showPwd ? "Hide password" : "Show password"}
                onClick={() => setShowPwd(v => !v)}
                style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: "4px", fontSize: "1.1rem", color: "#8A9AB5", lineHeight: 1 }}
              >
                {showPwd ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <Link href="/forgot-password" style={{ fontSize: "0.82rem", color: "#00A3FF", textDecoration: "none" }}>Forgot password?</Link>
          </div>

          <button type="submit" disabled={loading}
            style={{ padding: "14px", borderRadius: "12px", background: loading ? "rgba(0,163,255,0.4)" : "linear-gradient(135deg,#00A3FF,#0066FF)", border: "none", color: "#fff", fontSize: "1rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Signing in…" : "Sign In →"}
          </button>
        </form>

        <div style={{ marginTop: "24px", textAlign: "center", fontSize: "0.85rem", color: "#8A9AB5" }}>
          Don't have an account? <Link href="/register" style={{ color: "#00A3FF", textDecoration: "none", fontWeight: 600 }}>Sign up free</Link>
        </div>
      </div>
    </div>
  );
}
