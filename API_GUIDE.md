# API_GUIDE.md
# DUNAZOE — API Integration Guide

**Version:** v1.0.0-rc1  
**Generated:** 2026-06-29

---

## API Control Center

Access at: `/deploy/apis`

## Providers

| Provider | Purpose | Key Env Var | Format |
|----------|---------|-------------|--------|
| Paystack | Nigerian payments | `PAYSTACK_SECRET_KEY` | `sk_live_...` |
| Stripe | Global payments | `STRIPE_SECRET_KEY` | `sk_live_...` |
| OpenAI | AI features | `OPENAI_API_KEY` | `sk-...` |
| Cloudinary | Media uploads | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | varies |
| Supabase | Managed Postgres | `SUPABASE_URL`, `SUPABASE_KEY` | URL + eyJ... |
| SMTP | Email | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | varies |
| Namecheap | Domain/DNS | `NAMECHEAP_API_KEY`, `NAMECHEAP_USER` | varies |
| GitHub | CI/CD | `GITHUB_TOKEN`, `GITHUB_REPO` | `ghp_...` |

## Validation Endpoints

```
POST /deployment/apis/validate
Authorization: Bearer {admin_token}
Body: { "provider": "paystack", "secrets": { "PAYSTACK_SECRET_KEY": "sk_live_..." } }
```

## Security Rules

- All API keys stored as environment variables
- Never hardcoded in source code
- Rotate quarterly or after any suspected breach
- Use Replit Secrets panel for persistence

## Download API_MAP.md

Go to `/deploy/apis` → Generate API Map → Download

---

## Gateway API Routes

Gateway: port 3000 (proxies to all 33 microservices)

| Route Prefix | Service | Port |
|-------------|---------|------|
| `/auth/*` | Auth | 4001 |
| `/user/*` | User | 4002 |
| `/payment/*` | Payment | 4015 |
| `/wallet/*` | Wallet | 4009 |
| `/order/*` | Order | 4006 |
| `/deployment/*` | Deployment AI | 4027 |
| `/activation/*` | Activation Engine | 4033 |

Full port map: see `apps/core/gateway/index.js`

---
*DUNAZOE Deployment AI Control Plane*
