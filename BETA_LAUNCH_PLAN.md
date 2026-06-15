# BETA LAUNCH PLAN
**Project:** DUNAZOE Supermaster  
**Version:** v1.0.0-beta  
**Date:** 2026-06-15  
**Phase:** 7 — Post Deploy  

---

## Targets

| Metric | Target | Timeframe |
|---|---|---|
| Vendors onboarded | 10 | Week 1–2 |
| Registered users | 100 | Week 1–4 |
| Products listed | 500 | Week 2–4 |
| Successful orders | 20 | Week 2–4 |
| Wallet transactions | 50 | Week 2–4 |

---

## Week 1 — Soft Launch (Invite Only)

**Goal:** Stability. No crashes. Payments work.

- Invite 3–5 trusted vendors personally (friends, family businesses)
- Each vendor lists 10–20 products
- Invite 20 test users — register, browse, place 1 order each
- Monitor logs every morning: `GET /reliability/status-dashboard`
- Fix any P1 bugs same day
- Do NOT advertise publicly yet

**Vendor invite message:**
> "I'm launching DUNAZOE, a marketplace where you can sell your products online. I'd love for you to be one of our first vendors. Sign up at dunazoe.com/vendor/register — takes 5 minutes. I'll help you personally."

---

## Week 2 — Open Beta

**Goal:** First 100 users. First real revenue.

- Share `https://dunazoe.com` on WhatsApp groups, Twitter/X, Instagram
- Post product photos from your first vendors on social media
- Offer first 10 buyers a ₦500 wallet credit (configure in admin panel)
- Target local community groups (Lagos, Abuja, Port Harcourt markets)
- Track: registration rate, cart abandonment, payment success %

---

## Traffic Monitoring

Check daily using existing reliability-service endpoints:

```bash
# Overall system health
curl https://api.dunazoe.com/reliability/status-dashboard \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Error rates last 24h
curl "https://api.dunazoe.com/reliability/costs?days=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Via admin dashboard: `https://dunazoe.com/admin`

**Alerting thresholds:**
- HTTP 500 rate > 1% → investigate immediately
- Payment failure rate > 5% → check Paystack/Stripe dashboard
- Gateway latency p99 > 3s → check database query performance

---

## Error Tracking

- Check gateway logs on VPS: `docker logs dunazoe-gateway --tail 100`
- Check all service logs: `cd apps/core && npm run logs`
- File GitHub Issues for every bug: `https://github.com/dunazoeworld-stack/dunazoe-supermaster/issues`
- Label: `critical` / `high` / `medium` / `low`
- Fix `critical` same day. Fix `high` within 48h.

---

## Conversion Metrics (Track Weekly)

| Metric | Formula | Target |
|---|---|---|
| Registration rate | Registrations / Visitors | > 10% |
| First order rate | Orders / Registrations | > 20% |
| Payment success rate | Successful payments / Attempts | > 90% |
| Cart abandonment | Abandoned carts / Carts created | < 60% |
| Vendor listing rate | Products listed / Vendors | > 20 products/vendor |

Use Grafana (already configured in `apps/core/monitoring/`) for dashboards.

---

## Version Gate for v1.1.0

Only start building new features when:
- [ ] 10 active vendors confirmed
- [ ] 100 registered users
- [ ] 500 products listed
- [ ] 20 completed orders
- [ ] Loan ledger double-entry bug fixed (required before Thrift activation)

---

*Generated: 2026-06-15 — DUNAZOE CTO*
