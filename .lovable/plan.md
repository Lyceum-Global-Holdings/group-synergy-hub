## Goal
Harden the public `/b/:id` QR route so only canonical, allow-listed allocation data is exposed, and abuse is mitigated without violating the project's no-backend-rate-limiting policy.

## Changes

### 1. Canonical UUID validation (frontend)
`src/pages/PublicBinAllocation.tsx`
- Validate `:id` against a strict UUID v4/RFC 4122 regex before calling the RPC.
- If invalid → show generic "Bin allocation not found." (never echo `id` or backend error text).
- Collapse Supabase error to a generic message; log details only to `console.debug`.
- Add `<meta name="robots" content="noindex,nofollow" />` via `document.head` (route is per-asset, must not be indexed).
- Add `Cache-Control` hint via `<meta http-equiv>` (best-effort) and ensure no PII enters `document.title`.

### 2. Move public access behind a hardened edge function
New `supabase/functions/public-bin-qr/index.ts` (`verify_jwt = false`):
- Accepts `GET /public-bin-qr?id=<uuid>`.
- Zod-validates `id` as UUID; rejects with 400 otherwise.
- Calls the RPC with the service role internally and returns a strict allow-listed JSON projection (drops any future columns the RPC might gain).
- Optional Turnstile gate using `useTurnstileEnabledFor('public_qr')` pattern: if enabled in `security_settings`, require `cf-turnstile-token` header and `verifyTurnstile()`; otherwise allow.
- Adds short edge cache header `Cache-Control: public, max-age=60, s-maxage=60` so repeat scans don't re-hit the DB (acts as a soft abuse buffer).
- Returns 404 (not 500) when allocation is missing; never leaks DB error messages.
- No backend rate-limiting code is added — per project policy. The Turnstile gate plus edge cache is the abuse mitigation we ship.

Frontend page updated to call the edge function via `supabase.functions.invoke('public-bin-qr', { method: 'GET' })` instead of the RPC directly.

### 3. Tighten the RPC (defense in depth)
New migration:
- Add `is_active` / `deleted_at` filter (if columns exist) so soft-deleted allocations never resolve.
- Re-issue the function as `STRICT SECURITY DEFINER`, return `NULL` for unknown id (already true) and explicitly `REVOKE EXECUTE ... FROM anon` once the edge function fronts it. `authenticated` keeps direct access for the in-app dialog.
- Add `SET row_security = on` and keep the explicit allow-listed `jsonb_build_object` (safe filter).

### 4. QR payload alignment
`src/utils/binQRPayload.ts` — point the canonical URL at the new edge endpoint path on the custom domain (`https://stores.lgh.lk/b/{id}`); the React route stays the source of truth and the page calls the hardened edge function.

### 5. Security memory + Turnstile surface
- Register `public_qr` in the Turnstile surfaces list (memory + `security_settings` defaults documented).
- Update `.lovable/memory/features/warehouse/bin-allocation-qr.md` and `mem://security/turnstile-bot-protection` to record the new surface and the canonical/allow-list rules.

## Out of scope
- Backend rate limiting (forbidden by project policy — Turnstile + edge cache substitute).
- Changing what fields are visible on the public page (already minimal).
- Auth changes for the in-app dialog (still uses `authenticated` RPC).

## Verification
1. `/b/not-a-uuid` → generic "not found", no network call.
2. `/b/<random-uuid>` → 404 from edge function, generic UI message.
3. `/b/<real-uuid>` → renders item/bin/location/company + qty only; response JSON contains exactly the 11 allow-listed keys.
4. With Turnstile enabled for `public_qr` surface, requests without a token → 401; with token → 200.
5. Repeat scan within 60 s → served from edge cache (verify `cf-cache-status` / response time).
6. Direct `supabase.rpc('get_public_bin_allocation_qr', …)` from anon key → permission denied after REVOKE.
