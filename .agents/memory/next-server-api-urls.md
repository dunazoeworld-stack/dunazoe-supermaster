---
name: Next server-side API URLs
description: The project uses a relative browser API base and a separate internal server-fetch base.
---

Browser components should use the configured relative `/api` base so proxied previews and deployments remain same-origin. Server components and metadata generation must detect relative configuration and fetch through the local frontend origin instead; otherwise `fetch("/api/...")` throws and dynamic share pages fall back to generic metadata.

**Why:** The project intentionally sets `NEXT_PUBLIC_API_URL=/api`, which is valid in the browser but not a valid absolute URL for Node’s server-side fetch.

**How to apply:** Keep public/canonical/share URLs on `https://dunazoe.com`; only use `http://127.0.0.1:<port>/api` (or an explicitly configured absolute API URL) for internal server-side data loading.