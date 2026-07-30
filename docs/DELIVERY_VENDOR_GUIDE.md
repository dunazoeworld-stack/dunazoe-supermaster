# DUNAZOE Delivery Vendor Guide
**Version:** Production Hardening Patch  
**Date:** 2026-07-30

---

## Access Rules

**Delivery Vendor registration is ONLY available to approved vendor accounts.**

### Flow:
1. User registers normally via homepage → `/register`
2. User becomes a Vendor via → `/vendor/onboard`
3. Vendor dashboard shows **"Register as Delivery Vendor"** card
4. Vendor navigates to `/deliver` and registers

### Validation:
```js
// If user.role !== "vendor" → blocked with message:
"Delivery Vendor registration is available only for approved vendors."
```

Non-vendor users visiting `/deliver` see a lock screen with a link to `/vendor/onboard`.

---

## Registration Form Fields

| Field | Required | Notes |
|-------|----------|-------|
| Latitude / Longitude | ✅ | Auto-detected via browser GPS |
| Pickup Address | ✅ | Base location for assignment matching |
| Phone Number | ✅ | For order notifications |
| Service Area | ✅ | local / regional / sw_nigeria / nationwide |

### Delivery Vendor Profile (DB table: `delivery_vendor_profiles`)
| Field | Notes |
|-------|-------|
| `full_name` | Required |
| `phone` | Required |
| `whatsapp` | Optional |
| `email` | Required |
| `home_address` | Required |
| `business_address` | Optional |
| `cac_name` | Optional — business registration |
| `logo_url` | Optional — business logo |
| `flyer_url` | Optional — promotional flyer |
| `service_area` | Defaults to 'local' |
| `bank_verified` | False until KYC complete |
| `kyc_verified` | False until KYC complete |

---

## Delivery Assignment Flow

1. New order placed with delivery required
2. Logistics AI selects nearest available delivery vendor (within service area)
3. Delivery vendor receives in-app notification
4. Vendor tracks delivery through stages:
   - `confirmed` → `picked_up` → `in_transit` → `nearby` → `delivered`
5. Photo proof required for `delivered` stage
6. Payout credited within 24h of confirmed delivery

---

## Vendor Types

The vendor onboarding page now offers only two types:

| Type | Description |
|------|-------------|
| **Direct Vendor** | Sells products directly to customers |
| **Delivery Vendor** | Provides delivery services for DUNAZOE orders |

**Pickup Station** option has been removed.

---

## Commission Structure

| Event | Earning |
|-------|---------|
| Each delivery | 2% of delivery fee |
| Every 100 deliveries | ₦5,000 milestone bonus |
| Payout timing | Within 24h of delivery confirmation |

---

## Status: IMPLEMENTED ✅
