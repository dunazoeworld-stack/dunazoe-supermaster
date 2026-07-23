"use client";
import { useState, useEffect } from "react";
import PageShell from "../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", state: "", city: "", town: "" });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSaved, setPwSaved] = useState(false);
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("dunazoe_user") || "{}");
      setUser(u);
      setForm(f => ({
        ...f,
        name:  u.name  || "",
        email: u.email || "",
        phone: u.phone || "",
      }));
    } catch (_) {}
  }, []);

  const inp = {
    width: "100%", padding: "11px 14px",
    background: "rgba(255,255,255,0.04)",
    border: "1.5px solid var(--border)",
    borderRadius: "10px", color: "var(--text-primary)",
    fontSize: "0.92rem", outline: "none", boxSizing: "border-box",
  };

  async function handleSaveProfile(e) {
    e.preventDefault();
    setError(""); setSaved(false); setLoading(true);
    try {
      const token = localStorage.getItem("dunazoe_token");
      const res = await fetch(`${API}/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Update failed."); return; }
      // Sync localStorage
      const stored = JSON.parse(localStorage.getItem("dunazoe_user") || "{}");
      localStorage.setItem("dunazoe_user", JSON.stringify({ ...stored, name: form.name, email: form.email }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (_) {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwError(""); setPwSaved(false);
    if (pwForm.next !== pwForm.confirm) { setPwError("Passwords do not match."); return; }
    if (pwForm.next.length < 8) { setPwError("New password must be at least 8 characters."); return; }
    setPwLoading(true);
    try {
      const token = localStorage.getItem("dunazoe_token");
      const res = await fetch(`${API}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.next }),
      });
      const data = await res.json();
      if (!data.success) { setPwError(data.error || "Password change failed."); return; }
      setPwSaved(true);
      setPwForm({ current: "", next: "", confirm: "" });
      setTimeout(() => setPwSaved(false), 3000);
    } catch (_) {
      setPwError("Connection error. Please try again.");
    } finally {
      setPwLoading(false);
    }
  }

  function PwdInput({ label, field }) {
    return (
      <div>
        <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px", display: "block" }}>{label}</label>
        <div style={{ position: "relative" }}>
          <input
            type={showPw[field] ? "text" : "password"}
            value={pwForm[field]}
            onChange={e => setPwForm({ ...pwForm, [field]: e.target.value })}
            style={{ ...inp, paddingRight: "44px" }}
            required
          />
          <button type="button"
            onClick={() => setShowPw(s => ({ ...s, [field]: !s[field] }))}
            style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1rem" }}>
            {showPw[field] ? "🙈" : "👁️"}
          </button>
        </div>
      </div>
    );
  }

  const ROLE_LABELS = { customer: "Customer", vendor: "Vendor", admin: "Admin", super_admin: "Super Admin", coordinator: "Coordinator", agent: "Agent" };

  return (
    <PageShell title="My Profile" icon="👤" authRequired={true} subtitle="Manage your account details and security">
      {/* Account Badge */}
      <div className="card" style={{ marginBottom: "24px", background: "linear-gradient(135deg, rgba(0,163,255,0.08), rgba(0,102,255,0.04))", borderColor: "var(--border-strong)" }}>
        <div className="card-body" style={{ display: "flex", alignItems: "center", gap: "16px", padding: "20px" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "linear-gradient(135deg,#00A3FF,#0066FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", flexShrink: 0 }}>
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: "1.05rem" }}>{user?.name || "—"}</p>
            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{user?.email || "—"}</p>
            <span className="badge badge-info" style={{ marginTop: "4px" }}>{ROLE_LABELS[user?.role] || user?.role || "Customer"}</span>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div className="card-body">
          <h3 style={{ fontWeight: 700, marginBottom: "18px" }}>📝 Personal Information</h3>
          {error && <div className="alert alert-error" style={{ marginBottom: "14px" }}>⚠️ {error}</div>}
          {saved && <div className="alert alert-success" style={{ marginBottom: "14px" }}>✅ Profile updated successfully.</div>}
          <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {[
              ["name",  "Full Name",       "text",  "name"],
              ["email", "Email Address",   "email", "email"],
              ["phone", "Phone (WhatsApp)", "tel",  "tel"],
              ["state", "State",           "text",  "address-level1"],
              ["city",  "City",            "text",  "address-level2"],
              ["town",  "Town / Area",     "text",  "address-level3"],
            ].map(([key, label, type, autoComp]) => (
              <div key={key}>
                <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px", display: "block" }}>{label}</label>
                <input type={type} autoComplete={autoComp} value={form[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })}
                  style={inp} />
              </div>
            ))}
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: "4px" }}>
              {loading ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </div>
      </div>

      {/* Change Password */}
      <div className="card">
        <div className="card-body">
          <h3 style={{ fontWeight: 700, marginBottom: "18px" }}>🔒 Change Password</h3>
          {pwError && <div className="alert alert-error" style={{ marginBottom: "14px" }}>⚠️ {pwError}</div>}
          {pwSaved && <div className="alert alert-success" style={{ marginBottom: "14px" }}>✅ Password changed successfully.</div>}
          <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <PwdInput label="Current Password" field="current" />
            <PwdInput label="New Password (min 8 chars)" field="next" />
            <PwdInput label="Confirm New Password" field="confirm" />
            <button type="submit" disabled={pwLoading} className="btn btn-outline" style={{ marginTop: "4px" }}>
              {pwLoading ? "Updating…" : "Change Password"}
            </button>
          </form>
        </div>
      </div>
    </PageShell>
  );
}
