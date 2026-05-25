# In-app QR scanning: Warehouse "Adjust stock" + Asset "Move asset"

The PWA already ships a working `/scan` page (zxing-based camera scanner) and two destination pages:
- `/b/:id` → bin allocation with "Adjust stock" dialog
- `/asset/:assetId` → asset view with "Move asset" (PublicAssetTransferDialog)

What's missing: discoverable in-app entry points from the two modules, intent-aware routing (only accept the right kind of QR), and auto-opening the action dialog after the scan.

## Scope (exactly what the user asked)

1. **Warehouse Management** → single "Scan to adjust stock" entry point
2. **Asset Management** → single "Scan to move asset" entry point
3. No global scan FAB, no other intents

## Design — aligned with international standards

- **QR payload**: GS1 Digital Link URI Syntax v1.4 (already used for bin QR via `buildBinQRPayload`). Add `buildAssetQRPayload` so asset labels become
  `https://stores.lgh.lk/a/{asset_id}?8004={asset_tag}` (AI 8004 = GS1 "Serial shipping container / serialized asset identifier"). Keep the existing `/asset/:id` path as a permanent alias so already-printed labels still resolve.
- **Resolver host**: pinned to `stores.lgh.lk` (per existing project rule — printed labels live for years).
- **Camera**: WebRTC `getUserMedia` with `facingMode: environment`, multi-format decode (ISO/IEC 18004 QR + Code 128 fallback already supported by `BrowserMultiFormatReader`).
- **Privacy**: scanner page already sets `noindex,nofollow`; we keep that.
- **Auth model**: unchanged — public pages render anonymously; the action buttons (Adjust / Move) require sign-in (existing behaviour).

## Changes

### 1. `src/pages/ScanQR.tsx` — intent gating
- Read `?intent=adjust-stock | move-asset` from the URL.
- Update `resolveTarget()` so:
  - `adjust-stock` only accepts `/b/:uuid` (bin allocations); asset codes show a friendly "Wrong code type — scan a bin QR" message.
  - `move-asset` only accepts `/asset/:uuid` and the new `/a/:uuid` GS1 form; bin codes show the inverse message.
  - No intent → current behaviour (accept both).
- After a successful match, append `?action=adjust` or `?action=move` to the target so the destination page auto-opens the right dialog.
- Update the heading/description to reflect the active intent.

### 2. `src/pages/PublicBinAllocation.tsx`
- When `?action=adjust` is present and the user is signed in, auto-open `ScannedBinAdjustmentDialog` once data loads.

### 3. `src/pages/PublicAssetView.tsx`
- When `?action=move` is present and the user is signed in, auto-open `PublicAssetTransferDialog` once data loads.
- Accept the new `/a/:assetId` route as an alias (add a `<Route path="/a/:assetId" element={<PublicAssetView />} />` in `src/App.tsx`).

### 4. Module entry points
- **Warehouse Management** (`src/pages/warehouse/AssetManagement.tsx` is the Asset module — the warehouse "Adjust stock" entry belongs on the bin/stock pages). Add a primary button **"Scan to adjust stock"** in the page header of `src/pages/warehouse/BinAllocations.tsx` (and the same button on `src/pages/warehouse/ItemBinMaster.tsx` since both are stock-adjustment surfaces) that navigates to `/scan?intent=adjust-stock`. Icon: `ScanLine`. Mobile-friendly sizing (`size="sm"` on `md:`, full-width on `sm:`).
- **Asset Management** (`src/pages/warehouse/AssetManagement.tsx`): add **"Scan to move asset"** in the page header → `/scan?intent=move-asset`.
- Both buttons are visible to any signed-in user with module access; the destination dialogs already enforce role/permission checks server-side.

### 5. GS1 asset payload util
- New `src/utils/assetQRPayload.ts` mirroring `binQRPayload.ts`:
  ```ts
  buildAssetQRPayload({ assetId, assetTag })
    → `https://stores.lgh.lk/a/${assetId}?8004=${assetTag}`
  ```
- Update `src/components/warehouse/AssetQRCode.tsx` and `src/utils/bulkQRCodePdf.ts` to use the new helper (replaces hard-coded `group-synergy-hub.lovable.app/asset/...`). Existing printed labels keep working because `/asset/:id` route stays mounted.

### 6. Tiny polish
- ScanQR adds a "Cancel" link back to the originating module when `intent` is set, using `document.referrer` fallback to `/`.

## Out of scope
- Native barcode (`BarcodeDetector`) fast-path — defer; zxing already works on iOS Safari 17+ and all evergreen browsers.
- Offline scan queue — defer.
- New permissions, RLS, RPCs, or migrations — none needed.

## Verification
- iPhone Safari (PWA installed) at `stores.lgh.lk`:
  1. Asset Management → tap "Scan to move asset" → camera opens → scan an asset QR → `/a/:id?action=move` loads → Move dialog auto-opens.
  2. Bin Allocations → tap "Scan to adjust stock" → scan a bin QR → `/b/:id?action=adjust` → Adjust dialog auto-opens.
  3. Scan the wrong type for the active intent → friendly mismatch message, no navigation.
- Desktop Chrome: same flows still work.
- Existing printed `/asset/:id` and `/b/:id` labels (without `?action`) continue to render the read-only card.

## Files touched
- edit: `src/pages/ScanQR.tsx`, `src/pages/PublicBinAllocation.tsx`, `src/pages/PublicAssetView.tsx`, `src/App.tsx`, `src/pages/warehouse/BinAllocations.tsx`, `src/pages/warehouse/ItemBinMaster.tsx`, `src/pages/warehouse/AssetManagement.tsx`, `src/components/warehouse/AssetQRCode.tsx`, `src/utils/bulkQRCodePdf.ts`
- create: `src/utils/assetQRPayload.ts`
