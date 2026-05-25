# Scanner PWA → path-based at `/scanner`

Lovable hosting 301-redirects every non-primary custom domain to the Primary, so `scan.lgh.lk` can never serve a different bundle than `stores.lgh.lk`. Switch the scanner shell to a path prefix on the same origin. Same-origin also means the Supabase session is automatically shared (no cookie-domain work needed).

## Detection

`src/lib/scannerShell.ts`
- Replace hostname check with: `location.pathname === '/scanner' || location.pathname.startsWith('/scanner/')`.
- Keep `?app=scanner` + `sessionStorage` fallback (useful for local dev / preview iframe).
- Drop the `scan.` hostname branch.

## Routing

`src/scanner/ScannerApp.tsx`
- Add `basename="/scanner"` to `<BrowserRouter>`. All internal routes (`/`, `/auth`, `/auth/mfa`, `/scan`, `/b/:id`, `/a/:assetId`, `/account/mfa`) stay as-is but resolve under `/scanner/*`.
- Catch-all still `Navigate to="/"` (resolves to `/scanner/`).

`src/App.tsx`
- No change to the `isScannerShell()` gate — it already short-circuits to `<ScannerApp />`.

`src/pages/ScanQR.tsx`
- Confirm the "Back" button uses `navigate('/')` (relative within the scanner BrowserRouter — resolves to `/scanner/`). No edit expected unless it hardcodes a path.

## PWA manifest & install identity

`public/manifest-scanner.webmanifest`
- `start_url: "/scanner/"`
- `scope: "/scanner/"`
- `id: "/scanner/"`
- Keep distinct `name`, `short_name`, icons, theme color so it installs as its own home-screen app independent of the ERP PWA.

`index.html`
- Inline manifest-swap script: swap to scanner manifest when `location.pathname.startsWith('/scanner')` (instead of `host.startsWith('scan.')`). Also swap `<title>` + `theme-color` the same way.

## Auth / session

- No `cookieOptions.domain` change needed — same origin.
- `src/integrations/supabase/client.ts` stays on `localStorage` with the existing `lgh-erp-auth` storage key, so a user signed into stores.lgh.lk is already signed into `/scanner` and vice-versa.

## Domain cleanup

- In Project Settings → Domains, you can remove `scan.lgh.lk` (or leave it pointing at Lovable — it will just 301 to `stores.lgh.lk/`, which is harmless).
- New install URL: `https://stores.lgh.lk/scanner/` — Add to Home Screen there to get the standalone "LGH Scanner" icon.

## QR payloads — intentionally unchanged

`src/utils/binQRPayload.ts` and `src/utils/assetQRPayload.ts` keep `https://stores.lgh.lk/b/{id}` and `/a/{id}`. Reasons:
1. Already-printed QR labels in the field keep working — no reprint required.
2. Opening a `stores.lgh.lk/b/...` link inside the installed Scanner PWA (scope `/scanner/`) falls outside scope, so the browser opens it in a normal tab. That's the correct behavior for QR scans done with the phone's native camera — the user lands on the public bin/asset page, can sign in, and acts.
3. Inside the Scanner PWA itself, the in-app camera scanner (`/scanner/scan`) decodes the QR and routes internally to `/scanner/b/:id` or `/scanner/a/:assetId` — handled by a tiny rewrite in `ScanQR.tsx`'s "navigate to result" handler (strip the `https://stores.lgh.lk` prefix and prepend `/scanner` when the host matches).

## Verification

1. Desktop `stores.lgh.lk/warehouse/item-bin-master` — full ERP unchanged.
2. Desktop `stores.lgh.lk/scanner/` — Scanner home (two cards), no sidebar, no ERP nav.
3. iPhone Safari → `stores.lgh.lk/scanner/` → Share → Add to Home Screen → app launches into Scanner home; icon labeled "LGH Scanner", separate from any ERP PWA install.
4. Sign in inside the Scanner PWA → stays at `/scanner/` (no redirect to `/`).
5. In-app scan of a printed bin QR → opens `/scanner/b/:id` with the adjust-stock dialog auto-open.
6. Native camera scan of the same printed QR → opens `stores.lgh.lk/b/:id` in a normal browser tab (existing public flow).

## Out of scope

- No DB migrations, RPC changes, RLS, or edge function edits.
- No new icons unless the user wants different artwork.
- No removal of `scan.lgh.lk` from DNS (user can do it later in Project Settings).
