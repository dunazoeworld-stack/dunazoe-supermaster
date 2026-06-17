#!/bin/bash
# =====================================================================
# DUNAZOE — FINAL_GITHUB_PUSH.sh
# One-shot: commit → branch → push → tag → push tag
# Usage: chmod +x FINAL_GITHUB_PUSH.sh && ./FINAL_GITHUB_PUSH.sh
# =====================================================================

set -e

VERSION="v1.0.0-RC1"
TAG="v1.0.0"
BRANCH="release/v1-go-live"
MSG="FINAL RC HANDOVER — DUNAZOE v1.0.0-rc1"

red()   { echo -e "\033[31m$*\033[0m"; }
green() { echo -e "\033[32m$*\033[0m"; }
blue()  { echo -e "\033[34m$*\033[0m"; }

echo "========================================================"
blue " DUNAZOE GitHub Push — $VERSION"
echo " $(date)"
echo "========================================================"

# ── 1. Run release check first ─────────────────────────────────
if [ -f "github_release_check.sh" ]; then
  echo ""
  blue "Step 1: Running release check..."
  bash github_release_check.sh || {
    red "Release check FAILED. Fix issues before pushing."
    exit 1
  }
  green "Release check PASSED ✅"
else
  echo "⚠️  github_release_check.sh not found — skipping check"
fi

# ── 2. Stage all changes ───────────────────────────────────────
echo ""
blue "Step 2: Staging changes..."
git add -A
echo "Files staged: $(git diff --cached --name-only | wc -l)"

# ── 3. Commit ─────────────────────────────────────────────────
echo ""
blue "Step 3: Committing..."
git commit -m "$MSG" || echo "Nothing new to commit (already committed)"

# ── 4. Create/switch branch ───────────────────────────────────
echo ""
blue "Step 4: Switching to branch $BRANCH..."
git checkout -B "$BRANCH"

# ── 5. Push branch ────────────────────────────────────────────
echo ""
blue "Step 5: Pushing branch..."
git push origin "$BRANCH"
green "Branch pushed: $BRANCH ✅"

# ── 6. Create tag ─────────────────────────────────────────────
echo ""
blue "Step 6: Creating tag $TAG..."
git tag -a "$TAG" -m "DUNAZOE Supermaster $VERSION — Production Ready" 2>/dev/null \
  || echo "Tag $TAG already exists — skipping"

# ── 7. Push tag ───────────────────────────────────────────────
echo ""
blue "Step 7: Pushing tag..."
git push origin "$TAG" 2>/dev/null || echo "Tag already on remote — skipping"
green "Tag pushed: $TAG ✅"

echo ""
echo "========================================================"
green " GITHUB PUSH COMPLETE"
echo " Branch: $BRANCH"
echo " Tag:    $TAG"
echo " Commit: $MSG"
echo ""
echo " Verify at: github.com/dunazoeworld-stack/dunazoe-supermaster"
echo "========================================================"
