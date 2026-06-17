# SECRETS_APPROVAL.md — Phase 22
## DUNAZOE Secrets Activation | 2026-06-17

## STATUS: RED — 12 required secrets missing

---

## SECRET GROUPS

### Group 1: Database — NOT SET
| Secret | Required | Notes |
|---|---|---|
| DATABASE_URL | YES | postgresql://user:pass@host:5432/dunazoe_db |
| REDIS_URL | YES | redis://host:6379 |

### Group 2: Authentication — NOT SET
| Secret | Required | Notes |
|---|---|---|
| JWT_SECRET | YES | Min 32 chars random string |
| INTERNAL_SECRET | YES | Service-to-service auth |

### Group 3: Payments — NOT SET
| Secret | Required | Notes |
|---|---|---|
| PAYSTACK_SECRET_KEY | YES | sk_live_... |
| PAYSTACK_PUBLIC_KEY | YES | pk_live_... |
| PAYSTACK_WEBHOOK_SECRET | YES | From Paystack dashboard |
| STRIPE_SECRET_KEY | YES | sk_live_... |
| STRIPE_WEBHOOK_SECRET | YES | whsec_... from Stripe |

### Group 4: Cloud Storage — NOT SET
| Secret | Required | Notes |
|---|---|---|
| CLOUDINARY_CLOUD_NAME | YES | Your cloud name |
| CLOUDINARY_API_KEY | YES | From Cloudinary dashboard |
| CLOUDINARY_API_SECRET | YES | From Cloudinary dashboard |

### Group 5: Communications — OPTIONAL
| Secret | Required | Notes |
|---|---|---|
| TERMII_API_KEY | NO | Nigerian SMS provider |
| WHATSAPP_BUSINESS_TOKEN | NO | WhatsApp Business API |
| SHIPBUBBLE_API_KEY | NO | Logistics provider |

### Group 6: AI + Config — PARTIAL
| Secret | Required | Notes |
|---|---|---|
| OPENAI_API_KEY | NO | sk-... for AI features |
| ALLOWED_ORIGINS | YES | Set after deploy to .replit.app URL |
| NODE_ENV | YES | Set to: production |

---

## HOW TO SET (Replit)
1. Click lock icon in Replit left sidebar
2. Click + New Secret
3. Enter key name and real value
4. Click Add Secret
5. Repeat for all 12 required

## VALIDATION
```bash
node deployment-ai/environment-checker.js all
```
