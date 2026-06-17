# LIVE_VERIFICATION.md — Phase 27
## DUNAZOE Post-Deploy Test Suite | 2026-06-17

## STATUS: PENDING DEPLOY

---

## AUTOMATED SMOKE TEST
```bash
node smoke-tests/index.js https://<your-replit-url>.replit.app
```

---

## MANUAL VERIFICATION CHECKLIST

### 1. Health Check
```
GET https://<url>/health
Expected: 200 {"status":"ok"}
```

### 2. Homepage Renders
```
GET https://<url>/
Expected: 200, Next.js HTML, DUNAZOE branding
```

### 3. User Registration
```
POST https://<url>/api/auth/register
Body: {"email":"beta@test.com","password":"Test1234!","role":"buyer"}
Expected: 201, JWT token returned
```

### 4. Login
```
POST https://<url>/api/auth/login
Body: {"email":"beta@test.com","password":"Test1234!"}
Expected: 200, access_token
```

### 5. Vendor Signup
```
POST https://<url>/api/vendors/register (with auth token)
Expected: 201, vendor_id
```

### 6. Product Creation
```
POST https://<url>/api/products (with vendor token)
Expected: 201, product_id
```

### 7. Order Flow
```
POST https://<url>/api/orders (with buyer token)
Expected: 201, order_id, payment_url
```

### 8. Payment (Test Mode)
```
Use Paystack test card: 4084 0840 8408 4081
Expected: Payment confirmed, order status → paid
```

### 9. Wallet Check
```
GET https://<url>/api/wallet/balance
Expected: 200, {balance, currency}
```

### 10. Notifications
```
GET https://<url>/api/notifications
Expected: 200, notifications array
```

---

## PASS CRITERIA
All 10 flows return expected status codes.
No 500 errors in logs.
Payment webhook received and processed.
Wallet balance updated after payment.
