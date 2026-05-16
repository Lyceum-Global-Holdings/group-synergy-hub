## Problem

When filtering Inventory by **Lyceum Fulfilment Centre (LFC)**, the item `INV-ELC-000-0185` (Conduit Bend) shows bin **LNQ (50)** — even though that bin physically lives in **Lyceum Nugegoda Quarters (LNQ)**, a completely separate top-level location, not a child of LFC.

### Root cause

`warehouse_bin_allocations` rows have a `location_id` that is **out of sync** with their bin's home `warehouse_bins.location_id`:

| bin_code | bin's actual location | allocation.location_id | qty |
|---|---|---|---|
| LNQ | Lyceum Nugegoda Quarters | **Lyceum Fulfilment Centre** ❌ | 50 |
| LNQ-BOX | Lyceum Nugegoda Quarters | LNQ ✓ | 7 |
| LNPE | LNPE | LNPE ✓ | 80 |

There are **80 such mismatched allocation rows** across the system today. The `list_warehouse_inventory` RPC scopes by `a.location_id` (the allocation row) instead of `wb.location_id` (the bin's home), so a bin physically in LNQ leaks into LFC's view whenever its allocation row was written with the wrong location.

This matches the same class of data-integrity bug fixed earlier for the NWS-VEB bin (wrong `location_id` + missing `company_id`).

## International-standards solution

In every reference WMS (SAP EWM, Oracle WMS, Manhattan, Blue Yonder), a **bin has exactly one home storage location**, and stock balances per (item, bin) inherit that location — they are never allowed to drift. We will enforce the same invariant.

### Steps

1. **Reconcile data (one-off migration)**
   - For every `warehouse_bin_allocations` row where `a.location_id <> wb.location_id`, set `a.location_id = wb.location_id`.
   - Same for `a.company_id` where it disagrees with the bin's `company_id` (defence in depth).

2. **Enforce parity going forward**
   - Add a trigger `enforce_bin_allocation_location_parity` on `warehouse_bin_allocations` (BEFORE INSERT OR UPDATE) that:
     - Looks up the bin's `location_id` and `company_id`.
     - Forces `NEW.location_id` and `NEW.company_id` to match the bin (write-through), so callers cannot create drift even by accident.
   - Add a trigger on `warehouse_bins` (AFTER UPDATE OF location_id) that cascades the new home into all child allocations, so moving a bin moves its stock with it (matches WMS bin-relocation semantics).

3. **Make the RPC trust the bin, not the allocation row**
   - In `list_warehouse_inventory`, change `scoped_alloc_full` to join `warehouse_bins` and filter/aggregate by `wb.location_id` (and use `wb.location_id` in the `bins` JSONb's `location_id` / `location_name`). Allocation row's `location_id` becomes a denormalised mirror only.
   - Apply the same change to any sister RPC that scopes stock by location (`list_warehouse_bin_stock`, audit/reconciliation helpers) — quick audit first.

4. **Update memory**
   - Add a Core memory rule: *"Bin home location is the source of truth; `warehouse_bin_allocations.location_id` must always equal `warehouse_bins.location_id` for the same bin (DB trigger enforced). Location-scoped reads filter by `wb.location_id`."*

### Out of scope

- No UI changes — the Inventory table will simply stop showing irrelevant bins once the data and RPC are corrected.
- No FIFO / ledger / write-path changes beyond the parity trigger.
- No changes to the location hierarchy itself (LNQ stays a top-level location; it just won't appear under LFC anymore).

## Verification

After the migration:
- `SELECT COUNT(*) FROM warehouse_bin_allocations a JOIN warehouse_bins wb ON wb.id=a.bin_id WHERE a.location_id <> wb.location_id;` → must return **0**.
- Re-open Inventory filtered by LFC → `INV-ELC-000-0185` no longer shows the LNQ bin.
- Filter by LNQ → both LNQ and LNQ-BOX bins appear with correct totals.
- Attempt to insert an allocation with a mismatched `location_id` → trigger silently corrects it (or raises, depending on chosen mode; recommend silent write-through to stay backward compatible with existing write paths).
