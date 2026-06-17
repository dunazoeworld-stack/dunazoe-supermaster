# GO-LIVE CHECKLIST
**Project:** DUNAZOE Supermaster v1.0.0-RC1  
**Date:** 2026-06-16  
**Phase:** 23 — Final Go-Live Audit  

---

## DOMAIN + DNS

| Check | Status | Notes |
|---|---|---|
| Domain registered (dunazoe.com) | ⚠️ PENDING | Namecheap domain expired — renew |
| DNS A record → server IP | ⬜ | Set after Contabo IP obtained |
| www subdomain configured | ⬜ | CNAME or A record |
| DNS propagated (<24h) | ⬜ | Check via dnschecker.org |
| **Decision:** | ⚠️ USE REPLIT URL | dunazoe.com unavailable until renewed |

---

## SSL / HTTPS

| Check | Status | Notes |
|---|---|---|
| Replit: automatic HTTPS | ✅ AUTO | Replit handles SSL for beta |
| Contabo: Certbot configured | ✅ READY | `certbot --nginx -d dunazoe.com` |
| HSTS header | ⚠️ SPRINT 2 | Add after Nginx is live |
| SSL certificate expiry monitored | ⬜ | Set Certbot auto-renew cron |

---

## PAYMENTS

| Check | Status | Notes |
|---|---|---|
| Paystack live keys set | ⬜ PENDING | `PAYSTACK_SECRET_KEY=sk_live_...` |
| Paystack webhook registered | ⬜ PENDING | `[url]/payments/webhook/paystack` |
| Stripe live keys set | ⬜ PENDING | `STRIPE_SECRET_KEY=sk_live_...` |
| Stripe webhook registered | ⬜ PENDING | `[url]/payments/webhook/stripe` |
| HMAC signature verification | ✅ DONE | Implemented in payment service |
| Idempotency keys | ✅ DONE | Implemented in shared/idempotency.js |
| Test payment completes | ⬜ RUN AFTER DEPLOY | Use Paystack test mode first |

---

## DATABASE

| Check | Status | Notes |
|---|---|---|
| PostgreSQL accessible | ⬜ PENDING | Set `DATABASE_URL` |
| schema.sql migrated | ⬜ PENDING | Run before first request |
| schema-phase3-4.sql migrated | ⬜ PENDING | |
| schema-phase5-8.sql migrated | ⬜ PENDING | |
| schema-phase9.sql migrated | ⬜ PENDING | |
| schema-phase10.sql migrated | ⬜ PENDING | |
| Pre-launch backup taken | ⬜ | `pg_dump $DATABASE_URL > pre_launch.sql` |
| PgBouncer pool configured | ✅ READY | Disabled in beta, enabled on Contabo |

---

## STORAGE + MEDIA

| Check | Status | Notes |
|---|---|---|
| Cloudinary account active | ⬜ PENDING | Set 3 Cloudinary secrets |
| Upload test passes | ⬜ RUN AFTER DEPLOY | POST /uploads/image |
| File size limit configured | ✅ DONE | 10MB max in upload service |

---

## WEBHOOK SECURITY

| Check | Status | Notes |
|---|---|---|
| Paystack HMAC verification | ✅ DONE | `X-Paystack-Signature` checked |
| Stripe signature verification | ✅ DONE | `stripe.webhooks.constructEvent` |
| Webhook log table | ✅ DONE | `webhook_log` in schema |
| Idempotency on replay | ✅ DONE | Deduplication implemented |

---

## WALLET

| Check | Status | Notes |
|---|---|---|
| Wallet service deployed | ✅ IN BETA | Port 4009 |
| Feature flag = OFF at launch | ✅ DONE | Auto-activates at 100 users |
| Ledger engine tested | ✅ DONE | shared/ledger/ledgerEngine.js |
| Double-entry accounting | ✅ DONE | DEBIT/CREDIT always balanced |

---

## NOTIFICATIONS

| Check | Status | Notes |
|---|---|---|
| Termii API key set | ⬜ PENDING | `TERMII_API_KEY` |
| SMS test sends | ⬜ RUN AFTER DEPLOY | |
| Email fallback configured | ✅ DONE | Nodemailer fallback |
| RabbitMQ event queue | ✅ DONE | notification consumer running |

---

## MONITORING

| Check | Status | Notes |
|---|---|---|
| `/deploy/monitor` bookmarked | ⬜ | Bookmark on phone |
| Admin credentials saved | ⬜ | Secure password manager |
| Grafana dashboard | ⚠️ OPTIONAL | Contabo only — not in Replit beta |
| WhatsApp alert group | ⬜ | Add team to group |

---

## BACKUPS

| Check | Status | Notes |
|---|---|---|
| Pre-deploy DB backup | ⬜ | `pg_dump > pre_launch.sql` |
| Replit checkpoint taken | ✅ | `a20abd7c`, `915780de` available |
| Rollback plan documented | ✅ | `HANDOVER_PACKAGE/ROLLBACK_GUIDE.md` |
| Recovery tested (mental) | ✅ | 4 rollback methods available |

---

## FINAL VERDICT

| All Secrets Set | Schemas Migrated | Webhooks Registered | Test Payment | Monitor Online |
|---|---|---|---|---|
| ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

**All 5 ✅ = LAUNCH. Any ⬜ = WAIT.**

---

*Generated: 2026-06-16 — DUNAZOE Chief Production Auditor*
