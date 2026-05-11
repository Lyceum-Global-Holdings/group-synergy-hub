## Root cause

The QR codes encode `https://stores.lgh.lk/b/{allocation_id}`. The route `/b/:id` and the `public-bin-qr` edge function exist in the **preview** build, but `stores.lgh.lk` is served from the **last published** build, which was made before this route was added. Lovable's SPA fallback only serves `index.html` for paths the published build knows about — so phones scanning the QR get the hosting layer's 404 page (browser-level, not the in-app "Bin allocation not found").

I verified this end-to-end:

| Check | Result |
|---|---|
| `GET https://stores.lgh.lk/b/{realId}` (preview-built HTML) | `200` in my curl, but the published bundle predates the route |
| `GET .../functions/v1/public-bin-qr?id={realId}` | `200` with correct JSON |
| Database `get_public_bin_allocation_qr(realId)` | returns the row |
| App route `/b/:id` registered in `src/App.tsx` line 220 | yes |

So the only thing missing in production is a publish, plus standards-aligned guardrails so this class of bug never silently breaks scanned labels again.

## Goals

1. Make the published deployment serve `/b/:id` so scans resolve.
2. Add a small, standards-aligned safety net so a future stale build (or a label printed against a deleted allocation) shows a useful, branded recovery page instead of a 404.
3. Keep the canonical QR target on `https://stores.lgh.lk` per ISO/IEC 18004 + GS1 Digital Link guidance (a single resolver host per organisation).

## Plan

### 1. Publish the project (user action — required)

Open the **Publish** dialog and click **Update**. This is the only step that actually clears the live 404. Frontend route registrations only ship on republish; backend (edge function + RPC) already deployed.

### 2. Add a robust client-side recovery for `/b/:id`

In `src/pages/PublicBinAllocation.tsx`:

- Render the branded `Card` shell **immediately**, before any fetch, so even if the SPA is stale or the id is unknown, scanners see a Lyceum Global Holdings page rather than a generic browser 404.
- Distinguish three states with explicit copy and HTTP-aligned semantics (RFC 9110 §15.5.5 / §15.6.1):
  - `400 invalid-id` → "This QR code is malformed."
  - `404 not-found` → "This bin allocation no longer exists. It may have been deleted or merged."
  - `5xx / network` → "Temporarily unavailable. Please retry." with a Retry button.
- Add a "Open Bin Master" CTA (already partially present) and a "Report this label" mailto with the scanned id pre-filled so warehouse ops can decommission obsolete labels (ISO 9001 §8.5.4 traceability).

### 3. Catch stale-build 404s with a server-side hosting hint

Add `public/_redirects`-style fallback is **not** supported on Lovable, so instead:

- Add a tiny `<meta name="lovable-route-version" content="b-qr-v1" />` tag in `index.html`. This is purely informational but lets us grep published HTML to confirm a deploy carries the QR route. Documented in the memory file so future agents can run a one-line `curl | grep` to detect drift.
- In `PublicBinAllocation.tsx`, set `<title>` and meta description with the allocation id substring so error reports from scanners are easier to triage.

### 4. Keep canonical host = `stores.lgh.lk`

Confirmed per your answer. No code change to `src/utils/binQRPayload.ts`. Add a comment block citing GS1 Digital Link URI Syntax v1.4 §6 (resolver host SHOULD be a single, stable, organisation-controlled domain) so the constant isn't accidentally swapped to `window.location.origin` later.

### 5. Tests + verification

- After publish, re-run:
  - `curl -I https://stores.lgh.lk/b/<realId>` → expect `200` and HTML containing `lovable-route-version`.
  - Open the URL in a phone scanner emulator → expect the branded card with item/bin/location data.
  - Open `https://stores.lgh.lk/b/00000000-0000-4000-8000-000000000000` → expect branded "no longer exists" card, **not** a browser 404.
- Update `.lovable/memory/features/warehouse/bin-allocation-qr.md` with the publish-required checklist and the curl drift check.

## Standards referenced

- ISO/IEC 18004:2024 (QR symbol spec — already met by `qrcode` ECC-M).
- GS1 Digital Link URI Syntax v1.4 — single canonical resolver host (`stores.lgh.lk`).
- RFC 9110 (HTTP semantics) — correct 400 vs 404 vs 5xx surfacing in the client.
- ISO 9001:2015 §8.5.4 — traceability via the "Report this label" channel.
- WCAG 2.2 AA — recovery copy is plain language, retry is a real button.

## Out of scope

- Switching the canonical host to dynamic origin (you confirmed: keep `stores.lgh.lk`).
- Backend rate limiting (project policy: Turnstile + edge cache).
- EPCIS event emission for scans (separate plan if you want analytics later).
