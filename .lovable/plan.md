## Goal
Make `/b/:id` QR scans always show a clear, usable page instead of a blank/non-loading state, while keeping the canonical QR host `https://stores.lgh.lk` and preserving warehouse traceability standards.

## Root cause to address
`PublicBinAllocation` calls `useAuth()`, but the `/b/:id` route is currently rendered outside `AuthProvider`. If the QR page needs auth state for the “Sign in / Adjust stock” action, this can cause the public scan page to fail before the loading/error UI appears.

## Implementation plan
1. **Wrap the QR route with auth context only**
   - Update the public `/b/:id` route so `PublicBinAllocation` is rendered inside `AuthProvider`.
   - Keep it public; do not put it behind `ProtectedRoute`.
   - This lets anonymous scanners load the public card and logged-in users adjust stock.

2. **Make the QR page fail visibly, never silently**
   - Add defensive environment checks for `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
   - If config or network fails, show the existing “Temporarily unavailable” state with Retry rather than staying on Loading.
   - Treat Turnstile/captcha-required responses as a controlled unavailable/security-gate state until the public QR surface can render a widget.

3. **Keep the public lookup standards-aligned**
   - Keep canonical QR links on `https://stores.lgh.lk` per GS1 Digital Link resolver guidance.
   - Keep UUID validation, HTTP-status-aligned user states, noindex/nofollow, and short public cache.
   - Keep stock adjustment behind authenticated RPC/RLS rather than exposing writes publicly.

4. **Verify the scan flow**
   - Check the preview route `/b/<valid-allocation-id>` loads the branded card instead of blank loading.
   - Check an invalid ID shows “This QR code is malformed”.
   - Check the network response for `public-bin-qr` maps to visible UI states.

## Expected result
Scanning a bin allocation QR opens a stable page with item/bin/location quantities. Anonymous users can view the allocation and sign in to adjust; authenticated users can adjust stock through the existing audited adjustment dialog.