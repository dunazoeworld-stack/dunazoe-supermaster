# DUNAZOE ARCHITECTURE
**Version:** v1.0.0-RC1 | **Date:** 2026-06-16

---

## SYSTEM DIAGRAM

```
                     INTERNET
                        │
                  Nginx :80/443
                  (SSL termination)
                        │
              ┌─────────┴─────────┐
              │                   │
        Frontend :5000      Direct API calls
        (Next.js SSR)              │
              │                   │
              └─────────┬─────────┘
                        │
                  Gateway :3000
                  (Express proxy)
                  33 routes → 33 services
                        │
     ┌──────────────────┼──────────────────┐
     │                  │                  │
  Core Business    Fintech Layer      AI/DevOps Layer
  auth(4001)       payment(4015)      deployment-ai(4027)
  user(4002)       escrow(4007)       security-ai(4026)
  vendor(4003)     wallet(4009)       activation-engine(4033)
  product(4004)    thrift(4010)       reliability(4025)
  inventory(4005)  loan(4012)         payments-ai(4031)
  order(4006)      commission(4013)   
  fraud(4008)      reconciliation     
  kyc(4023)        (4024)             
                        │
     ┌──────────────────┼──────────────────┐
     │                  │                  │
  PostgreSQL:5432    Redis:6379       RabbitMQ:5672
  (persistent)     (sessions/cache)  (event bus)
```

---

## NETWORK DESIGN

All application services use `network_mode: host`. This means:
- Every service binds to `0.0.0.0:[port]`
- The gateway can reach any service at `http://localhost:[port]`
- No Docker DNS needed
- Single-host deployment only (not multi-node)

**Why host network?** The gateway's SVC map uses localhost URLs. Changing this would require updating the gateway — architecture is frozen.

---

## DATA FLOW: ORDER + PAYMENT

```
User → POST /orders (gateway → order-service)
        │
        ├── Create order record (status: pending)
        ├── Publish "order.created" to RabbitMQ
        │
User → POST /payments/initialize (gateway → payment-service)
        │
        ├── Paystack API → get authorization_url
        ├── User completes payment on Paystack
        │
Paystack → POST /payments/webhook/paystack
        │
        ├── Verify HMAC signature
        ├── Update order status → paid
        ├── Hold funds in escrow (escrow-service)
        ├── Publish "payment.completed" to RabbitMQ
        │
notification-service ← consumes "payment.completed"
        │
        └── Send SMS to buyer + vendor (Termii)
```

---

## AUTHENTICATION

- JWT (HS256), 7-day expiry
- `Authorization: Bearer [token]` header
- Gateway does NOT validate JWT — services validate independently
- `shared/middleware/auth.js` → `requireAuth` + `requireRole`
- Roles: `customer`, `vendor`, `admin`, `super_admin`, `cto`

---

## FEATURE FLAG SYSTEM

- Activation Engine runs cron every 15 minutes
- Checks: user count, vendor count, order count
- Auto-activates features when thresholds crossed
- Manual override available via admin API
- All flags stored in DB + cached in Redis (flags-service:4019)

---

*DUNAZOE Final Architecture Document — v1.0.0-RC1*
