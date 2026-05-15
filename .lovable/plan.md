# Partial Quantities — Import Holdings

## Goal
Allow users to bulk-import partial-quantity holdings into the Partial Quantities module via CSV/Excel, creating or topping-up bin allocations (and batches when applicable) with one row per (item × location × bin × batch). Aligns with SAP EWM putaway and GS1 CBV inventory event semantics.

## UX

Add an **Import** button next to **Export CSV** on `/warehouse/partial-quantities` that opens `ImportPartialQuantitiesDialog`. Five-step wizard reusing the existing bulk-import shell:

```text
1. Download template  →  2. Upload file  →  3. Validate & preview  →  4. Confirm  →  5. Result summary
```

- Template button generates a CSV (and XLSX) with columns + 2 sample rows + an inline instructions sheet.
- Drag-and-drop area; CSV via existing `parseCSV` (`src/lib/bulkImport/csvParser.ts`), XLSX via existing `xlsx` skill path used by other importers.
- Preview shows per-row status badges (`ok`, `new bin`, `new batch`, `item not found`, `bin not found`, `qty invalid`, `duplicate row`) with inline error text.
- Filter chips: All / Errors only / Warnings only. Disable **Confirm Import** while any row is in error.
- Honors the global Location filter: if a row omits `location_code`, the active location is used; mismatch with global filter is flagged as a warning, not blocked.

## Template columns

Required marked *. Order tolerant (header-based).

| Column | Type | Notes |
|---|---|---|
| `item_code` * | text | Resolved against `warehouse_items` for the company |
| `location_code` * | text | Resolved against `warehouse_locations`; leaf-level only |
| `bin_code` * | text | Resolved within the location; auto-create allowed via opt-in checkbox |
| `quantity` * | numeric ≥ 0 | Base UoM, up to 4 decimals |
| `secondary_quantity` | numeric | Required only when item has `track_secondary_quantity` |
| `batch_number` | text | Required when item `is_batch_tracked` |
| `manufacture_date` | ISO 8601 (YYYY-MM-DD) | GS1 AI (11) |
| `expiry_date` | ISO 8601 (YYYY-MM-DD) | GS1 AI (17); required if item enforces shelf life |
| `unit_cost` | numeric | Optional; defaults to item master cost |
| `received_at` | ISO 8601 datetime | Used for FIFO ordering; default `now()` |
| `reference` | text | e.g. GRN/ASN/PO; copied to ledger |
| `notes` | text | Free text; copied to ledger |
| `mode` | `add` \| `set` | Per-row: top-up the holding or set absolute on-hand. Default `add` |

## Validation rules
- Trim, case-insensitive code matching; reject ambiguous matches.
- Quantity > 0 for `add`; ≥ 0 for `set` (set 0 effectively zero-outs that bin/batch row).
- Composite uniqueness within the file: collapse duplicate (item, location, bin, batch) rows with a warning showing the merged total.
- Item flags enforced: batch-tracked → batch_number required; serialized items rejected (use Putaway, not partial qty).
- Reject negative inventory results.
- Date sanity: `manufacture_date ≤ received_at ≤ expiry_date`.
- RBAC: requires `warehouse.material_receipt.create` (or `warehouse.bin_allocation.write`); per-location grants enforced.

## Backend

One new SECURITY INVOKER RPC (matches `list-rpc-pattern` and reuses ledger triggers):

`import_partial_quantities(p_company_id uuid, p_rows jsonb)` returns `jsonb` with `{ inserted, updated, batches_created, errors[] }`.

Per row, in a single transaction:
1. Resolve `warehouse_item_id`, `location_id`, `bin_id` (auto-create bin only if `p_allow_create_bin = true`, audited).
2. If batch_tracked: upsert into `warehouse_batches` keyed by `(warehouse_item_id, batch_number, location_id)`.
3. Upsert `warehouse_bin_allocations` row keyed by `(warehouse_item_id, location_id, bin_id, batch_id)`.
   - `mode='add'`: `allocated_quantity = allocated_quantity + p_qty`.
   - `mode='set'`: `allocated_quantity = p_qty` (delta computed for ledger).
4. Insert one `stock_transactions` row per delta with `transaction_type='receipt'` (positive) or `'adjustment'` (when `set` decreases stock), reason `import`, GS1 CBV event `ObjectEvent / ADD` or `DELETE`. Trigger `set_stock_transaction_balances` writes qty before/after.
5. RAISE EXCEPTION on first hard error to roll back the whole import — returns the failing row index in the response.

Response is surfaced to the dialog summary (counts + downloadable error CSV that mirrors the input plus an `error` column).

## Files

New
- `src/components/warehouse/partial-qty/ImportPartialQuantitiesDialog.tsx`
- `src/components/warehouse/partial-qty/importTemplate.ts` (CSV/XLSX template + column defs)
- `src/hooks/warehouse/useImportPartialQuantities.ts`
- `supabase/migrations/<ts>_import_partial_quantities.sql` (RPC + audit columns if needed)

Edited
- `src/pages/warehouse/PartialQuantities.tsx` — add **Import** button + dialog mount + invalidation on success.

## International standards alignment
- **GS1 CBV** event types and AIs (10 batch, 11 mfg, 17 expiry, 310n qty) drive column semantics and ledger reason codes.
- **SAP EWM / Oracle WMS** putaway grain: holdings keyed by item × storage bin × batch.
- **ISO 8601** for all dates; **ISO 4217** unaffected (cost stays in company currency).
- **Immutable ledger** via existing `stock_transactions` triggers (per `stock-ledger-immutable-balances` memory); no direct edits to balances.
- **RLS** preserved — RPC is SECURITY INVOKER and respects company + location scoping.

## Out of scope (phase 1)
- Serial number capture (route those items through Putaway).
- ASN / EDI ingestion.
- Auto-create of items or locations (bins are opt-in only).
