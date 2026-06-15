# GITHUB RELEASE
**Project:** DUNAZOE Supermaster  
**Version:** v1.0.0-beta  
**Date:** 2026-06-15  

---

## Branch

```
release/v1-go-live
```

## Commit

```
ad622abb  Finalize all release reports and prepare for deployment
          (latest checkpoint — all reports + fixes committed)
```

## Rollback Commit

```
f5ad07c   ci: wire CI/CD to live Deployment AI dashboard
          (safe rollback — pre-release-session state)
```

## Deployment Tag

```
v1.0.0-beta
```

---

## Create Release Branch (Run From Your Machine)

```bash
# Clone (if not already cloned)
git clone https://github.com/dunazoeworld-stack/dunazoe-supermaster.git
cd dunazoe-supermaster

# Pull latest
git pull origin main

# Create release branch
git checkout -b release/v1-go-live

# Push release branch
git push origin release/v1-go-live

# Tag the release
git tag -a v1.0.0-beta -m "DUNAZOE v1.0.0-beta — marketplace + wallet + admin go-live"
git push origin v1.0.0-beta
```

---

## GitHub Release (Manual — UI)

1. Go to `https://github.com/dunazoeworld-stack/dunazoe-supermaster/releases`
2. Click **Draft a new release**
3. Tag: `v1.0.0-beta`
4. Branch: `release/v1-go-live`
5. Title: `DUNAZOE v1.0.0-beta — Beta Launch`
6. Description:

```markdown
## DUNAZOE v1.0.0-beta

First production-ready release of the DUNAZOE marketplace platform.

### What's live
- User registration + login
- Vendor onboarding + dashboard
- Product listing, search, detail
- Cart + Checkout (Paystack NGN + Stripe USD)
- Escrow-backed orders
- Wallet + ledger
- Notifications (email, SMS, WhatsApp)
- Admin dashboard
- KYC
- Fraud detection

### What's held (post-beta)
- Thrift savings (pending loan ledger fix)
- DUNAZOE Express (pending index.js)
- AI Bank Layer (excluded)
- Mobile APK (scaffold — 3-4 weeks)

### Rollback
`git checkout f5ad07c`
```

7. Check **Set as pre-release**
8. Click **Publish release**

---

## Files Changed in This Release

| File | Change |
|---|---|
| `apps/core/gateway/index.js` | JWT_SECRET hardcoded fallback removed |
| `apps/core/.env.example` | Cloudinary + Redis + RabbitMQ + service URLs added |
| `apps/core/frontend/next.config.js` | Created — Cloudinary domain whitelist |
| `apps/core/frontend/src/app/layout.jsx` | PWA meta tags + manifest link added |
| `apps/core/frontend/public/manifest.json` | Created — PWA manifest |
| `apps/core/frontend/public/sw.js` | Created — offline service worker |
| `apps/core/services/dunazoe-express/package.json` | Created — missing package manifest |
| All `*.md` reports (20+) | Created — full release documentation |

---

*Generated: 2026-06-15 — DUNAZOE CTO / GitHub Release Manager*
