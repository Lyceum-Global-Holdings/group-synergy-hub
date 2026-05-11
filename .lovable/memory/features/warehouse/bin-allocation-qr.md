---
name: bin-allocation-qr
description: Per-allocation QR labels (item × bin × location) using GS1 Digital Link payload, hardened public edge function resolver, branded recovery for stale labels
type: feature
---

Each row in `warehouse_bin_allocations` can be turned into a printable QR label.

- **Payload**: `https://stores.lgh.lk/b/{allocation_id}?01={item_code}&254={bin_code}&91={location_code}` (GS1 Digital Link URI Syntax v1.4; AIs `01`, `254`, `91`).
- **Canonical host**: ALWAYS `https://stores.lgh.lk` per GS1 DL §6 (single, stable, organisation-controlled resolver host). Never swap for `window.location.origin` — printed labels live for years.
- QR settings: ISO/IEC 18004, ECC level **M** (15%), margin 1–2, byte mode UTF-8 (matches `AssetQRCode` so labels print on the same 2"×1" stock).
- Public route `/b/:id` (no auth) calls the **edge function `public-bin-qr`** — never the RPC directly. The page validates `id` against a strict UUID regex before any network call.
- Three error states map to RFC 9110 status codes and show branded recovery copy (never a generic browser 404):
  - `400 invalid` → "This QR code is malformed."
  - `404 not_found` → "This bin allocation no longer exists." + **Report this label** mailto pre-filled with the id (ISO 9001 §8.5.4 traceability).
  - `5xx / network` → "Temporarily unavailable." + **Retry** button.
- `public-bin-qr` enforces: canonical UUID validation, optional Cloudflare Turnstile gate (surface `public_qr`, configured at `/admin/security`), allow-listed JSON projection (only the 11 documented keys), generic error codes, 60s `Cache-Control: public` to absorb repeat scans. **No backend rate limiting** (project policy) — Turnstile + edge cache are the abuse mitigations.
- DB function `public.get_public_bin_allocation_qr` is `SECURITY DEFINER` and returns ONLY: item code/name, bin code/name, location name/code, company name, allocated qty, available qty, updated_at. Never expose cost, supplier, notes. `EXECUTE` is granted to `authenticated` only — `anon` is revoked and must go through the edge function.
- UI: `BinAllocationsTab` → per-row `QrCode` button opens `BinAllocationQRDialog` (download PNG / copy URL); top-bar "Bulk QR" button generates a multi-page PDF via `generateBulkBinQRCodePdf` over the currently filtered list.
- Index `idx_warehouse_bin_allocations_company_bin (company_id, bin_id)` keeps bulk fetches fast.

## Publish & drift checklist

The `/b/:id` route is a frontend route — printing labels is useless until the project is **republished** so `https://stores.lgh.lk` ships the bundle that knows the route. Backend (edge function + RPC) deploys automatically.

`index.html` carries `<meta name="lovable-route-version" content="b-qr-v1">`. Quick drift check:

```bash
curl -s https://stores.lgh.lk/ | grep -c lovable-route-version  # must print 1
curl -sI https://stores.lgh.lk/b/<realAllocationId>             # expect HTTP/2 200
```

If the curl returns `200` but the meta tag is missing, the published bundle predates the QR route — republish.
