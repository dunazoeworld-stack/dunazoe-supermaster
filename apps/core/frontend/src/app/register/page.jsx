"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
export default function RegisterPage() {
  const router = useRouter();
  const params = useSearchParams();
  const defaultRole = params.get("role") === "vendor" ? "vendor" : "customer";
  const [role, setRole] = useState(defaultRole);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "", business_name: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  async function handleSubmit(e) {
    e.preventDefault(); setError(""); setLoading(true);
    if (form.password !== form.confirm) { setError("Passwords do not match."); setLoading(false); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); setLoading(false); return; }
    try {
      const body = { name: form.name, email: form.email, phone: form.phone, password: form.password, role };
      if (role === "vendor") body.business_name = form.business_name;
      const res = await fetch(`${API}/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Registration failed. Try again."); return; }
      localStorage.setItem("dunazoe_token", data.token);
      localStorage.setItem("dunazoe_user", JSON.stringify({ user_id: data.user_id, name: data.name, email: data.email, role: data.role }));
      if (role === "vendor") router.push("/vendor/dashboard");
      else router.push("/dashboard");
    } catch (_) { setError("Connection failed. Check your internet and try again."); }
    finally { setLoading(false); }
  }
  const inp = { width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(0,163,255,0.2)", borderRadius: "10px", color: "#fff", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" };
  const tab = (active) => ({ flex: 1, padding: "10px", borderRadius: "10px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", background: active ? "linear-gradient(135deg,#00A3FF,#0066FF)" : "transparent", color: active ? "#fff" : "#8A9AB5", transition: "all 0.2s" });
  return (
    <div style={{ minHeight: "100vh", background: "#0A0E1A", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: "460px", background: "linear-gradient(145deg,#0D1525,#0A1020)", border: "1px solid rgba(0,163,255,0.2)", borderRadius: "24px", padding: "40px", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <Link href="/"><Image src="/assets/dunazoe-logo.jpg" alt="DUNAZOE" width={72} height={72} style={{ borderRadius: "16px", boxShadow: "0 0 30px rgba(0,163,255,0.45)", border: "2px solid rgba(0,163,255,0.3)", marginBottom: "12px" }} /></Link>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, letterSpacing: "0.08em", background: "linear-gradient(135deg,#00A3FF,#0066FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: "6px" }}>DUNAZOE</h1>
          <p style={{ color: "#8A9AB5", fontSize: "0.88rem" }}>Create your free account.</p>
        </div>
        <div style={{ display: "flex", gap: "6px", background: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "4px", marginBottom: "24px" }}>
          <button type="button" onClick={() => setRole("customer")} style={tab(role === "customer")}>🛒 Customer</button>
          <button type="button" onClick={() => setRole("vendor")} style={tab(role === "vendor")}>🏪 Vendor / Seller</button>
        </div>
        {error && <div data-testid="error-message" style={{ background: "rgba(255,59,92,0.1)", border: "1px solid rgba(255,59,92,0.3)", borderRadius: "10px", padding: "12px", marginBottom: "20px", fontSize: "0.85rem", color: "#FF3B5C" }}>⚠️ {error}</div>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div><label style={{ fontSize: "0.82rem", color: "#8A9AB5", marginBottom: "6px", display: "block" }}>Full Name</label><input type="text" value={form.name} onChange={set("name")} placeholder="Temidayo Folorunso" required style={inp} /></div>
          <div><label style={{ fontSize: "0.82rem", color: "#8A9AB5", marginBottom: "6px", display: "block" }}>Email</label><input type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" required style={inp} /></div>
          <div><label style={{ fontSize: "0.82rem", color: "#8A9AB5", marginBottom: "6px", display: "block" }}>Phone (WhatsApp)</label><input type="tel" value={form.phone} onChange={set("phone")} placeholder="+2348012345678" required style={inp} /></div>
          {role === "vendor" && <div><label style={{ fontSize: "0.82rem", color: "#8A9AB5", marginBottom: "6px", display: "block" }}>Business / Store Name</label><input type="text" value={form.business_name} onChange={set("business_name")} placeholder="My Fashion Store" required style={inp} /></div>}
          <div><label style={{ fontSize: "0.82rem", color: "#8A9AB5", marginBottom: "6px", display: "block" }}>Password</label><input type="password" value={form.password} onChange={set("password")} placeholder="Min 8 characters" required style={inp} /></div>
          <div><label style={{ fontSize: "0.82rem", color: "#8A9AB5", marginBottom: "6px", display: "block" }}>Confirm Password</label><input type="password" value={form.confirm} onChange={set("confirm")} placeholder="Repeat password" required style={inp} /></div>
          <button type="submit" disabled={loading} style={{ padding: "14px", borderRadius: "12px", background: loading ? "rgba(0,163,255,0.4)" : "linear-gradient(135deg,#00A3FF,#0066FF)", border: "none", color: "#fff", fontSize: "1rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", marginTop: "4px" }}>
            {loading ? "Creating account..." : `Create ${role === "vendor" ? "Vendor" : ""} Account →`}
          </button>
        </form>
        <p style={{ marginTop: "12px", fontSize: "0.75rem", color: "#3D4F6E", textAlign: "center", lineHeight: 1.5 }}>By registering you agree to DUNAZOE's Terms of Service and Privacy Policy.</p>
        <div style={{ marginTop: "20px", textAlign: "center", fontSize: "0.85rem", color: "#8A9AB5" }}>Already have an account? <Link href="/login" style={{ color: "#00A3FF", textDecoration: "none", fontWeight: 600 }}>Sign in</Link></div>
      </div>
    </div>
  );
}
