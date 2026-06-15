// DUNAZOE OS — API GATEWAY v4 (Updates #93–#96 — 30 services)
require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const helmet    = require("helmet");
const rateLimit = require("express-rate-limit");
const { createProxyMiddleware } = require("http-proxy-middleware");
const jwt       = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("[Gateway] JWT_SECRET env var is required — set it in Replit Secrets");

app.use(helmet());
app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(","),
  methods: ["GET","POST","PUT","DELETE","PATCH","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","X-User-ID","Idempotency-Key","X-Trace-ID"],
}));

// Rate limiters
const globalLimiter  = rateLimit({ windowMs:900000, max:300, standardHeaders:true, message:{success:false,error:"Too many requests."} });
const authLimiter    = rateLimit({ windowMs:900000, max:20, message:{success:false,error:"Too many auth attempts."} });
const strictLimiter  = rateLimit({ windowMs:300000, max:3,  message:{success:false,error:"Too many attempts."} });
const aiLimiter      = rateLimit({ windowMs:60000,  max:30, message:{success:false,error:"AI rate limit reached."} });
const uploadLimiter  = rateLimit({ windowMs:60000,  max:10, message:{success:false,error:"Upload limit reached."} });
const adminLimiter   = rateLimit({ windowMs:60000,  max:60, message:{success:false,error:"Admin rate limit."} });

app.use(globalLimiter);

// Trace ID injection
app.use((req,res,next)=>{
  const trace = req.headers["x-trace-id"] || require("crypto").randomBytes(8).toString("hex");
  req.headers["x-trace-id"] = trace;
  res.setHeader("X-Trace-ID", trace);
  next();
});

// Security event reporter — send to AI security engine
async function reportSecurityEvent(event_type, data) {
  try {
    const axios = require("axios");
    await axios.post(`${SVC["security-ai"]}/security/event`, { event_type, data }, { timeout: 1000 });
  } catch (_) {}
}

app.get("/health", (req,res) => res.json({
  gateway:"DUNAZOE API Gateway v4", version:"4.0.0",
  status:"ok", port:PORT, services:Object.keys(SVC).length,
  updates:["#93","#94","#95","#96"],
  timestamp:new Date().toISOString(),
}));

// ================================================================
// UPDATE #96 — SYSTEM KILL SWITCH MIDDLEWARE
// "One broken module must never shut down the whole platform."
// Checks feature-flag-service's killswitch state (cached 10s)
// before allowing requests to payment/wallet/thrift/delivery/
// notification/login-related routes.
// ================================================================
const killswitchCache = new Map();
const KILL_CACHE_TTL  = 10000;

async function isKillswitchActive(name) {
  const hit = killswitchCache.get(name);
  if (hit && Date.now() - hit.ts < KILL_CACHE_TTL) return hit.active;
  try {
    const axios = require("axios");
    const res = await axios.get(`${SVC.flags}/killswitch/${name}`, { timeout: 1500 });
    const active = !!res.data?.active;
    killswitchCache.set(name, { active, ts: Date.now() });
    return active;
  } catch (_) {
    // Fail-open: if flag service unreachable, do not block traffic
    return killswitchCache.get(name)?.active || false;
  }
}

function killswitch(name) {
  return async (req, res, next) => {
    if (await isKillswitchActive(name)) {
      return res.status(503).json({
        success: false,
        error:   `This feature is temporarily disabled (${name}).`,
        killswitch: name,
        retry_after_minutes: 15,
      });
    }
    next();
  };
}


function verifyToken(req,res,next){
  const token=(req.headers["authorization"]||"").replace("Bearer ","").trim();
  try {
    const d=jwt.verify(token,JWT_SECRET);
    req.headers["x-user-id"]   = String(d.id);
    req.headers["x-user-role"] = d.role;
    next();
  } catch {
    // Report failed auth to security engine
    reportSecurityEvent("login_failed",{ ip:req.ip, path:req.path });
    return res.status(401).json({success:false,error:"Invalid or expired token"});
  }
}

