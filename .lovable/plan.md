## Goal
Remove the redundant "Import from Catalog" button from the Item Master tab. The "Bulk add from catalog" action on the Inventory page (`bulk_provision_inventory_from_catalog` RPC + grid dialog) already covers this workflow.

## Changes

**`src/components/warehouse/ItemMasterTab.tsx`**
- Remove the `<Button>` at line 545 ("Import from Catalog").
- Remove the `isImportCatalogOpen` state (line 139) and its Suspense block (lines 1022–1029).
- Remove the lazy import of `AddFromCatalogDialog` (lines 63–65).
- Remove the now-unused `PackagePlus` icon from the lucide-react import (line 6) if not referenced elsewhere in the file.

**`src/components/warehouse/AddFromCatalogDialog.tsx`**
- Delete the file (no remaining consumers after the removal above).

## Out of scope
- No changes to the Inventory page's "Bulk add from catalog" flow, RPC, or grid dialog.
- No backend / RLS / RPC changes.
