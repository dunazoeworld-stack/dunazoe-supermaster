"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const FREQUENCIES = [
  { id: "daily",   label: "Daily",   icon: "📅" },
  { id: "weekly",  label: "Weekly",  icon: "🗓️" },
  { id: "monthly", label: "Monthly", icon: "📆" },
];

// Max 12 months (1 year)
const DURATIONS = [
  { label: "1 month",  months: 1  },
  { label: "3 months", months: 3  },
  { label: "6 months", months: 6  },
  { label: "9 months", months: 9  },
  { label: "12 months (max)", months: 12 },
];

function getTargetDate(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// Estimate required contribution per cycle
function estimateContribution(target, frequency, months) {
  if (!target || !months) return 0;
  const cycles = frequency === "daily" ? months * 30 : frequency === "weekly" ? months * 4 : months;
  return Math.ceil(target / cycles);
}

export default function ThriftContributePage() {
  const [form, setForm] = useState({
    purpose:      "",
    target_amount: "",
    frequency:    "monthly",
    months:       3,
  });
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState(false);
  const [offline,  setOffline]  = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const go = () => setOffline(false); const off = () => setOffline(true);
    window.addEventListener("online", go); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", go); window.removeEventListener("offline", off); };
  }, []);

  const F = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const target     = parseFloat(form.target_amount) || 0;
  const suggestion = estimateContribution(target, form.frequency, form.months);
  const targetDate = getTargetDate(form.months);
  const interest   = target > 0 ? (target * 0.05 * form.months / 12).toFixed(2) : 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.purpose.trim())      { setError("Please enter a name for your savings goal."); return; }
    if (!form.target_amount || target < 500) { setError("Minimum target amount is ₦500."); return; }
    if (offline || !navigator.onLine) { setError("Creating a savings plan requires a live connection."); return; }

    setLoading(true); setError("");
    try {
      const token = localStorage.getItem("dunazoe_token");
      const res = await fetch(`${API}/thrift/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          purpose:        form.purpose.trim(),
          target_amount:  target,
          plan_type:      form.frequency,
          target_date:    targetDate,
          ajo_weeks:      form.months * (form.frequency === "weekly" ? 4 : form.frequency === "daily" ? 30 : 1),
        }),
      });
      const data = await res.json();
      if (data.success || data.account_id) {
        setSuccess(true);
      } else {
        setError(data.error || "Failed to create savings plan. Please try again.");
      }
    } catch (_) {
      setError("Connection error. Please check your network and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <PageShell title="Savings Plan Created" icon="⬡" authRequired={true}>
        <div style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ fontSize: "4rem", marginBottom: "16px" }}>✅</div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "8px" }} className="text-gradient">
            Savings Plan Started!
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "8px" }}>
            Your plan <strong>"{form.purpose}"</strong> is active.
          </p>
          <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>
            Target: ₦{target.toLocaleString("en-NG")} by {new Date(targetDate).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })}
          </p>
          {parseFloat(interest) > 0 && (
            <div className="alert alert-info" style={{ marginBottom: "20px" }}>
              💹 Estimated interest earned: <strong>₦{parseFloat(interest).toLocaleString("en-NG")}</strong> at 5% p.a.
            </div>
          )}
          <Link href="/thrift" className="btn btn-primary">View My Savings →</Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="New Savings Plan" icon="⬡" authRequired={true}
      subtitle="Set a personal savings goal — up to 12 months"
      breadcrumb={[{ href: "/thrift", label: "Ajo Savings" }, { label: "New Plan" }]}>

      {offline && <div className="alert alert-error" style={{ marginBottom: "20px" }}>📡 Offline — a live connection is required.</div>}
      {error   && <div className="alert alert-error" style={{ marginBottom: "20px" }}>⚠️ {error}</div>}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* Savings goal name */}
        <div className="form-group">
          <label className="form-label">Savings Goal Name</label>
          <input className="form-input" type="text" required value={form.purpose}
            onChange={e => F("purpose", e.target.value)}
            placeholder="e.g. New phone, School fees, Business capital" />
        </div>

        {/* Target amount */}
        <div className="form-group">
          <label className="form-label">Target Amount (₦)</label>
          <input className="form-input" type="number" min="500" step="100" required
            value={form.target_amount} onChange={e => F("target_amount", e.target.value)}
            placeholder="e.g. 50000"
            style={{ fontSize: "1.3rem", fontWeight: 700, padding: "14px" }} />
          {target > 0 && (
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "4px" }}>
              💹 You'll earn ~₦{parseFloat(interest).toLocaleString("en-NG")} interest (5% p.a.)
            </p>
          )}
        </div>

        {/* Contribution frequency */}
        <div>
          <label className="form-label">Contribution Frequency</label>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
            {FREQUENCIES.map(f => (
              <button key={f.id} type="button"
                onClick={() => F("frequency", f.id)}
                style={{
                  padding: "10px 18px", borderRadius: "10px", cursor: "pointer",
                  border: `1.5px solid ${form.frequency === f.id ? "var(--dz-blue)" : "var(--border)"}`,
                  background: form.frequency === f.id ? "rgba(0,163,255,0.1)" : "var(--surface)",
                  color: form.frequency === f.id ? "var(--dz-blue)" : "var(--text)",
                  fontWeight: 600, fontSize: "0.88rem",
                }}>
                {f.icon} {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Duration — max 12 months */}
        <div>
          <label className="form-label">Duration (max 12 months)</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
            {DURATIONS.map(d => (
              <button key={d.months} type="button"
                onClick={() => F("months", d.months)}
                style={{
                  padding: "12px 16px", borderRadius: "10px", cursor: "pointer", textAlign: "left",
                  border: `1.5px solid ${form.months === d.months ? "var(--dz-blue)" : "var(--border)"}`,
                  background: form.months === d.months ? "rgba(0,163,255,0.08)" : "var(--surface)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                <span style={{ fontWeight: 600, color: form.months === d.months ? "var(--dz-blue)" : "var(--text)" }}>
                  {d.label}
                </span>
                {target > 0 && (
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    ≈ ₦{estimateContribution(target, form.frequency, d.months).toLocaleString("en-NG")}/{form.frequency.replace("ly","")}
                  </span>
                )}
                {form.months === d.months && <span className="badge badge-info">Selected ✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Summary card */}
        {target > 0 && (
          <div className="card" style={{ background: "linear-gradient(135deg,rgba(0,163,255,0.06),rgba(0,102,255,0.03))", border: "1px solid rgba(0,163,255,0.15)" }}>
            <div className="card-body">
              <p style={{ fontWeight: 700, marginBottom: "12px" }}>📊 Plan Summary</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Target amount</span>
                  <span style={{ fontWeight: 700, color: "var(--text)" }}>₦{target.toLocaleString("en-NG")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Save {form.frequency}</span>
                  <span style={{ fontWeight: 700, color: "var(--dz-blue)" }}>≈ ₦{suggestion.toLocaleString("en-NG")}/{form.frequency.replace("ly","")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Matures on</span>
                  <span style={{ fontWeight: 700, color: "var(--text)" }}>
                    {new Date(targetDate).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" })}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Interest (5% p.a.)</span>
                  <span style={{ fontWeight: 700, color: "var(--success)" }}>+₦{parseFloat(interest).toLocaleString("en-NG")}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <button type="submit" disabled={loading || offline} className="btn btn-primary btn-lg"
          style={{ justifyContent: "center" }}>
          {loading ? "Creating plan…" : offline ? "🔌 No Connection" : "Start Saving →"}
        </button>

        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center" }}>
          🔒 Funds held in DUNAZOE escrow · Max duration: 12 months · 5% p.a. interest
        </p>
      </form>
    </PageShell>
  );
}
