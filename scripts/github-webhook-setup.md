# GitHub Webhook Setup Guide
## Connecting GitHub → DUNAZOE Deployment AI Dashboard

**Dashboard URL:** https://9e5b4e75-943a-4219-8c78-a1cf48cb7753-00-1sfx72v0oq3y9.kirk.replit.dev

---

## Step 1 — Add Webhook in GitHub

1. Go to: https://github.com/dunazoeworld-stack/dunazoe-supermaster/settings/hooks
2. Click **Add webhook**
3. Fill in:

| Field | Value |
|-------|-------|
| **Payload URL** | `https://9e5b4e75-943a-4219-8c78-a1cf48cb7753-00-1sfx72v0oq3y9.kirk.replit.dev/github-webhook` |
| **Content type** | `application/json` |
| **Secret** | *(your DEPLOYMENT_AI_TOKEN — same in both places)* |
| **Which events?** | Select individual: `push`, `pull_request`, `deployment_status`, `workflow_run` |
| **Active** | ✅ checked |

4. Click **Add webhook**

---

## Step 2 — Set GitHub Actions Variables

Go to: https://github.com/dunazoeworld-stack/dunazoe-supermaster/settings/variables/actions

### Repository Variables:
```
DEPLOYMENT_AI_URL = https://9e5b4e75-943a-4219-8c78-a1cf48cb7753-00-1sfx72v0oq3y9.kirk.replit.dev
STAGING_URL       = https://9e5b4e75-943a-4219-8c78-a1cf48cb7753-00-1sfx72v0oq3y9.kirk.replit.dev
PRODUCTION_URL    = https://dunazoe.com
```

---

## Step 3 — Set GitHub Actions Secrets

Go to: https://github.com/dunazoeworld-stack/dunazoe-supermaster/settings/secrets/actions

### Repository Secrets:
```
DEPLOYMENT_AI_TOKEN = <generate a strong 40+ char random string>
```

**Generate a token (run in terminal):**
```bash
openssl rand -hex 32
```

---

## Step 4 — Set GitHub Environments

Go to: https://github.com/dunazoeworld-stack/dunazoe-supermaster/settings/environments

### Create environment: `production`
- Required reviewers: Add yourself (CEO approval gate)
- Environment secrets: `DEPLOYMENT_AI_TOKEN` (if different per environment)

### Create environment: `staging`
- No required reviewers (auto-deploy on develop branch)

---

## Step 5 — Verify Pipeline

After completing setup:
1. Make a commit to the `develop` branch
2. Check Actions tab: https://github.com/dunazoeworld-stack/dunazoe-supermaster/actions
3. You should see `Deploy — Staging` workflow run
4. Check webhook deliveries in GitHub → Settings → Webhooks → Recent Deliveries
5. Check dashboard shows the event

---

## Pipeline Triggers Summary

| Action | Workflow | Dashboard Notified |
|--------|---------|-------------------|
| Push to `main` | `deploy-production.yml` | ✅ |
| Push to `develop` | `deploy-staging.yml` | ✅ |
| PR to `main` or `develop` | `ci.yml` | — |
| Any push | `ci.yml` | — |
