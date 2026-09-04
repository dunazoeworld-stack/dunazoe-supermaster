---
name: GitHub connector push
description: Safe fallback when shell-based GitHub authentication rejects an otherwise available credential.
---

When HTTPS Git authentication fails even after the stored credential is refreshed, an attached GitHub connector can publish the finished workspace through the Git database API: create blobs, create a tree from the remote base tree, create a commit, and advance `refs/heads/main` without force-pushing.

**Why:** The shell askpass path can return an unusable or stale credential while the connected GitHub integration remains authorized and can perform the same repository operation through its authenticated proxy.

**How to apply:** Exclude intentional local-only edits from the file list, preserve the remote base tree for excluded paths, serialize blob/tree/commit/ref updates, and verify the resulting ref plus the excluded-file blob afterward.