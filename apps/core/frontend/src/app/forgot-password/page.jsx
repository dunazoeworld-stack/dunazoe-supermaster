"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success || res.status === 200) setSent(true);
      else setError(data.error || "Request failed. Please try again.");
    } catch (_) { setError("Connection error. Please try again."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <div className="card">
          <div className="card-body" style={{ padding: "40px" }}>
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
              <Link href="/"><Image src="/assets/dunazoe-logo.jpg" alt="DUNAZOE" width={64} height={64} style={{ borderRadius: "14px", boxShadow: "0 0 28px rgba(0,163,255,0.4)", marginBottom: "12px" }} /></Link>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "6px" }}><span className="text-gradient">Reset Password</span></h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>We'll send a reset link to your email.</p>
            </div>
            {sent ? (
              <div style={{ textAlign: "center" }}>
                <div className="alert alert-success" style={{ marginBottom: "20px" }}>
                  ✅ Reset link sent to <strong>{email}</strong>. Check your inbox and spam folder.
                </div>
                <Link href="/login" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>← Back to Sign In</Link>
              </div>
            ) : (
              <>
                {error && <div className="alert alert-error" style={{ marginBottom: "16px" }}>⚠️ {error}</div>}
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required autoComplete="email" />
                  </div>
                  <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ justifyContent: "center" }}>
                    {loading ? "Sending…" : "Send Reset Link →"}
                  </button>
                </form>
                <div style={{ textAlign: "center", marginTop: "20px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Remember your password? <Link href="/login" style={{ color: "var(--dz-blue)", textDecoration: "none", fontWeight: 600 }}>Sign in</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
