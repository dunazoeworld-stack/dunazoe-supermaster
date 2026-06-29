"use client";
import { useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const S = {
  bg:"#0A0E1A", card:"rgba(13,21,37,0.95)", accent:"#00A3FF",
  border:"rgba(0,163,255,0.12)",
  btn:(c="accent")=>({ padding:"12px 16px", borderRadius:"10px", border:"none", fontWeight:700, cursor:"pointer", fontSize:"0.85rem", width:"100%",
    background:c==="accent"?"linear-gradient(135deg,#00A3FF,#0066FF)":c==="green"?"linear-gradient(135deg,#00CC88,#009966)":"rgba(255,255,255,0.05)",
    color:"#fff" }),
};

const TARGETS = [
  { id:"docker", icon:"🐳", name:"Docker / Docker Compose", desc:"Self-hosted, any Linux VPS", ready:true },
  { id:"vps", icon:"🖥️", name:"VPS / Contabo / DigitalOcean", desc:"Raw server, SSH deploy", ready:true },
  { id:"node", icon:"🟢", name:"Node.js Standalone", desc:"Without Docker, direct pm2", ready:true },
  { id:"admin", icon:"🎛️", name:"Admin Panel Mode", desc:"Headless, API-only deployment", ready:true },
  { id:"standalone", icon:"📦", name:"Standalone Export", desc:"Full ZIP package, portable", ready:true },
];

const ENV_TEMPLATE = `# DUNAZOE — Production Environment Template
# Generated: ${new Date().toISOString()}
# DUNAZOE v1.0.0-rc1

# ===== DATABASE =====
DATABASE_URL=postgresql://user:password@host:5432/dunazoe
REDIS_URL=redis://localhost:6379

# ===== SECURITY =====
JWT_SECRET=REPLACE_WITH_64_CHAR_RANDOM_STRING
REFRESH_SECRET=REPLACE_WITH_64_CHAR_RANDOM_STRING
INTERNAL_SECRET=REPLACE_WITH_64_CHAR_RANDOM_STRING

# ===== APP =====
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://dunazoe.com,https://www.dunazoe.com

# ===== PAYMENTS =====
PAYSTACK_SECRET_KEY=sk_live_REPLACE
PAYSTACK_PUBLIC_KEY=pk_live_REPLACE
STRIPE_SECRET_KEY=sk_live_REPLACE

# ===== AI =====
OPENAI_API_KEY=sk-REPLACE

# ===== MEDIA =====
CLOUDINARY_CLOUD_NAME=dunazoe
CLOUDINARY_API_KEY=REPLACE
CLOUDINARY_API_SECRET=REPLACE

# ===== EMAIL =====
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notify@dunazoe.com
SMTP_PASS=REPLACE

# ===== GITHUB =====
GITHUB_TOKEN=ghp_REPLACE
GITHUB_REPO=dunazoeworld-stack/dunazoe-supermaster
`;

const STARTUP_GUIDES = {
  docker: `# DUNAZOE — Docker Startup Guide

## Requirements
- Docker 24+
- docker-compose 2+
- 4GB RAM minimum (8GB recommended)

## Steps

\`\`\`bash
# 1. Clone repository
git clone https://github.com/dunazoeworld-stack/dunazoe-supermaster
cd dunazoe-supermaster

# 2. Copy environment file
cp apps/core/.env.example apps/core/.env.docker

# 3. Edit secrets (REQUIRED)
nano apps/core/.env.docker

# 4. Build and start all services
cd apps/core
docker-compose up --build -d

# 5. Verify all containers are running
docker-compose ps

# 6. Check gateway health
curl http://localhost:3000/health

# 7. Access admin panel
open http://localhost:3001/deploy
\`\`\`

## Ports
- Gateway: 3000
- Frontend: 3001
- Services: 4001-4033`,

  vps: `# DUNAZOE — VPS Startup Guide (Contabo / DigitalOcean)

## From Your Phone (Termius App)

\`\`\`bash
# 1. Connect to VPS: root@YOUR_IP

# 2. Install dependencies
apt update -y && apt install -y docker.io docker-compose git curl

# 3. Clone DUNAZOE
git clone https://github.com/dunazoeworld-stack/dunazoe-supermaster
cd dunazoe-supermaster

# 4. Setup environment
cp apps/core/.env.example apps/core/.env.docker
nano apps/core/.env.docker  # Fill in all secrets

# 5. Start platform
cd apps/core && docker-compose up --build -d

# 6. Setup SSL (Nginx + Certbot)
apt install -y certbot python3-certbot-nginx nginx
certbot --nginx -d dunazoe.com -d www.dunazoe.com

# 7. Verify
curl https://dunazoe.com/health
\`\`\``,

  node: `# DUNAZOE — Node.js Standalone Guide

## Requirements: Node.js 20+, PM2

\`\`\`bash
# Install PM2
npm install -g pm2

# Install dependencies
cd apps/core && npm install
cd gateway && npm install
cd frontend && npm install && npm run build

# Start all services with PM2
pm2 start ecosystem.config.js

# Monitor
pm2 status
pm2 logs

# Auto-restart on reboot
pm2 startup && pm2 save
\`\`\``,

  admin: `# DUNAZOE — Admin Panel Mode

## API-Only Deployment (No Frontend)

\`\`\`bash
# Start only gateway + services (no frontend)
cd apps/core
docker-compose up -d gateway auth-service payment-service \
  wallet-service order-service deployment-ai-service

# Access admin via API
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dunazoe.com","password":"..."}'

# Deployment audit
curl -X POST http://localhost:3000/deployment/audit \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version":"1.0.0","environment":"production"}'
\`\`\``,

  standalone: `# DUNAZOE — Standalone Export Package

## Create Portable ZIP

\`\`\`bash
# From project root
tar --exclude=node_modules --exclude=.git \
  -czf dunazoe-v1.0.0-rc1.tar.gz .

# Or ZIP
zip -r dunazoe-v1.0.0-rc1.zip . \
  --exclude "*/node_modules/*" --exclude ".git/*"
\`\`\`

## Package Contents
- All 33 microservices
- API Gateway
- Next.js Frontend
- Docker Compose files
- Environment template
- Documentation
- Deployment AI

## Deploy from Package
\`\`\`bash
tar -xzf dunazoe-v1.0.0-rc1.tar.gz
cd dunazoe-supermaster
cp .env.example .env.docker
# Fill secrets, then:
docker-compose up --build -d
\`\`\``
};

function DeployNav() {
  const links = [["/deploy","🚀"],["/deploy/studio","🏗️"],["/deploy/assistant","🤖"],["/deploy/apis","🔌"],["/deploy/scaling","📈"],["/deploy/portability","📦"],["/deploy/features","⚙️"],["/deploy/self","🔧"],["/deploy/github","🐙"],["/deploy/monitor","📡"],["/deploy/audit","🔍"],["/deploy/status","💚"]];
  return (
    <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"20px" }}>
      {links.map(([href,icon]) => <Link key={href} href={href} style={{ padding:"7px 10px", borderRadius:"8px", background:"rgba(0,163,255,0.06)", border:"1px solid rgba(0,163,255,0.12)", color:"#8A9AB5", textDecoration:"none", fontSize:"1rem" }}>{icon}</Link>)}
    </div>
  );
}

