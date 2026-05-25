# Scanner PWA at `scan.lgh.lk`

A focused, installable mobile shell exposing only two actions — **Scan to adjust stock** and **Scan to move asset** — served from a new subdomain. Same codebase, same Supabase backend, same auth session. The existing full ERP at `stores.lgh.lk` is unchanged.

## How it works

When the browser hits `scan.lgh.lk`, `App.tsx` mounts a minimal `<ScannerApp />` router instead of the full ERP. Everything else (RLS, RPCs, scan dialogs, Turnstile, MFA) is reused as-is.

```text
scan.lgh.lk
  /            ScannerHome      → two big tap cards
  /scan        ScanQR           → reuses existing scanner with ?intent
  /b/:id       PublicBinAllocation + auto-open Adjust dialog
  /a/:id       PublicAssetView   + auto-open Move dialog
  /asset/:id   alias (legacy printed labels)
  /login       Auth (shared .lgh.lk cookie)
  *            redirect → /
```

## Files

**New**
- `src/scanner/ScannerApp.tsx` — minimal router + layout (no sidebar, no module nav, mobile-first).
- `src/scanner/ScannerLayout.tsx` — top bar with company/location switch + sign-out only.
- `src/pages/scanner/ScannerHome.tsx` — two cards: "Scan to adjust stock" (`ScanLine`), "Scan to move asset" (`PackageCheck`). Tap → `/scan?intent=adjust-stock|move-asset`.
- `public/manifest-scanner.webmanifest` — `name: "LGH Scanner"`, `short_name: "Scanner"`, `id: "/?app=scanner"`, `start_url: "/?app=scanner"`, `scope: "/"`, `display: "standalone"`, `theme_color` matching brand, dedicated icon set.
- `public/scanner-icon-192.png`, `public/scanner-icon-512.png` — generated icons (distinct from main ERP icons so the home-screen tile is recognisable).

**Edited**
- `src/App.tsx` — at boot, detect `window.location.hostname === 'scan.lgh.lk'` (or `?app=scanner` for PWA-installed launches). If true, render `<ScannerApp />`; else render today's full app. No other change.
- `index.html` — small inline script before `<link rel="manifest">` that swaps `href` to `/manifest-scanner.webmanifest` when the host matches. Update `<title>` and `theme-color` conditionally for the scanner host.
- `src/integrations/supabase/client.ts` — set auth `cookieOptions.domain = '.lgh.lk'` so a single sign-in works on both hosts. Guarded so localhost / preview / `.lovable.app` keep current behaviour.
- `src/pages/Auth.tsx` — after successful login, if `window.location.hostname === 'scan.lgh.lk'`, redirect to `/` (Scanner home) instead of the dashboard.

**Unchanged but reused**
- `src/pages/ScanQR.tsx` — already supports `?intent=adjust-stock|move-asset`; the scanner shell just lands users here.
- `src/pages/PublicBinAllocation.tsx`, `src/pages/PublicAssetView.tsx` — already auto-open the right dialog from `?action=`.
- All warehouse RPCs, RLS, edge functions, Turnstile, MFA — zero changes.

## Auth & session

Single sign-on across both hosts via cookie domain `.lgh.lk`. A user signs in once (on either host) and the Supabase session is visible to the other. No new auth flow, no new tables.

## Module access

Scanner shell calls the same `useModuleAccess` checks already enforced inside the bin/asset RPCs. If a user lacks warehouse or asset access, the dialogs reject server-side — no client-side bypass risk.

## Out of scope

- No new tables, migrations, RPCs, or edge functions.
- No native iOS/Android app.
- No offline scan queue / BarcodeDetector fast path (can be added later).
- No new permissions or RBAC changes.

## DNS / publish steps (user-side)

1. After this code change is published, open **Project Settings → Domains → Connect Domain** and add `scan.lgh.lk`.
2. Add an A record `scan` → `185.158.133.1` at the registrar (same target as `stores.lgh.lk`).
3. Wait for SSL provisioning (usually minutes).
4. On iPhone Safari → open `https://scan.lgh.lk` → **Share → Add to Home Screen**. The "LGH Scanner" tile appears separately from the main ERP app.

## Verification

- Desktop `stores.lgh.lk/warehouse/item-bin-master` — unchanged, still shows full ERP.
- Desktop `scan.lgh.lk/` — shows Scanner home with two cards only, no sidebar.
- iPhone PWA installed from `scan.lgh.lk` — launches into Scanner home, scans bin QR → Adjust dialog opens; scans asset QR → Move dialog opens; wrong-type scan shows the existing mismatch alert.
- Sign in on `stores.lgh.lk`, then open `scan.lgh.lk` in the same browser — already signed in (shared cookie).
