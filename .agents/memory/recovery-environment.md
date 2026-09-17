---
name: Recovery environment constraints
description: Durable constraints discovered while validating DUNAZOE production recovery
---

The microservice workflow can start while reporting workspace-managed values such as the database and provider secrets as unavailable. Treat workflow-level environment injection as a separate staging prerequisite; do not infer database or live-provider readiness from process startup or health endpoints alone.

**Why:** The recovery validation saw the application preview working while the microservice launcher explicitly reported `DATABASE_URL` and payment credentials as unavailable. Running database-backed seed or live payment tests in that state would produce misleading results.

**How to apply:** Before staging verification, confirm the relevant workflow process can see the required environment names without printing their values, then run database, payment, and notification tests in that same process context.

The frontend local product-store file is intentional local-only state. A GitHub source sync may preserve the remote tracked copy while the working tree contains a different local copy; exclude it and document the divergence rather than overwriting either side.

**Why:** The local catalog is an offline gateway fallback and may contain workspace-specific state that is not part of the source synchronization.

**How to apply:** Use an explicit allowlist for source synchronization and compare the local/remote catalog only for awareness; never include that path in a source commit or connector tree update.

Realtime should launch with Coturn-compatible configuration but keep provider selection outside application call logic. Prefer short-lived HMAC credentials derived from `TURN_SECRET`; static username/password values remain a compatibility path.

**Why:** The approved infrastructure starts with self-hosted Coturn while retaining a migration path to cloud TURN providers. Embedding Coturn-specific credential logic in the chat UI would make that migration a code refactor.

**How to apply:** Configure `TURN_PROVIDER` and server-side provider variables, expose only the authenticated ICE server response, and never return `TURN_SECRET` to the browser.