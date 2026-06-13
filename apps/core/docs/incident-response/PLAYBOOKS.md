# DUNAZOE OS — INCIDENT RESPONSE PLAYBOOKS v4
## Updates #93–#96 | CTO Authority Document

| Playbook | Trigger | Severity | SLA |
|---|---|---|---|
| IR-01 | Payment failure >5% | Critical | 15 min |
| IR-02 | Financial fraud/theft | Critical | 5 min |
| IR-03 | Data breach | Critical | 10 min |
| IR-04 | Single service down | High | 30 min |
| IR-05 | Full platform outage | Critical | 10 min |
| IR-06 | Brute force/DDoS | High | 15 min |
| IR-07 | Escrow imbalance | Critical | 10 min |
| IR-08 | Social media compromise | Critical | 5 min |
| IR-09 | RabbitMQ queue failure | High | 20 min |
| IR-10 | Admin impersonation abuse | Critical | 5 min |

## IR-01: PAYMENT SYSTEM FAILURE
```bash
# 1. Check payment service
curl http://localhost:4015/health
# 2. Verify Paystack: status.paystack.com
# 3. Check webhook_log
psql $DATABASE_URL -c "SELECT * FROM webhook_verifications WHERE is_verified=FALSE ORDER BY created_at DESC LIMIT 10;"
# 4. Check outbox
psql $DATABASE_URL -c "SELECT status,COUNT(*) FROM outbox_events WHERE event_type='payment.confirmed' GROUP BY status;"
# 5. Run reconciliation
curl -X POST http://localhost:4024/reconciliation/run -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"types":["paystack","wallet","escrow"]}'
```
**Escalation:** T+0 On-call → T+5 Eng Lead → T+10 CTO → T+15 CEO (if >₦500k impact)

## IR-02: FINANCIAL FRAUD
```bash
# 1. Check security dashboard
curl http://localhost:4026/security/dashboard -H "Authorization: Bearer $ADMIN_TOKEN"
# 2. Freeze suspicious user
curl -X POST http://localhost:4029/admin/users/$USER_ID/status -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"is_active":false,"reason":"Fraud investigation"}'
# 3. Enable maintenance if systemic
curl -X POST http://localhost:4019/flags/maintenance_mode/toggle -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"enabled":true,"confirm_maintenance":"I_UNDERSTAND_THIS_BLOCKS_ALL_TRAFFIC"}'
```

## IR-03: DATA BREACH
```bash
# 1. Revoke ALL sessions immediately
psql $DATABASE_URL -c "UPDATE refresh_tokens SET is_revoked=TRUE WHERE expires_at>NOW();"
# 2. Export evidence
pg_dump $DATABASE_URL -t security_events -t admin_actions > evidence_$(date +%Y%m%d).sql
# 3. Notify NITDA within 72 hours (NDPR requirement)
# 4. Notify affected users within 7 days
```

## IR-04: SERVICE DOWN
```bash
for port in 4001 4002 4003 4004 4005 4006 4007 4008 4009 4010 4011 4012 4013 4014 4015 4016 4017 4018 4019 4020 4021 4022 4023 4024 4025 4026 4027 4028 4029 4030 4031; do
  status=$(curl -s --max-time 2 "http://localhost:$port/health" 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('status','err'))" 2>/dev/null || echo "DOWN")
  [ "$status" != "ok" ] && echo "PORT $port: $status"
done
# Restart specific service
PORT=4006 SERVICE_NAME=dunazoe-order node services/order-service/index.js &
```

## IR-05: FULL PLATFORM OUTAGE
```bash
# 1. Enable maintenance mode
# 2. Check DB connectivity
pg_isready -h localhost -U dunazoe_user -d dunazoe_db
# 3. Restart all
./scripts/stop-all.sh && sleep 5 && ./scripts/start-all.sh
# 4. Or Docker
docker-compose down && docker-compose up -d
# 5. Disable maintenance mode after recovery
```

## IR-08: SOCIAL MEDIA COMPROMISE (New #93)
```bash
# 1. Revoke ALL social account access immediately
curl -X POST http://localhost:4030/social/accounts/$ACCOUNT_ID/revoke -H "Authorization: Bearer $ADMIN_TOKEN"
# 2. Check social threats
psql $DATABASE_URL -c "SELECT * FROM social_media_threats ORDER BY detected_at DESC LIMIT 10;"
# 3. Notify CEO and CTO immediately via WhatsApp
# 4. Do NOT publish any posts until access verified
# 5. Rotate OAuth tokens for all platforms
```

## IR-10: ADMIN IMPERSONATION ABUSE (New #94)
```bash
# 1. Check audit trail
curl http://localhost:4029/admin/audit-trail?days=1 -H "Authorization: Bearer $ADMIN_TOKEN"
# 2. Revoke all active sessions
psql $DATABASE_URL -c "UPDATE admin_impersonations SET status='revoked',ended_at=NOW() WHERE status='active';"
# 3. Lock abusing admin account
# Requires Superuser approval
# 4. Notify affected users
```

## SEVERITY DEFINITIONS
| Level | Description | SLA | Escalation |
|---|---|---|---|
| SEV-1 Critical | Revenue/data/security | 5 min | CTO + CEO |
| SEV-2 High | Degraded service | 15 min | Eng Lead |
| SEV-3 Medium | Non-critical | 1 hour | On-call |
| SEV-4 Low | Minor bug | Next day | Team Lead |

## ON-CALL CONTACTS
- CTO: WhatsApp (priority)
- Cybersecurity Officer: WhatsApp + Phone (SEV-1)
- CEO: WhatsApp (SEV-1 only)
- Paystack: support@paystack.com / +234-1-888-0000
- Legal: Email (business hours)

*Owner: CTO | Review: Quarterly | Last: 2026*
