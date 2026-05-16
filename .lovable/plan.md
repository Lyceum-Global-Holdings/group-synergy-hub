# Fix: NWS-VEB bin not visible under VEB sub-location

## Root cause

In `warehouse_bins`, the bin `NWS-VEB` (`ba8ccc12-980f-4037-8d37-b8d6fbfa9cdb`) is attached to the **warehouse root** `Lyceum Fulfilment Centre` (`de0c4bd9…`), not to the **VEB** sub-location (`0630cfec…`). Its 20 allocations carry `location_id = LFC root`, so when `list_warehouse_inventory` is scoped to VEB it correctly excludes them.

- VEB direct allocations: 167 items (128 with qty > 0)
- NWS-VEB bin allocations: 20 items, all tagged at LFC root, none overlapping with VEB
- Expected visible at VEB: 128 (in-stock) + the additional NWS-VEB items once re-parented

This is a **data placement issue**, not an RPC bug. Per the project's location-hierarchy rule, bins may attach to a Warehouse or Sub-location — when a bin's purpose is a specific sub-location (as the `NWS-VEB` naming implies), it must be attached there. International WMS practice (SAP EWM Storage Type/Section, Manhattan SCALE Area→Zone→Location, Oracle WMS Sub-inventory→Locator) requires each storage bin to belong to exactly one storage section; cross-section roll-up is by hierarchy, not by string matching.

## Plan

### 1. Data fix migration (single transaction)

- Re-parent the bin:
  - `UPDATE warehouse_bins SET location_id = '0630cfec-…VEB' WHERE id = 'ba8ccc12-…NWS-VEB'`
- Realign its allocation scope so RPC filters by sub-location work:
  - `UPDATE warehouse_bin_allocations SET location_id = '0630cfec-…VEB' WHERE bin_id = 'ba8ccc12-…' AND location_id = 'de0c4bd9-…LFC'`
- Stock ledger: 0 affected `stock_transactions` rows for this bin/location pair (verified) — nothing to migrate.
- Audit row in `system_audit_log` recording the bin relocation, old/new location ids, affected allocation count.

### 2. Acceptance

- `/warehouse/inventory` with **LFC → VEB** selected, default Stock filter:
  - "In Stock" returns 128 + NWS-VEB in-stock items
  - "All" returns 167 + NWS-VEB items
- LFC parent totals unchanged (bin stays inside LFC sub-tree).
- No regression on other warehouses or bins; no schema change.

### 3. Guardrail (frontend only, optional but recommended)

In the bin create/edit dialog (`src/components/warehouse/bins/...`):
- When the entered `bin_code` starts with `<PREFIX>-` and a sibling sub-location whose `name = PREFIX` exists under the chosen warehouse, show an inline hint: "Attach this bin to sub-location `<PREFIX>` instead of the warehouse root?" with a one-click switch.
- Pure UX nudge; does not block users who intentionally want a warehouse-wide bin.

### 4. Out of scope (call out, do not change now)

- Many other bins (`1-B-2-1`, etc.) are also attached at LFC root rather than a sub-location. Not touched here — a separate audit + bulk re-parenting exercise should be planned with the warehouse owner before mass updates.
- No changes to `list_warehouse_inventory`, RLS, FIFO, or stock movement logic.

## Technical notes

- Migration uses `supabase--migration` (schema-class change touches one bin row + ~19 allocation rows; safe, transactional).
- Memory updates after apply:
  - Reinforce existing `mem://architecture/warehouse-location-hierarchy`: "Bins named `<SUBLOC>-<X>` must attach to that sub-location, not the warehouse root."
