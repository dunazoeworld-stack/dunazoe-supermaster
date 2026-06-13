module.exports = async function globalSetup() {
  const BASE = process.env.TEST_GATEWAY_URL || "http://localhost:3000";
  try {
    const res = await fetch(`${BASE}/health`);
    const d   = await res.json();
    console.log(`✅ Gateway healthy — ${d.services} services`);
  } catch(e) {
    console.warn(`⚠️  Gateway not reachable at ${BASE}`);
  }
  console.log("✅ E2E environment ready");
};