function optionalToken(req,res,next){
  const token=(req.headers["authorization"]||"").replace("Bearer ","").trim();
  if(token){
    try {
      const d=jwt.verify(token,JWT_SECRET);
      req.headers["x-user-id"]   = String(d.id);
      req.headers["x-user-role"] = d.role;
    } catch {}
  }
  next();
}

function requireAdmin(req,res,next){
  const role = req.headers["x-user-role"] || "";
  const ADMIN_ROLES = ["super_admin","cto","head_of_store","head_of_vendors",
    "head_of_logistics","head_of_marketing","cybersecurity_officer","regional_coordinator"];
  if (!ADMIN_ROLES.includes(role)) return res.status(403).json({success:false,error:"Admin access required"});
  next();
}

function proxy(target){
  return createProxyMiddleware({ changeOrigin:true, target,
    on:{error:(err,req,res)=>{
      console.error(`[GW] ${target}: ${err.message}`);
      res.status(502).json({success:false,error:"Service temporarily unavailable."});
    }}
  });
}

const SVC = {
  // Core commerce (v1)
  auth:          process.env.AUTH_SERVICE_URL            || "http://localhost:4001",
  user:          process.env.USER_SERVICE_URL            || "http://localhost:4002",
  vendor:        process.env.VENDOR_SERVICE_URL          || "http://localhost:4003",
  product:       process.env.PRODUCT_SERVICE_URL         || "http://localhost:4004",
  inventory:     process.env.INVENTORY_SERVICE_URL       || "http://localhost:4005",
  order:         process.env.ORDER_SERVICE_URL           || "http://localhost:4006",
  escrow:        process.env.ESCROW_SERVICE_URL          || "http://localhost:4007",
  fraud:         process.env.FRAUD_SERVICE_URL           || "http://localhost:4008",
  wallet:        process.env.WALLET_SERVICE_URL          || "http://localhost:4009",
  thrift:        process.env.THRIFT_SERVICE_URL          || "http://localhost:4010",
  trust:         process.env.TRUST_SERVICE_URL           || "http://localhost:4011",
  loan:          process.env.LOAN_SERVICE_URL            || "http://localhost:4012",
  commission:    process.env.COMMISSION_SERVICE_URL      || "http://localhost:4013",
  ai:            process.env.AI_SERVICE_URL              || "http://localhost:4014",
  payment:       process.env.PAYMENT_SERVICE_URL         || "http://localhost:4015",
  dispute:       process.env.DISPUTE_SERVICE_URL         || "http://localhost:4016",
  notification:  process.env.NOTIFICATION_SERVICE_URL    || "http://localhost:4017",
  logistics:     process.env.LOGISTICS_SERVICE_URL       || "http://localhost:4018",
  // Upgrade services (v3)
  flags:         process.env.FEATURE_FLAG_SERVICE_URL    || "http://localhost:4019",
  upload:        process.env.UPLOAD_SERVICE_URL          || "http://localhost:4020",
  realtime:      process.env.REALTIME_SERVICE_URL        || "http://localhost:4021",
  search:        process.env.SEARCH_SERVICE_URL          || "http://localhost:4022",
  kyc:           process.env.KYC_SERVICE_URL             || "http://localhost:4023",
  reconciliation:process.env.RECON_SERVICE_URL           || "http://localhost:4024",
  // Updates #93-#96
  reliability:   process.env.RELIABILITY_SERVICE_URL     || "http://localhost:4025",
  "security-ai": process.env.SECURITY_AI_SERVICE_URL     || "http://localhost:4026",
  "deployment-ai":process.env.DEPLOYMENT_AI_SERVICE_URL  || "http://localhost:4027",
  "self-delivery":process.env.SELF_DELIVERY_SERVICE_URL  || "http://localhost:4028",
  "admin-override":process.env.ADMIN_OVERRIDE_SERVICE_URL|| "http://localhost:4029",
  "social-media":process.env.SOCIAL_MEDIA_SERVICE_URL    || "http://localhost:4030",
  "payments-ai": process.env.PAYMENTS_AI_SERVICE_URL     || "http://localhost:4031",
  "dunazoe-express":process.env.DUNAZOE_EXPRESS_SERVICE_URL|| "http://localhost:4032",
};

