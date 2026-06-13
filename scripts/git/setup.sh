#!/bin/bash
# ================================================================
# DUNAZOE Supermaster — Git Setup Script
#
# Automates the steps in docs/git/GIT_SETUP.md sections 1-5.
# Run this from the extracted dunazoe-supermaster/ directory.
#
# Usage:
#   ./scripts/git/setup.sh git@github.com:<your-org>/dunazoe-supermaster.git
# ================================================================
set -e

REMOTE_URL="$1"

if [ -z "$REMOTE_URL" ]; then
  echo "Usage: $0 <git-remote-url>"
  echo "Example: $0 git@github.com:dunazoe/dunazoe-supermaster.git"
  exit 1
fi

if [ -d ".git" ]; then
  echo "⚠️  .git already exists — skipping init"
else
  echo "→ git init"
  git init
  git branch -M main
fi

echo "→ staging files"
git add .

echo "→ first commit"
git commit -m "chore: initial monorepo scaffold — wraps DUNAZOE OS v4 (Updates #93-#96)

- apps/core: existing 31-service platform + gateway + frontend
- apps/mobile, apps/admin-dashboard: scaffolds for future work
- .github/workflows: CI, staging deploy, production deploy (gated by Deployment AI audit)
- docs/branching: branch policy, migration notes
- Update #96 Launch Governance applied: beta-mode (10 active services),
  kill switches, wallet hardening, launch gate checklist" || echo "  (nothing to commit)"

echo "→ adding remote 'origin' -> $REMOTE_URL"
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

echo "→ pushing main"
git push -u origin main

echo "→ creating develop branch"
git checkout -b develop
git push -u origin develop
git checkout main

cat << 'EOF'

✅ Done.

Next manual steps (cannot be scripted — see docs/git/GIT_SETUP.md):
  6. Set branch protection rules for main/develop (GitHub Settings → Branches)
  7. Configure repository secrets and variables (GitHub Settings → Secrets and variables → Actions)

Then start feature work:
  git checkout develop
  git checkout -b feature/<name>
EOF
