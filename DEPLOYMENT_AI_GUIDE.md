# DUNAZOE Deployment AI Guide

**Architecture:** v1.0.0-rc1, frozen  
**Updated:** 2026-08-17

## Operator flow

1. Open `/deploy` and authenticate with an admin/CTO account.
2. Enter an idea, code excerpt, bug report, or improvement request in **Operator Command Center**.
3. Choose the request type and run **Analyze & prepare patch plan**.
4. Review the returned summary, architecture fit, risks, and recovery guidance.
5. Use `/deploy/assistant` for the approved operation cards (build, test, fix, run, deploy, publish, rollback).
6. Run the existing deployment audit. A deployment remains blocked until the audit approves the selected environment/provider.
7. If an approved operation becomes unhealthy, stop the rollout and use the existing rollback path.

## Safety boundaries

- Analysis does not mutate source code or deploy anything.
- The command center does not bypass authentication, audit thresholds, or the existing control plane.
- Publishing remains a human-approved action and was not run in this stabilization batch.
- GitHub push remains an operator action and depends on the existing Replit/GitHub connection or configured credential; credentials are never printed.

## Changed surface

- `apps/core/frontend/src/app/deploy/page.jsx` — command input, request type, analysis result, risk and recovery guidance.
- Existing `apps/core/frontend/src/app/deploy/assistant/page.jsx` — approved operation foundation retained.
- Existing `apps/core/services/deployment-ai-service/control-plane-routes.js` — analysis endpoint reused; no duplicate service added.

## Manual checks before publish

- Sign in as an admin/CTO.
- Submit one idea and one code/fix request.
- Confirm an analysis result is shown.
- Run audit for staging first.
- Confirm rollback instructions are visible and do not publish automatically.