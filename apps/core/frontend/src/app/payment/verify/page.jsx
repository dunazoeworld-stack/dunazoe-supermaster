"use client";
/**
 * /payment/verify
 * Paystack redirects here after card payment.
 * Query params: ?reference=DZ-xxx  OR  ?trxref=DZ-xxx
 *
 * This page:
 * 1. Calls /api/payments/verify to confirm with Paystack
 * 2. Shows success/failure UI
 * 3. Redirects to the order page on success
 */
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import PageShell from "../../../components/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function PaymentVerifyPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const [status, setStatus] = useState("verifying"); // verifying | success | failed
  const [data,   setData]   = useState(null);
  const [error,  setError]  = useState("");

  useEffect(() => {
    const ref = searchParams.get("reference") || searchParams.get("trxref") || searchParams.get("ref");

    if (!ref) {
      setStatus("failed");
      setError("No payment reference found. If you were charged, contact support.");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API}/payments/verify?reference=${encodeURIComponent(ref)}`);
        const d   = await res.json();
        setData(d);

        if (d.paid) {
          setStatus("success");
          // Clear cart
          try { localStorage.setItem("dunazoe_cart", "[]"); } catch (_) {}
          // Auto-redirect after 4 seconds
          setTimeout(() => {
            if (d.order_id) {
              router.push(`/orders/${d.order_id}`);
            } else {
              router.push("/orders");
            }
          }, 4000);
        } else {
          setStatus("failed");
          setError(`Payment status: ${d.status || "not confirmed"}. Please try again or contact support.`);
        }
      } catch (err) {
        setStatus("failed");
        setError("Could not verify payment. If you were charged, contact support with your reference.");
      }
    })();
  }, [searchParams, router]);

  return (
    <PageShell title="Payment Verification" icon="💳">
      <div style={{ maxWidth: "520px", margin: "60px auto", padding: "0 20px", textAlign: "center" }}>

        {/* VERIFYING */}
        {status === "verifying" && (
          <div style={{ padding: "60px 0" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: "20px", animation: "spin 1s linear infinite", display: "inline-block" }}>⬡</div>
            <h2 style={{ color: "var(--dz-blue)", marginBottom: "12px" }}>Verifying payment…</h2>
            <p style={{ color: "var(--text-secondary)" }}>Please wait while we confirm your payment with Paystack.</p>
            <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
          </div>
        )}

        {/* SUCCESS */}
        {status === "success" && (
          <div style={{ padding: "40px 0" }}>
            <div style={{ fontSize: "4rem", marginBottom: "20px" }}>✅</div>
            <h2 style={{ color: "#00C851", marginBottom: "12px" }}>Payment Confirmed!</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "8px" }}>
              ₦{data?.amount_ngn?.toLocaleString("en-NG")} paid successfully.
            </p>
            {data?.reference && (
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontFamily: "monospace", marginBottom: "24px" }}>
                Ref: {data.reference}
              </p>
            )}
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Redirecting to your order…</p>
            <div style={{ marginTop: "28px" }}>
              <a href="/orders" style={{ color: "var(--dz-blue)", textDecoration: "none", fontWeight: 600 }}>
                View all orders →
              </a>
            </div>
          </div>
        )}

        {/* FAILED */}
        {status === "failed" && (
          <div style={{ padding: "40px 0" }}>
            <div style={{ fontSize: "4rem", marginBottom: "20px" }}>❌</div>
            <h2 style={{ color: "#FF4444", marginBottom: "12px" }}>Payment Not Confirmed</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>{error}</p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <a href="/checkout" style={{
                padding: "12px 28px", borderRadius: "10px",
                background: "linear-gradient(135deg,#00A3FF,#0066FF)",
                color: "#fff", textDecoration: "none", fontWeight: 700
              }}>
                Try Again
              </a>
              <a href="/orders" style={{
                padding: "12px 28px", borderRadius: "10px",
                border: "1px solid rgba(0,163,255,0.35)", color: "var(--dz-blue)",
                textDecoration: "none", fontWeight: 600
              }}>
                My Orders
              </a>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
