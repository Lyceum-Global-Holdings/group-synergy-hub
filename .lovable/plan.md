## White screen after login on stores.lgh.lk — root cause and fix

### Diagnosis
`src/lib/scannerShell.ts` decides whether to mount the full ERP (`App`) or the stripped-down `ScannerApp`. Its detection is **sticky via `sessionStorage['lgh-scanner-app']`** — once set (by visiting `/scanner`, or by `?app=scanner`, or by a prior tab), every subsequent load in that tab boots `ScannerApp` regardless of the URL.

`ScannerApp` uses `BrowserRouter basename="/scanner"`. When the sticky flag is set but the URL is `stores.lgh.lk/` (no `/scanner` prefix), React Router matches nothing under the basename, the catch-all `Navigate to="/"` resolves outside the basename, and the page renders **blank** — the white screen the user sees right after `/auth` redirects to `/`.

Contributing factors:
- Lovable's custom-domain 301 sends `scan.lgh.lk` → `stores.lgh.lk`, so users expecting the scanner land on the primary host and get sticky-flagged.
- `Auth.tsx` post-login navigates to `/` unconditionally, which is out-of-basename in the scanner shell.
- There's no error boundary wrapping the router, so any mismatch renders nothing instead of a fallback.

### Fix plan

1. **Harden `src/lib/scannerShell.ts`**
   - Only treat the current load as "scanner" when the URL actually says so (`/scanner` path or `?app=scanner`). Drop the plain sessionStorage fallback that causes the stickiness at `/`.
   - Keep a sessionStorage marker only to preserve scanner mode across deep-link navigation *inside* `/scanner/*` (so it still works during a scan workflow), but ignore it when `location.pathname` is outside `/scanner`.
   - Add a `?app=main` (and pathname `/`) escape hatch that clears the sessionStorage marker, so any user currently stuck can recover by visiting `stores.lgh.lk/?app=main` once.

2. **Make `Auth.tsx` post-login redirect safe**
   - After sign-in, if the current bundle is the scanner shell, navigate to `/` *within* basename (i.e. `/scanner/`); otherwise navigate to `/` as today.
   - Guard against a `location.state.from.pathname` that points outside the active shell.

3. **Add a top-level error boundary**
   - Wrap `<Routes>` in both `App.tsx` and `ScannerApp.tsx` with a small `RootErrorBoundary` that shows a branded fallback (message + "Reload" + "Go to sign-in") instead of a blank page. Purely defensive so future regressions can't reproduce a silent white screen.

4. **Verification**
   - Reproduce the pre-fix loop: set `sessionStorage['lgh-scanner-app']='1'` on `stores.lgh.lk`, visit `/`, confirm blank; then confirm the patched build renders the main ERP.
   - Sign in on `stores.lgh.lk/auth` and confirm redirect to `/` renders the Dashboard, not a blank screen.
   - Visit `stores.lgh.lk/scanner`, confirm the scanner shell still boots normally and internal navigation still works.

### Files touched
- `src/lib/scannerShell.ts` — detection logic + escape hatch.
- `src/pages/Auth.tsx` — shell-aware post-login redirect.
- `src/App.tsx`, `src/scanner/ScannerApp.tsx` — wrap `<Routes>` with a shared error boundary.
- `src/components/common/RootErrorBoundary.tsx` — new small component.

No database, RLS, or auth-flow changes are needed — the Supabase session and MFA gating stay exactly as they are.
