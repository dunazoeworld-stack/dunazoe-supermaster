"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageShell from "../../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const AVAILABLE_GROUPS = [
  { id: "weekly-5k", name: "Weekly ₦5,000 Circle", members: 12, max: 20, amount: 5000, frequency: "weekly", duration: "20 weeks" },
  { id: "monthly-20k", name: "Monthly ₦20,000 Ajo", members: 8, max: 10, amount: 20000, frequency: "monthly", duration: "10 months" },
  { id: "daily-1k", name: "Daily ₦1,000 Hustle", members: 25, max: 30, amount: 1000, frequency: "daily", duration: "30 days" },
];

export default function ThriftContributePage() {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const go = () => setOffline(false); const off = () => setOffline(true);
    window.addEventListener("online", go); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", go); window.removeEventListener("offline", off); };
  }, []);

  async function handleJoin() {
    if (!selected) { setError("Please select a group."); return; }
    if (offline || !navigator.onLine) { setError("Joining an Ajo group requires a live connection."); return; }
    setLoading(true); setError("");
    try {
      const token = localStorage.getItem("dunazoe_token");
      const res = await fetch(`${API}/thrift/join`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ group_id: selected }),
      });
      const data = await res.json();
      if (data.success || data.payment_url) {
        if (data.payment_url) { window.location.href = data.payment_url; return; }
        setSuccess(true);
      } else { setError(data.error || "Failed to join group. Please try again."); }
    } catch (_) { setError("Connection error. Please check your network."); }
    finally { setLoading(false); }
  }

  return (
    <PageShell title="Join Ajo Group" icon="⬡" authRequired={true}
      subtitle="Join a digital savings circle — save together, win together"
      breadcrumb={[{ href: "/thrift", label: "Ajo Savings" }, { label: "Join a Group" }]}>
      {offline && <div className="alert alert-error" style={{ marginBottom: "20px" }}>📡 Offline — joining a group requires a live connection.</div>}
      {error && <div className="alert alert-error" style={{ marginBottom: "20px" }}>⚠️ {error}</div>}
      {success ? (
        <div style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ fontSize: "4rem", marginBottom: "16px" }}>✅</div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "8px" }} className="text-gradient">Welcome to the Group!</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>Your first contribution has been registered. You'll receive a notification each cycle.</p>
          <Link href="/thrift" className="btn btn-primary">View My Groups →</Link>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px" }}>
            {AVAILABLE_GROUPS.map(g => (
              <button key={g.id} onClick={() => setSelected(g.id)} style={{
                background: selected === g.id ? "linear-gradient(135deg, rgba(0,163,255,0.12), rgba(0,102,255,0.06))" : "var(--elevated)",
                border: `1.5px solid ${selected === g.id ? "var(--dz-blue)" : "var(--border)"}`,
                borderRadius: "var(--r-xl)", padding: "18px 20px", cursor: "pointer",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                transition: "all 0.2s", textAlign: "left", width: "100%", gap: "12px", flexWrap: "wrap",
              }}>
                <div>
                  <p style={{ fontWeight: 700, color: "var(--text)", marginBottom: "4px" }}>{g.name}</p>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{g.members}/{g.max} members · {g.frequency} · {g.duration}</p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontWeight: 800, fontSize: "1.1rem" }} className="text-gradient">₦{g.amount.toLocaleString("en-NG")}</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>per {g.frequency.replace("ly","")}</p>
                </div>
                {selected === g.id && <span className="badge badge-info" style={{ marginLeft: "auto" }}>Selected ✓</span>}
              </button>
            ))}
          </div>
          <div className="card" style={{ marginBottom: "20px" }}>
            <div className="card-body">
              <p style={{ fontWeight: 700, marginBottom: "10px" }}>How Ajo works:</p>
              <ol style={{ paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                <li>Join a group and contribute each cycle</li>
                <li>Funds are held in DUNAZOE escrow</li>
                <li>Each cycle, one member collects the pot</li>
                <li>Continue until every member has collected</li>
                <li>Your trust score increases with each contribution</li>
              </ol>
            </div>
          </div>
          <button onClick={handleJoin} disabled={!selected || loading || offline} className="btn btn-primary btn-lg" style={{ justifyContent: "center", width: "100%" }}>
            {loading ? "Joining…" : offline ? "🔌 No Connection" : selected ? `Join — ₦${(AVAILABLE_GROUPS.find(g => g.id === selected)?.amount || 0).toLocaleString("en-NG")} first contribution` : "Select a group to join"}
          </button>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center", marginTop: "10px" }}>
            🔒 First contribution is payment-secured · All funds in escrow
          </p>
        </>
      )}
    </PageShell>
  );
}
