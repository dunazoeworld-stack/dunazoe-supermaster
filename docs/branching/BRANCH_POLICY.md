# DUNAZOE Branch & Release Policy

## Branch Structure

| Branch | Purpose | Protected | Direct commits allowed? |
|---|---|---|---|
| `main` | Production. Deploys to dunazoe.com | ✅ Yes | ❌ Never |
| `develop` | Staging / integration. Deploys to staging.dunazoe.com | ✅ Yes | ❌ Never |
| `feature/*` | New features | ❌ No | ✅ Yes (by feature author) |
| `fix/*` | Bug fixes (non-urgent) | ❌ No | ✅ Yes |
| `hotfix/*` | Emergency production fixes | ❌ No | ✅ Yes, fast-tracked |

## Naming Conventions

```
feature/<module>-<short-description>
  e.g. feature/thrift-statement-export
       feature/mobile-expo-init
       feature/social-media-ai-instagram

fix/<module>-<short-description>
  e.g. fix/escrow-double-release-bug
       fix/wallet-negative-balance-edge-case

hotfix/<short-description>
  e.g. hotfix/paystack-webhook-signature-check
       hotfix/jwt-secret-rotation
```

## Standard Workflow

```
feature/* or fix/*
       │
       │  (1) Open PR → develop
       ▼
   develop  ──── CI runs: lint, unit tests, integration tests ────
       │
       │  (2) Manual QA on staging.dunazoe.com
       │  (3) Open PR → main (requires 1 approval minimum: CTO or designated reviewer)
       ▼
     main  ──── CI runs: full test suite + deployment audit (Update #95) ────
       │
       │  (4) Deployment AI master audit MUST pass:
       │      Security ≥ 90, Reliability ≥ 90, Scalability ≥ 85,
       │      Performance ≥ 85, Readiness ≥ 90
       ▼
   Production deploy (dunazoe.com)
```

## Hotfix Workflow (emergency only)

```
hotfix/* branched FROM main
       │
       │  Fix applied, tested locally
       ▼
   PR → main (expedited review — CTO sign-off required)
       │
       ▼
   Deploy immediately
       │
       │  Backport: PR hotfix/* → develop (keep branches in sync)
       ▼
   develop updated
```

## Pull Request Requirements

Every PR must include (see `.github/PULL_REQUEST_TEMPLATE/`):

- [ ] Linked issue / task reference
- [ ] Description of change and affected services
- [ ] Test coverage (new tests added or existing tests updated)
- [ ] Confirmation that `LOAN REJECTED` rule (max_loan = total_contributed) is untouched,
      OR explicit note if this PR intentionally modifies ledger/escrow/loan logic
      (requires CTO + Finance sign-off)
- [ ] Screenshots for any frontend change
- [ ] Migration files for any schema change (`apps/core/shared/schema*.sql`)

## Commit Message Format

```
<type>(<scope>): <short summary>

<optional body>

<optional footer: Refs #123>
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `security`, `perf`

Examples:
```
feat(thrift): add quarterly statement PDF export

fix(escrow): prevent double-release on concurrent dispute resolution

security(auth): add impossible-travel detection to login guard

Refs #142
```

## Versioning

DUNAZOE uses calendar-based versioning for releases to `main`:

```
v2026.06.1   = first production release in June 2026
v2026.06.2   = second release same month
v2026.07.1   = first release in July 2026
```

Tag every `main` merge:
```bash
git tag -a v2026.06.1 -m "Release: thrift statements + self-delivery"
git push origin v2026.06.1
```

## Code Owners (suggested — adjust as team grows)

```
# .github/CODEOWNERS
/apps/core/shared/ledger/        @cto
/apps/core/shared/fintech/        @cto @finance-lead
/apps/core/services/payment-*     @cto
/apps/core/services/escrow-*      @cto
/apps/core/services/security-ai-* @cybersecurity-officer
/apps/mobile/                     @mobile-lead
/apps/core/frontend/               @frontend-lead
```
