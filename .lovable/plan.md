# Hide Brand/Supplier/Company columns + speed up Inventory

## Scope
Frontend-only change in `src/components/warehouse/ItemMasterTab.tsx` (the Inventory tab on `/warehouse/inventory`). No DB / RPC changes.

## 1. Hide Brand, Supplier, Company columns

Approach: remove these three columns from the inventory table entirely (header, body cells, column toggle, related filter and CSV export fields). Rationale: the user asked to hide them from the table; removing the dead UI also cuts render cost, which contributes to the speed-up.

Edits in `ItemMasterTab.tsx`:
- `INV_COLUMN_DEFS`: drop `brand`, `supplier`, `company` entries (Columns menu no longer lists them).
- Remove the Supplier `<Select>` filter (and its `supplierFilter`, `uniqueSuppliers`, `companyById`-only-for-column state, `setSupplierFilter` from `clearFilters`, and the `supplierId` arg passed to `useWarehouseItemsLazyInventory`).
- Remove the `<TableHead>` and `<TableCell>` blocks gated by `col('brand')`, `col('supplier')`, `col('company')`.
- Remove the corresponding `Brand`, `Supplier`, `Company` fields from the Excel export builder around line 360.
- Drop now-unused `companyById` if it has no other reader (verify; keep otherwise).

## 2. Speed-ups (lightweight, no schema work)

a. Stop sending `_supplier_id` to the RPC and drop the supplier-derived memos — fewer dependencies on `allItems`, cheaper renders as the list grows.

b. Memo trimming: `uniqueSuppliers` (removed) and `itemLocationStock` already exist; no other change needed there.

c. React Query: this hook currently relies on the global default. Add an explicit `staleTime: 30_000` and `gcTime: 5 * 60_000` to `useInfiniteQuery` in `src/hooks/useWarehouseItemsLazyInventory.ts` so navigating back to Inventory within 30s reuses cache instead of re-running the heavy RPC. (Aligns with the Core rule: 30s SWR default; inventory is not a live hook.)

d. Reduce initial page size from `100` to `50` in `ItemMasterTab` (matches the RPC default and the keyset cursor index assumptions in `Inventory Server Pagination` memory). First paint becomes ~2× faster; the IntersectionObserver still fetches the next page automatically as the user scrolls.

## Out of scope
- No changes to `list_warehouse_inventory` RPC.
- No changes to other tabs (Item Master Definition, Bins, etc.).
- No removal of Brand/Supplier/Company from the create/edit dialogs or detail views — the data still exists, just hidden from the inventory list and filter bar.

## Files
- `src/components/warehouse/ItemMasterTab.tsx`
- `src/hooks/useWarehouseItemsLazyInventory.ts`