// ── PUBLIC ROUTES ─────────────────────────────────────────────
app.use("/auth/register",   authLimiter,   proxy(SVC.auth));
app.use("/auth/login",      authLimiter,   killswitch("disable_login"),    proxy(SVC.auth));
app.use("/auth/refresh",    strictLimiter, proxy(SVC.auth));
app.use("/auth",                           proxy(SVC.auth));
app.use("/products",        optionalToken, proxy(SVC.product));
app.use("/search",          optionalToken, proxy(SVC.search));
app.use("/payments/webhook",               killswitch("disable_payments"), proxy(SVC.payment));
app.use("/flags",           optionalToken, proxy(SVC.flags));
app.use("/deployment/status",optionalToken,proxy(SVC["deployment-ai"]));

// ── PROTECTED ROUTES ──────────────────────────────────────────
app.use("/users",           verifyToken, proxy(SVC.user));
app.use("/vendors",         verifyToken, proxy(SVC.vendor));
app.use("/inventory",       verifyToken, proxy(SVC.inventory));
app.use("/orders",          verifyToken, proxy(SVC.order));
app.use("/escrow",          verifyToken, proxy(SVC.escrow));
app.use("/fraud",           verifyToken, proxy(SVC.fraud));
app.use("/wallets",         verifyToken, killswitch("disable_wallet"),    proxy(SVC.wallet));
app.use("/thrift",          verifyToken, killswitch("disable_thrift"),    proxy(SVC.thrift));
app.use("/trust",           verifyToken, proxy(SVC.trust));
app.use("/loans",           verifyToken, proxy(SVC.loan));
app.use("/commissions",     verifyToken, proxy(SVC.commission));
app.use("/ai",              verifyToken, aiLimiter,    proxy(SVC.ai));
app.use("/payments",        verifyToken, killswitch("disable_payments"),  proxy(SVC.payment));
app.use("/disputes",        verifyToken, proxy(SVC.dispute));
app.use("/notifications",   verifyToken, killswitch("disable_notifications"), proxy(SVC.notification));
app.use("/logistics",       verifyToken, killswitch("disable_delivery"),  proxy(SVC.logistics));
app.use("/upload",          verifyToken, uploadLimiter,proxy(SVC.upload));
app.use("/kyc",             verifyToken, proxy(SVC.kyc));
app.use("/self-delivery",   verifyToken, killswitch("disable_delivery"),  proxy(SVC["self-delivery"]));
app.use("/dunazoe-express",verifyToken, killswitch("disable_delivery"),  proxy(SVC["dunazoe-express"]));

// ── ADMIN ROUTES (extra protection) ───────────────────────────
app.use("/admin",           verifyToken, requireAdmin, adminLimiter, proxy(SVC["admin-override"]));
app.use("/security",        verifyToken, requireAdmin, proxy(SVC["security-ai"]));
app.use("/reliability",     verifyToken, requireAdmin, proxy(SVC.reliability));
app.use("/reconciliation",  verifyToken, requireAdmin, proxy(SVC.reconciliation));
app.use("/social",          verifyToken, requireAdmin, proxy(SVC["social-media"]));
app.use("/deployment",      verifyToken, requireAdmin, proxy(SVC["deployment-ai"]));

// ── WEBSOCKET ─────────────────────────────────────────────────
app.use("/emit",            verifyToken, proxy(SVC.realtime));

app.use((req,res) => res.status(404).json({success:false,error:`Route not found: ${req.method} ${req.path}`}));
app.use((err,req,res,next) => {
  console.error("[Gateway]", err.message);
  res.status(500).json({success:false,error:"Gateway error."});
});

app.listen(PORT, () => {
  console.log(`✅ DUNAZOE API Gateway v4 — port ${PORT} — ${Object.keys(SVC).length} services`);
  console.log(`   Updates: #93 #94 #95 #96 applied`);
});
module.exports = app;
