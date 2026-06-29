# PORTABILITY_GUIDE.md
# DUNAZOE — Portability & Self-Host Guide

**Version:** v1.0.0-rc1  
**Generated:** 2026-06-29  
**Portable:** YES ✅

---

## Supported Deployment Targets

| Target | Ready | Effort |
|--------|-------|--------|
| 🐳 Docker / Docker Compose | ✅ YES | Low |
| 🖥️ VPS (Contabo / DigitalOcean) | ✅ YES | Low |
| 🟢 Node.js Standalone (PM2) | ✅ YES | Medium |
| 🎛️ Admin Panel Mode (API only) | ✅ YES | Low |
| 📦 Standalone ZIP Export | ✅ YES | Low |

---

## Quickest Path (Docker + VPS)

```bash
# 1. SSH into server (use Termius app on phone)
ssh root@YOUR_SERVER_IP

# 2. Install Docker
apt update -y && apt install -y docker.io docker-compose git curl

# 3. Clone DUNAZOE
git clone https://github.com/dunazoeworld-stack/dunazoe-supermaster
cd dunazoe-supermaster/apps/core

# 4. Set environment
cp .env.example .env.docker
nano .env.docker     # Fill in all 15 required vars

# 5. Start
docker-compose up --build -d

# 6. Verify
curl http://localhost:3000/health
# Expected: {"status":"ok"}

# 7. SSL
apt install -y certbot python3-certbot-nginx
certbot --nginx -d dunazoe.com
```

---

## Required Environment Variables (15 critical)

```
DATABASE_URL
REDIS_URL
JWT_SECRET        (≥32 chars)
REFRESH_SECRET    (≥32 chars)
INTERNAL_SECRET   (≥32 chars)
NODE_ENV=production
PAYSTACK_SECRET_KEY
PAYSTACK_PUBLIC_KEY
OPENAI_API_KEY
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
SMTP_HOST
SMTP_USER
SMTP_PASS
```

Download template at: `/deploy/portability` → Environment Template

---

## Moving Beyond Replit

See `/deploy/portability` for interactive guides per target.  
Downloads available: startup guides, env template, portability doc.

---
*DUNAZOE Deployment AI Control Plane*
