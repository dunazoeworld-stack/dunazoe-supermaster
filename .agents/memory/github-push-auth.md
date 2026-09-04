---
name: GitHub push authentication
description: The stored GitHub token may need an ephemeral askpass for HTTPS pushes.
---

When the repository's normal `replit-git-askpass` helper cannot answer an HTTPS push, use a temporary, non-repository askpass process backed by the stored GitHub secret; never place the token in a remote URL, file, or chat.

**Why:** The repository remote is HTTPS and the helper has intermittently returned an empty response even though the authorized token is available.

**How to apply:** Keep the askpass script in `/tmp`, disable terminal prompts, remove it immediately after the push, and verify the remote branch without printing any secret.