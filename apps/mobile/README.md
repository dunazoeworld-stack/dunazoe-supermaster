# DUNAZOE Mobile (React Native / Expo)

**Status:** Scaffold only — not yet built.

## Why it's empty for now

Per Update #96 (Launch Governance), beta launch targets a maximum of 10 active
backend services and web-only access. Mobile is deferred until the launch gate
criteria in `docs/branching/migration-notes.md` are met:

- 1 active vendor, 10 listed products, 5 successful payments, 5 successful
  deliveries, clean reconciliation, tested rollback, 99% staging uptime, support
  channel active.

## When ready to build

```bash
npx create-expo-app . --template
```

Recommended build order (see `docs/branching/migration-notes.md` §4 for full detail):

1. Auth (login/register) — reuses `apps/core/gateway` `/auth/*` endpoints
2. Product browsing + cart + checkout — `/products`, `/orders`, `/payments`
3. Wallet dashboard — `/wallets` (note: thrift/loan are beta-disabled, hide in UI
   until `thrift_enabled`/`loan_enabled` flags return `true` from `/flags/:name`)
4. Push notifications via Expo — wire into `notification-service`
5. Offline-first queue mirroring `shared/reliability/reliabilityEngine.js`'s
   `NigeriaNetworkQueue` pattern using `@react-native-async-storage/async-storage`

## Beta-mode awareness

Before rendering any UI for a disabled module, check:

```js
const res = await fetch(`${API_URL}/flags/thrift_enabled`);
const { enabled } = await res.json();
if (!enabled) {
  // hide Ajo/Thrift tab — show "Coming Soon" instead
}
```

Or fetch the full beta status in one call:

```js
const res = await fetch(`${API_URL}/flags/beta/status`);
const { beta_mode, active_services, enabled_feature_flags } = await res.json();
```

## Fintech language rule (Update #96 §6)

Do not use "Bank", "Deposit", or "Savings Account" anywhere in copy. Use "Wallet",
"Contribution", "Balance", "Transfer", "Top Up" instead. You can validate any string
via:

```
POST /flags/lint/fintech-language { "text": "..." }
```