export default function PortabilityPage() {
  const [token] = useState(() => typeof window !== "undefined" ? localStorage.getItem("dunazoe_token") || "" : "");
  const [selected, setSelected] = useState(null);
  const [portabilityDoc, setPortabilityDoc] = useState(null);

  if (!token) return (
    <div style={{ minHeight:"100vh", background:S.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", color:"#8A9AB5" }}>
        <p style={{ fontSize:"2rem" }}>🔒</p>
        <p>Please <Link href="/deploy" style={{ color:S.accent }}>sign in at Deployment AI</Link> first.</p>
      </div>
    </div>
  );

  function download(content, name) {
    const blob = new Blob([content], { type:"text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  }

  function generatePortabilityDoc() {
    const doc = `# PORTABILITY.md\n\nGenerated: ${new Date().toISOString()}\nPlatform: DUNAZOE v1.0.0-rc1\n\n## Portable: YES ✅\n\n## Supported Targets\n${TARGETS.map(t=>`- ${t.icon} ${t.name}: ${t.ready?"READY":"IN PROGRESS"}`).join("\n")}\n\n## Environment Template\nSee .env.example — 15 required variables\n\n## Quick Start\n\`\`\`bash\ngit clone https://github.com/dunazoeworld-stack/dunazoe-supermaster\ncd dunazoe-supermaster/apps/core\ncp .env.example .env.docker\n# Fill in secrets\ndocker-compose up --build -d\n\`\`\`\n\n## Health Check\ncurl http://localhost:3000/health\n\n## Support\nSee OPERATOR_GUIDE.md and SELF_HOST_GUIDE.md`;
    setPortabilityDoc(doc);
  }

  return (
    <div style={{ minHeight:"100vh", background:S.bg, padding:"20px 16px 80px", maxWidth:"520px", margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"6px" }}>
        <Link href="/deploy" style={{ color:"#3D4F6E", textDecoration:"none", fontSize:"0.8rem" }}>← Deploy AI</Link>
        <span style={{ color:"#3D4F6E" }}>/</span>
        <span style={{ color:"#8A9AB5", fontSize:"0.8rem" }}>Portability Mode</span>
      </div>
      <h1 style={{ fontSize:"1.2rem", fontWeight:800, background:"linear-gradient(135deg,#00A3FF,#0066FF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", margin:"0 0 4px" }}>📦 Portability Mode</h1>
      <p style={{ color:"#3D4F6E", fontSize:"0.78rem", margin:"0 0 18px" }}>Move DUNAZOE beyond Replit — Docker, VPS, standalone, self-hosted</p>

      <DeployNav />

      <div style={{ background:"rgba(0,200,120,0.06)", border:"1px solid rgba(0,200,120,0.2)", borderRadius:"12px", padding:"12px 14px", marginBottom:"16px" }}>
        <p style={{ fontSize:"0.82rem", color:"#00CC88", fontWeight:700, margin:"0 0 2px" }}>✅ Portable: YES</p>
        <p style={{ fontSize:"0.75rem", color:"#8A9AB5", margin:0 }}>DUNAZOE supports 5 deployment targets. Select one to view its startup guide.</p>
      </div>

      {/* TARGET CARDS */}
      {TARGETS.map(t => (
        <div key={t.id} style={{ background:S.card, border:`1px solid ${selected===t.id?"rgba(0,163,255,0.3)":S.border}`, borderRadius:"14px", marginBottom:"10px", overflow:"hidden" }}>
          <button onClick={() => setSelected(selected===t.id?null:t.id)} style={{ width:"100%", padding:"14px 16px", background:"transparent", border:"none", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:"10px" }}>
            <span style={{ fontSize:"1.6rem" }}>{t.icon}</span>
            <div style={{ flex:1 }}>
              <p style={{ margin:0, fontSize:"0.88rem", fontWeight:700, color:"#cdd5e0" }}>{t.name}</p>
              <p style={{ margin:0, fontSize:"0.72rem", color:"#3D4F6E" }}>{t.desc}</p>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
              <span style={{ fontSize:"0.68rem", color:"#00CC88", fontWeight:700, background:"rgba(0,200,120,0.1)", padding:"2px 7px", borderRadius:"20px" }}>READY</span>
              <span style={{ color:"#3D4F6E", fontSize:"0.8rem" }}>{selected===t.id?"▲":"▼"}</span>
            </div>
          </button>

          {selected===t.id && (
            <div style={{ padding:"0 16px 16px", borderTop:"1px solid rgba(255,255,255,0.04)" }}>
              <pre style={{ fontSize:"0.72rem", color:"#8A9AB5", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:"8px", padding:"12px", maxHeight:"280px", overflow:"auto", whiteSpace:"pre-wrap", margin:"10px 0" }}>{STARTUP_GUIDES[t.id]}</pre>
              <button onClick={() => download(STARTUP_GUIDES[t.id], `${t.id.toUpperCase()}_STARTUP_GUIDE.md`)} style={S.btn("green")}>⬇️ Download Startup Guide</button>
            </div>
          )}
        </div>
      ))}

      {/* ENV TEMPLATE */}
      <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"14px", padding:"16px", marginBottom:"10px" }}>
        <p style={{ fontSize:"0.72rem", color:"#3D4F6E", margin:"0 0 10px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>🔐 Environment Template</p>
        <pre style={{ fontSize:"0.68rem", color:"#8A9AB5", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:"8px", padding:"10px", maxHeight:"160px", overflow:"auto", whiteSpace:"pre-wrap", margin:"0 0 10px" }}>{ENV_TEMPLATE}</pre>
        <button onClick={() => download(ENV_TEMPLATE, ".env.example")} style={S.btn()}>⬇️ Download .env Template</button>
      </div>

      {/* PORTABILITY DOC */}
      <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:"14px", padding:"16px" }}>
        <p style={{ fontSize:"0.72rem", color:"#3D4F6E", margin:"0 0 10px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>📄 Generate PORTABILITY.md</p>
        <button onClick={generatePortabilityDoc} style={S.btn()}>📄 Generate</button>
        {portabilityDoc && (
          <div style={{ marginTop:"10px" }}>
            <pre style={{ fontSize:"0.7rem", color:"#8A9AB5", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:"8px", padding:"10px", maxHeight:"120px", overflow:"auto", whiteSpace:"pre-wrap", margin:"0 0 8px" }}>{portabilityDoc}</pre>
            <button onClick={() => download(portabilityDoc,"PORTABILITY.md")} style={S.btn("green")}>⬇️ Download PORTABILITY.md</button>
          </div>
        )}
      </div>

      <div style={{ textAlign:"center", marginTop:"24px" }}>
        <Link href="/deploy" style={{ color:"#3D4F6E", fontSize:"0.8rem", textDecoration:"none" }}>← Back to Deployment AI</Link>
      </div>
    </div>
  );
}
