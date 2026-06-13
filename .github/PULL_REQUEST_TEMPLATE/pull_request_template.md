# Pull Request

## Summary

<!-- What does this PR do? Which module(s) does it touch? -->

## Type of Change

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `security` — security hardening
- [ ] `refactor` — no behavior change
- [ ] `docs` — documentation only
- [ ] `chore` — tooling/config
- [ ] `hotfix` — emergency production fix

## Target Branch

- [ ] → `develop` (standard feature/fix)
- [ ] → `main` (release from `develop`, or `hotfix/*`)

## Checklist

- [ ] Linked issue/task: Refs #___
- [ ] Tests added or updated (unit / integration / security as applicable)
- [ ] `node --check` passes on all modified service files
- [ ] No new empty `package.json` / `index.js` files introduced
- [ ] Schema changes include a new `shared/schema-*.sql` migration file (if applicable)
- [ ] Feature flag added/updated for any new module (Update #96 §1 — beta-mode gating)
- [ ] Frontend changes checked against fintech language rule (no "Bank/Deposit/Savings Account" — Update #96 §6)
- [ ] Screenshots attached for any UI change

## ⚠️ Financial / Ledger / Escrow / Loan Changes

If this PR touches `shared/ledger/ledgerEngine.js`, `shared/fintech/fintechOS.js`,
`escrow-service`, `loan-service`, `wallet-service`, or `payment-service`:

- [ ] N/A — this PR does not touch financial logic
- [ ] **CTO sign-off obtained**
- [ ] **Finance sign-off obtained**
- [ ] Confirms the hard rule `max_loan_amount = total_contributed_amount` is unchanged,
      OR explicitly documents why it changed and who approved it

## Kill Switch Impact (Update #96 §3)

- [ ] This PR does not affect any kill-switch-gated route
- [ ] This PR adds/modifies a kill-switch-gated route — switch name: `____________`

## Notes for Reviewer

<!-- Anything the reviewer should pay special attention to -->
