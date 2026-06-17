# API ENDPOINT LIST
**Project:** DUNAZOE Supermaster v1.0.0-RC1

All endpoints accessible via gateway at port 3000.
Auth required unless marked (public).

---

## AUTHENTICATION

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | User/vendor registration |
| POST | `/auth/login` | Public | Returns JWT token |
| POST | `/auth/logout` | Token | Invalidate session |
| GET | `/auth/me` | Token | Get current user |
| POST | `/auth/refresh` | Token | Refresh JWT |

## PRODUCTS

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/products` | Public | List products (paginated) |
| GET | `/products/:id` | Public | Get product detail |
| POST | `/products` | Vendor | Create product |
| PUT | `/products/:id` | Vendor | Update product |
| DELETE | `/products/:id` | Vendor | Delete product |

## ORDERS

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/orders` | Token | Create order |
| GET | `/orders/:id` | Token | Get order |
| GET | `/orders/my` | Token | My orders |
| PUT | `/orders/:id/status` | Vendor/Admin | Update status |

## PAYMENTS

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/payments/initialize` | Token | Init Paystack payment |
| POST | `/payments/verify/:ref` | Token | Verify payment |
| POST | `/payments/refund` | Admin | Issue refund |
| POST | `/payments/webhook/paystack` | Public (HMAC) | Paystack webhook |
| POST | `/payments/webhook/stripe` | Public (sig) | Stripe webhook |

## WALLET

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/wallets/balance` | Token | Get wallet balance |
| POST | `/wallets/fund` | Token | Fund wallet |
| POST | `/wallets/withdraw` | Token | Withdraw |
| GET | `/wallets/transactions` | Token | Transaction history |

## KYC

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/kyc/submit` | Token | Submit KYC documents |
| GET | `/kyc/status` | Token | Get KYC status |
| PUT | `/kyc/:id/verify` | Admin | Approve KYC |

## NOTIFICATIONS

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/notifications/send` | Admin | Send notification |
| GET | `/notifications/history` | Token | Notification log |

## DEPLOYMENT AI

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/deployment/audit` | Admin | Run pre-deploy audit |
| POST | `/deployment/deploy` | Admin | Execute deployment |
| POST | `/deployment/rollback` | Admin | Rollback |
| GET | `/deployment/status` | Admin | Last 5 deployments |
| GET | `/deployment/monitor` | Admin | Live health check |
| GET | `/deployment/logs` | Admin | Audit history |
| GET | `/deployment/releases` | Admin | Release versions |
| GET | `/deployment/github` | Admin | GitHub push commands |
| GET | `/deployment/credits` | Admin | Credit usage |
| GET | `/deployment/checklist` | Admin | GO/NO-GO gate |
| GET | `/deployment/health/detailed` | Admin | 14-service health |

## ACTIVATION ENGINE

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/activation/features` | Public | All 15 feature states |
| GET | `/activation/features/:name` | Public | Single feature state |
| POST | `/activation/features/:name/activate` | Admin | Manual override |
| POST | `/activation/evaluate` | Admin | Trigger evaluation |
| GET | `/activation/metrics` | Admin | Activation metrics |
| GET | `/activation/history` | Admin | Activation events |

## HEALTH

All services expose:

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | Public | Gateway health |
| GET | `/auth/health` | Public | Auth service health |
| GET | `/products/health` | Public | Product service health |
| ... | `/[service]/health` | Public | Each service |

---

*DUNAZOE API List v1.0.0-RC1 — 2026-06-16*
