## Goal

Let an operator move an existing bin from one warehouse/sub-location to another while keeping inventory totals, allocations, and the stock ledger consistent.

## Two relocation modes (operator picks one)

1. **Move bin with its stock** — the physical bin (and everything in it) is wheeled to a new node. All `warehouse_bin_allocations` for the bin update `location_id` to the new node. No quantity changes. A single `bin_relocation` ledger entry per affected item records source/destination location for traceability.
2. **Move empty bin only** — refuses to run if any allocation on the bin has `allocated_quantity > 0`. Operator must transfer/issue stock out first. Bin's `location_id` updates, no allocation rows touched.

This matches SAP EWM "Storage Bin Move" + Oracle WMS "Bin Transfer" patterns.

## Constraints enforced server-side

- Destination must be a `warehouse` or `sublocation/department` in the same `company_id` as the bin.
- Destination must be different from current `location_id`.
- For "with stock" mode: the destination's root warehouse must be reachable (no cross-company moves). If user wants cross-company, that's a transfer order — out of scope here.
- Caller must have edit access on both source and destination locations (existing `can_access_company` + location permissions).

## Implementation

### 1. Migration

**RPC `relocate_warehouse_bin(_bin_id uuid, _new_location_id uuid, _mode text, _reason text)`** — SECURITY DEFINER, returns jsonb summary.
- Validates company match, depth (≤ 2), permission, and mode preconditions.
- Mode `with_stock`:
  - Updates `warehouse_bins.location_id` (and `root_location_id`).
  - Updates every `warehouse_bin_allocations.location_id` for the bin to the new node.
  - Inserts a `stock_transactions` row per item with `transaction_type='bin_relocation'`, `quantity=0`, source/destination location_ids in metadata, reason text. The existing ledger trigger leaves qty_before/after equal because allocation totals don't change.
- Mode `empty_only`:
  - Hard-fails if `SUM(allocated_quantity) > 0`.
  - Updates `warehouse_bins.location_id` only.
- Writes a `warehouse_bin_relocations` audit row (new table) with: bin_id, from_location_id, to_location_id, mode, reason, performed_by, performed_at, item_count, total_qty.

Add `bin_relocation` to the allowed `stock_transactions.transaction_type` check constraint.

### 2. UI

- **`BinMasterTab` row action**: new "Relocate…" item in the row menu.
- **`RelocateBinDialog`** (new):
  - Header: bin code, current location breadcrumb (Company › Warehouse › Sub).
  - Mode toggle (radio): "Move with current stock" / "Move empty bin only".
  - Destination picker: cascading `Warehouse → Sub-location` from the new `get_location_hierarchy` RPC, restricted to bin's company. Selecting a warehouse means "attach to warehouse root".
  - Stock summary: items + total qty in the bin (shows even in empty_only mode so the user sees what's blocking).
  - Reason (textarea, required).
  - Submit calls the new RPC, invalidates `warehouse-bins`, `warehouse-network-hierarchy`, `bin-allocations-*`, `list_warehouse_inventory` caches.
- **Warehouse Network page**: add a small "Move bin" action surfaced under each warehouse card's bin count tooltip in a follow-up (out of scope this round to keep blast radius small).

### 3. History

New tab on `BinMasterTab` row (or a side drawer) showing the bin's `warehouse_bin_relocations` history. Minimal: list view with from/to, mode, qty moved, reason, user, timestamp.

## Out of scope

- Cross-company relocations (those go through Stock Transfer).
- Bulk multi-bin relocation (defer; one bin at a time first).
- Auto-merge if the destination already has the same bin code (we don't merge bins; bin codes are unique per company).

## Open question

Should the "with stock" mode require approval (queue an item in Approval Console) for bins above a value/qty threshold, or execute immediately? Defaulting to immediate matches standard WMS pick-list behaviour, but I can wire it through the existing approval RPC if you want a paper trail with sign-off.
