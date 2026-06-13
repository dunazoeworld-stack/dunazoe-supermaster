# Git Setup — Manual Commands

No GitHub/git tooling is available in this environment, so these commands must be run
**by you**, locally or in your CI runner, after downloading and extracting the archive.

---

## 1. Initialize the repository

```bash
# Extract the archive you downloaded
tar -xzf dunazoe-os-v3-update96.tar.gz

# The supermaster scaffold is at dunazoe-supermaster/
cd dunazoe-supermaster

git init
git branch -M main
```

## 2. Create `.gitignore`

```bash
cat > .gitignore << 'EOF'
node_modules/
.env
.env.docker
logs/
*.log
coverage/
test-results/
.next/
dist/
build/
*.tar.gz
.DS_Store
EOF
```

## 3. First commit (foundation)

```bash
git add .
git commit -m "chore: initial monorepo scaffold — wraps DUNAZOE OS v4 (Updates #93-#96)

- apps/core: existing 31-service platform + gateway + frontend
- apps/mobile, apps/admin-dashboard: scaffolds for future work
- .github/workflows: CI, staging deploy, production deploy (gated by Deployment AI audit)
- docs/branching: branch policy, migration notes
- Update #96 Launch Governance applied: beta-mode (10 active services),
  kill switches, wallet hardening, launch gate checklist"
```

## 4. Create GitHub repository and push `main`

```bash
# Using GitHub CLI (if installed):
gh repo create dunazoe-supermaster --private --source=. --remote=origin

# OR manually: create an empty repo named "dunazoe-supermaster" on GitHub first,
# then:
git remote add origin git@github.com:<your-org>/dunazoe-supermaster.git

git push -u origin main
```

## 5. Create `develop` branch

```bash
git checkout -b develop
git push -u origin develop
```

## 6. Set branch protection (GitHub UI — cannot be scripted)

Go to: **Settings → Branches → Add branch protection rule**

For `main`:
- ✅ Require a pull request before merging
- ✅ Require approvals: 1 (CTO or designated reviewer)
- ✅ Require status checks to pass before merging → select `lint-and-test`, `deployment-audit`
- ✅ Do not allow bypassing the above settings

For `develop`:
- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging → select `lint-and-test`

## 7. Configure repository secrets (GitHub UI)

Go to: **Settings → Secrets and variables → Actions**

### Secrets
```
DATABASE_URL                  # production Postgres connection string
JWT_SECRET                     # 32+ chars
REFRESH_SECRET                  # 32+ chars
INTERNAL_SECRET                  # 32+ chars
PAYSTACK_SECRET_KEY
STRIPE_SECRET_KEY
DEPLOYMENT_AI_TOKEN              # JWT for CI to call /deployment/audit
RELIABILITY_TOKEN
STAGING_SSH_KEY                   # if deploying via SSH
STAGING_HOST
STAGING_USER
```

### Variables
```
STAGING_URL       = https://staging.dunazoe.com
PRODUCTION_URL    = https://dunazoe.com
```

## 8. Feature branch workflow example

```bash
git checkout develop
git pull origin develop
git checkout -b feature/thrift-statement-export

# ... make changes ...

git add .
git commit -m "feat(thrift): add quarterly statement PDF export

Refs #142"

git push -u origin feature/thrift-statement-export

# Then open a PR on GitHub: feature/thrift-statement-export → develop
gh pr create --base develop --head feature/thrift-statement-export \
  --title "feat(thrift): add quarterly statement PDF export" \
  --body "Refs #142"
```

## 9. Release to production

```bash
# After develop has been validated on staging:
gh pr create --base main --head develop \
  --title "release: v2026.06.1" \
  --body "Release notes here"

# Once merged, tag the release:
git checkout main
git pull origin main
git tag -a v2026.06.1 -m "Release: thrift statements + self-delivery"
git push origin v2026.06.1
```

## 10. Hotfix workflow

```bash
git checkout main
git pull origin main
git checkout -b hotfix/paystack-webhook-signature-check

# ... fix ...

git add .
git commit -m "security(payment): fix Paystack webhook signature verification

Refs #201"
git push -u origin hotfix/paystack-webhook-signature-check

# PR → main (expedited review)
gh pr create --base main --head hotfix/paystack-webhook-signature-check \
  --title "hotfix: Paystack webhook signature check" --body "Refs #201"

# After merge, backport to develop:
git checkout develop
git pull origin develop
git merge main
git push origin develop
```

---

## Quick Reference — Commands Run So Far in This Session

For traceability, here is what was actually changed in `apps/core` during this pass
(Update #96 Launch Governance), which the first commit above includes:

```
modified:   apps/core/gateway/index.js
            - added killswitch() middleware (fail-open, 10s cache)
            - wired 7 routes to kill switches:
              /auth/login, /wallets, /thrift, /payments, /payments/webhook,
              /notifications, /logistics, /self-delivery

modified:   apps/core/services/feature-flag-service/index.js
            - added BETA_ACTIVE_SERVICES (10) / BETA_DISABLED_SERVICES (22)
            - added system_killswitch table + 6 switches + routes
            - added launch_gate_status table + /launch-gate routes
            - added wallet_snapshots table (also created in wallet-service)
            - added /beta/status and /lint/fintech-language routes
            - flipped most feature flags to false for beta-mode default

modified:   apps/core/services/wallet-service/index.js
            - added wallet_audit_log, wallet_snapshots, wallet_reconciliation_log
            - added computeChecksum / recordWalletAudit / takeWalletSnapshot /
              runWalletReconciliation
            - added routes: POST /wallets/snapshot, GET /wallets/:id/snapshots,
              GET /wallets/:id/audit-log, POST /wallets/reconcile
            - 6-hour snapshot interval + 24-hour reconciliation interval

fixed:      15 empty package.json files (wallet + 14 other core services)
            — these were 0 bytes and would have broken npm install
```
