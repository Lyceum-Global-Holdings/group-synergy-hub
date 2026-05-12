# Move Bin Allocations under Warehouse

Today, Bin Allocations lives as a tab inside `/warehouse/item-bin-master` alongside Item Master, Bin Master, Categories, and Units. Bin Allocations is operationally distinct (item-to-bin mapping with stock quantities, QR labels, scoping by warehouse/location) and is used by warehouse operators rather than master-data maintainers. Aligning with WMS conventions (SAP EWM "Storage Bin / Product Assignment", Oracle WMS "Item-Locator", Manhattan "Slotting & Bin Item") it deserves its own navigable module.

## Scope

Move the Bin Allocations functionality out of the Item & Bin Master tab group into its own route and sidebar entry under Warehouse. No business logic changes.

## Changes

1. **New route**: `/warehouse/bin-allocations` rendering a thin page wrapper around the existing `BinAllocationsTab` component (kept as-is to preserve the warehouse/location scoping, search, bulk QR, and delete behavior already shipped).
   - Add `src/pages/warehouse/BinAllocations.tsx` with header (title + description) and `<BinAllocationsTab />` body.
   - Register lazy route in `src/App.tsx` next to other `/warehouse/*` routes.

2. **Sidebar registration**: In `src/constants/moduleConfig.ts`, add a new submodule under `warehouse.subModules` immediately after `item-bin-master`:
   - `{ key: 'bin-allocations', name: 'Bin Allocations', description: 'Item-to-bin assignments and quantities', url: '/warehouse/bin-allocations' }`

3. **Remove the tab** from `src/pages/warehouse/ItemBinMaster.tsx`:
   - Drop the `BinAllocationsTab` lazy import, the `TabsTrigger`, and the `TabsContent` block.
   - Reduce `TabsList` from `grid-cols-5` to `grid-cols-4`.
   - Update the `onNavigateToBins` handler passed to `ItemMasterDefinitionTab` to `navigate('/warehouse/bin-allocations')` instead of switching local tab state, so existing "View bins" affordances continue to work.

4. **RBAC / access**: The new submodule key `bin-allocations` will need to be granted to roles. Out of the box it inherits the same access surface as Item & Bin Master via the module registration; admins can refine via `/admin/module-allocation`. No DB migration required (RBAC is keyed by submodule key in `rbacConfig`/role grants UI).

5. **Backwards compatibility**: Keep the deep-link behavior intact. Anyone bookmarked to `/warehouse/item-bin-master` and clicking the (now removed) Allocations tab won't crash — the tab simply no longer exists, and the new sidebar entry is the discoverable path. No redirect needed since the old tab was internal state, not a URL.

## Out of scope

- No changes to `BinAllocationsTab.tsx` internals (search, scoping badge, bulk QR PDF, delete dialog).
- No changes to `bulkBinQRCodePdf.ts`, `binQRPayload.ts`, public bin QR resolver, or DB/RPC.
- No changes to other tabs (Item Master, Bin Master, Categories, Units).
- No rename of the existing `item-bin-master` route or page title.

## Technical notes

- Lazy-load the new page via `lazy(() => import('@/pages/warehouse/BinAllocations'))` consistent with sibling warehouse routes.
- Memory `mem://architecture/module-registration-config` requires registering new modules in `moduleConfig.ts` — covered in step 2.
- The `BinAllocationsTab` component already consumes `useLocationFilter` for global header scoping, so it works identically when rendered as a standalone page.
