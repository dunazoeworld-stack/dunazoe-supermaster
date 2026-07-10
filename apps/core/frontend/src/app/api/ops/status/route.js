import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  console.error("[ops/status] FATAL: JWT_SECRET / SESSION_SECRET not set. Ops endpoint disabled.");
}

const REQUIRED_SECRETS = [
  { key: "DATABASE_URL",              category: "Database",  critical: true  },
  { key: "JWT_SECRET",                category: "Auth",      critical: true  },
  { key: "REFRESH_SECRET",            category: "Auth",      critical: true  },
  { key: "INTERNAL_SECRET",           category: "Auth",      critical: false },
  { key: "SESSION_SECRET",            category: "Auth",      critical: false },
  { key: "PAYSTACK_SECRET_KEY",       category: "Payments",  critical: true  },
  { key: "PAYSTACK_PUBLIC_KEY",       category: "Payments",  critical: true  },
  { key: "PAYSTACK_WEBHOOK_SECRET",   category: "Payments",  critical: true  },
  { key: "STRIPE_SECRET_KEY",         category: "Payments",  critical: true  },
  { key: "STRIPE_WEBHOOK_SECRET",     category: "Payments",  critical: true  },
  { key: "OPENAI_API_KEY",            category: "AI",        critical: false },
  { key: "CLOUDINARY_API_SECRET",     category: "Media",     critical: false },
  { key: "GOOGLE_APP_PASSWORD",       category: "Email",     critical: false },
  { key: "SHIPBUBBLE_API_KEY",        category: "Logistics", critical: false },
  { key: "TERMII_API_KEY",            category: "SMS",       critical: false },
  { key: "WHATSAPP_BUSINESS_TOKEN",   category: "Messaging", critical: false },
  { key: "REDIS_URL",                 category: "Cache",     critical: false },
  { key: "RABBITMQ_URL",              category: "Queue",     critical: false },
  { key: "FRONTEND_URL",              category: "Config",    critical: false },
  { key: "NEXT_PUBLIC_API_URL",       category: "Config",    critical: true  },
  { key: "NEXT_PUBLIC_WS_URL",        category: "Config",    critical: false },
  { key: "NEXT_PUBLIC_PAYSTACK_KEY",  category: "Config",    critical: true  },
  { key: "NEXT_PUBLIC_SUPABASE_URL",  category: "Database",  critical: false },
  { key: "GITHUB_TOKEN",              category: "DevOps",    critical: false },
];

function maskValue(val) {
  if (!val) return null;
  if (val.length <= 8) return "****";
  return val.slice(0, 4) + "••••••••" + val.slice(-4);
}

function verifyOperator(req) {
  if (!JWT_SECRET) return null; // fail closed if secret not configured
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!["admin", "super_admin", "coordinator"].includes(decoded.role)) return null;
    return decoded;
  } catch (_) { return null; }
}

export async function GET(req) {
  const operator = verifyOperator(req);
  if (!operator) {
    return NextResponse.json({ success: false, error: "Operator access required" }, { status: 401 });
  }

  const secrets = REQUIRED_SECRETS.map(({ key, category, critical }) => {
    const val = process.env[key];
    const loaded = Boolean(val && val.length > 0);
    return {
      key,
      category,
      critical,
      loaded,
      masked: loaded ? maskValue(val) : null,
      status: loaded ? "ok" : critical ? "missing_critical" : "missing_optional",
      action_needed: !loaded && critical,
    };
  });

  const criticalMissing = secrets.filter(s => s.critical && !s.loaded);
  const readiness = Math.round(((secrets.length - criticalMissing.length) / secrets.length) * 100);

  const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("supabase.co", "dunazoe.com") || "https://dunazoe.com";
  const webhooks = [
    { name: "Paystack Webhook",       url: `${baseUrl}/api/webhooks/paystack`,  provider: "Paystack",  verified: Boolean(process.env.PAYSTACK_WEBHOOK_SECRET), method: "signature" },
    { name: "Stripe Webhook",         url: `${baseUrl}/api/webhooks/stripe`,    provider: "Stripe",    verified: Boolean(process.env.STRIPE_WEBHOOK_SECRET),   method: "signature" },
    { name: "Notification Callback",  url: `${baseUrl}/api/webhooks/notify`,    provider: "Termii",    verified: Boolean(process.env.TERMII_API_KEY),           method: "token" },
  ];

  const pwa = {
    manifest: true,
    service_worker: true,
    icons_192: true,
    icons_512: true,
    offline_fallback: true,
    install_prompt: true,
    android_path: "Install from browser > Add to Home Screen",
    ios_path: "Safari > Share > Add to Home Screen",
  };

  return NextResponse.json({
    success: true,
    operator: { id: operator.id, role: operator.role },
    readiness,
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0-rc1",
    critical_missing: criticalMissing.length,
    secrets,
    webhooks,
    pwa,
    services: {
      frontend: { status: "running", port: 5000 },
      gateway: { status: "not_running", port: 3000, note: "Start gateway for full microservices mode" },
      deployment_ai: { status: "not_running", port: 4027, note: "Start deployment-ai-service" },
    },
    timestamp: new Date().toISOString(),
  });
}
