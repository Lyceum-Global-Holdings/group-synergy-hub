## Goal

Allow a single physical bin to hold stock owned by **multiple companies** at the same time, while keeping the bin pinned to **one physical location** (SAP EWM "Storage Bin + Party Entitled to Dispose" model, also used by Oracle WMS and Manhattan WMS).

Location parity stays intact. Only **company parity** is relaxed, and only for bins explicitly marked as shared.

## Standards we're aligning to

- **SAP EWM**: Storage Bin belongs to one Warehouse / Storage Type / Storage Section. Stock in the bin is tracked per *Party Entitled to Dispose* (owner) and *Stock Type*.
- **GS1 / WMS**: A Logical Handling Unit (bin) is physical; ownership is an attribute of the stock, not of the bin.
- **3PL convention**: Shared racking — one bin, many customers/owners.

## Data model changes

`warehouse_bins`
- Add `is_shared boolean NOT NULL DEFAULT false`.
- When `is_shared = true`, `warehouse_bins.company_id` is treated as the *operator* of the bin (the warehouse owner), not the only allowed stock owner.
- When `is_shared = false`, current behavior is preserved (single-owner bin).

`warehouse_bin_allocations`
- `company_id` becomes the **stock owner** (Party Entitled to Dispose). Stays NOT NULL, mandatory on every row.
- `location_id` continues to equal `warehouse_bins.location_id` (unchanged parity).
- Drop the old uniqueness `(bin_id, warehouse_item_id)` and replace with `(bin_id, warehouse_item_id, company_id)` (plus existing batch dimension if present) so multiple companies can co-occupy the same bin/item slot.

## Trigger changes

1. `enforce_bin_allocation_location_parity()` — only force `NEW.company_id := bin.company_id` when the bin is **not** shared. For shared bins, keep the caller's `company_id`.
2. `validate_bin_allocation_location()` — keep location forcing; for shared bins, require `NEW.company_id` to be a company the caller can access (`can_access_company(NEW.company_id)`).
3. `cascade_bin_relocation_to_allocations()` — keep location cascade; do **not** overwrite `company_id` on shared bins when the bin operator changes.
4. `sync_item_stock_from_bins()` — already aggregates per item; verify it groups per `(warehouse_item_id)` correctly given a `warehouse_item` row is per-company. For shared bins, the item rows of *each* owner company are updated independently from their own allocation rows.

## RPC + write-path changes

- New RPC `set_bin_sharing(_bin_id uuid, _is_shared boolean)` — restricted to admins of the bin's operator company.
- New RPC `add_shared_bin_allocation(_bin_id, _warehouse_item_id, _owner_company_id, _qty, _batch_id)` — validates `can_access_company(_owner_company_id)`, that the bin is shared, and that the item belongs to `_owner_company_id`. Returns the allocation row.
- `adjust_bin_allocation_from_scan` and putaway/transfer write paths: when destination bin `is_shared`, accept an explicit owner `company_id` (default = caller's active company).
- `list_bins_at_location` already returns bins; add `is_shared` to the projection so pickers can render owner selectors.

## RLS

- `warehouse_bin_allocations` SELECT policy keeps `can_access_company(company_id)` — naturally limits each user to rows their company owns, even in a shared bin. No leakage between tenants.
- `warehouse_bins` SELECT stays operator-scoped; sharing is a property of the bin, not a visibility change.

## UI changes (minimal, scoped)

- **Bin master** (`ItemBinMaster` / bin detail): "Shared bin (multi-owner)" toggle → calls `set_bin_sharing`. Shows a small badge "Shared" on shared bins.
- **Bin Allocations tab**: add an "Owner" column that renders `company.name`; group rows by item and split per owner.
- **Putaway / Add stock / Transfer destination**: when the chosen bin is shared, show an "Owner company" selector (default = current company; options = companies the user can access). For non-shared bins the selector is hidden and behavior is unchanged.
- **Public bin QR page**: show per-owner sub-totals in addition to bin total.
- **Inventory tab**: `list_warehouse_inventory` already groups per `warehouse_items` row (one per company), so each owner sees only their own quantities — no change required beyond pulling shared-bin chip labels.

## Backfill / migration safety

- Default `is_shared = false` for all existing bins → zero behavior change for existing data.
- Existing uniqueness violation risk: none, because allocations today are single-owner per bin/item; the new composite key is a superset.
- Reconciliation rule unchanged: `(company, item, location, bin)`.

## Validation after migration

- `EXPLAIN ANALYZE list_warehouse_inventory` for the affected company — no regression.
- Insert an allocation into a shared bin from Company A and Company B for the same item → both rows persist, each company's Inventory tab shows only its own quantity, public bin QR shows both with owner labels.
- Insert into a non-shared bin from a foreign company → rejected by the parity trigger (regression guard).

## Memory updates

- Update `bin-allocation-location-parity` memory: location parity strict; company parity strict **only when `is_shared = false`**.
- Add new memory `multi-owner-shared-bins` describing the standard, the `is_shared` flag, and the owner-selector UI rule.

## Files we'll touch (build phase)

- New migration: add column, replace unique index, rewrite the 3 triggers, add 2 RPCs.
- `src/components/warehouse/BinAllocationsTab.tsx` — Owner column.
- `src/components/warehouse/ItemBinMaster*` — Shared toggle + badge.
- Putaway / Add-stock / Transfer destination dialogs — owner selector when bin is shared.
- `src/hooks/warehouse/useBinsAtLocation.ts` — surface `is_shared`.
- `src/pages/PublicBinAllocation.tsx` — per-owner grouping.
- Memory files under `.lovable/memory/architecture/`.

No changes to inventory pagination, RBAC framework, or stock-ledger triggers.
