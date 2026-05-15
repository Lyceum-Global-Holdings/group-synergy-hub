## Goal

Replace the current "Partial Quantities = bin allocations view" with a true **Remnant Registry** (a.k.a. cut-piece / offcut management — SAP IS-Mill, GS1 CBV "Variable Measure Trade Item" pattern). Each row = one physical leftover piece of a parent item, sized in a secondary UOM (e.g. wire 2.30 m, 4.75 m, 1.10 m all from item `WIRE-CU-2.5`).

Inventory `warehouse_bin_allocations` and `current_stock` are **not** touched by this module's CRUD. Only consumption optionally posts a parent-stock adjustment (configurable per action), and that goes through the existing `stock_transactions` ledger so audit stays unified.

## Data model

New table `warehouse_partial_pieces` (company-scoped, RLS):

| column | notes |
|---|---|
| `id` uuid PK | |
| `company_id` uuid NOT NULL | tenant scope |
| `piece_code` text NOT NULL | auto `PQ-YYYYMMDD-NNNN` if user leaves blank; UNIQUE per company |
| `parent_item_id` uuid → `warehouse_items` | the master item the offcut came from |
| `size_value` numeric(14,4) NOT NULL CHECK > 0 | the piece dimension |
| `size_uom` text NOT NULL | secondary UOM (m, mm, kg, m², …) — defaults from item's `secondary_uom` |
| `location_id` uuid → `warehouse_locations` | required |
| `bin_id` uuid → `warehouse_bins` NULL | optional storage bin |
| `status` enum `available\|reserved\|consumed\|scrapped` default `available` |
| `source_ref` text NULL | "GRN-123 / WO-77 / Issue-9" — where the remnant came from |
| `batch_number` text NULL | optional carry-over for traceability |
| `unit_cost` numeric(14,4) NULL | inherited from parent for valuation |
| `label` text NULL | free-text tag ("Reel-A offcut") |
| `notes` text NULL | |
| `created_by`, `created_at`, `updated_at` | standard |
| `consumed_at`, `consumed_by`, `consumed_qty`, `consumed_reason` | filled when status moves to consumed/scrapped |

Constraints & indexes:
- `(company_id, piece_code)` unique
- partial index on `(company_id, parent_item_id) WHERE status = 'available'` for fast pickers
- `(company_id, location_id, status)` index for the grid

## RPCs (SECURITY INVOKER, company-scoped)

1. `list_partial_pieces(p_company_id, p_location_id, p_status, p_search, p_limit, p_offset)` — flat rows with parent item code/name, location/bin name, size + UOM, status, age days.
2. `create_partial_piece(p_payload jsonb)` — single insert, auto piece_code if null, defaults UOM/cost from parent item.
3. `update_partial_piece(p_id, p_payload jsonb)` — edit only when `status = 'available'`; immutable fields once consumed.
4. `delete_partial_piece(p_id)` — soft block if `status != 'available'`.
5. `consume_partial_piece(p_id, p_quantity, p_reason, p_post_to_stock bool, p_reference, p_notes)` — flips status (full vs. partial: if partial we split — see below), and **optionally** writes one `stock_transactions` row (`transaction_type='issue'`, negative `quantity_change`) against the parent item/location so the parent's on-hand reflects consumption.
6. `split_partial_piece(p_id, p_first_size, p_second_size)` — physical re-cut; archives original as consumed, creates two new pieces summing to original size.
7. `import_partial_pieces(p_company_id, p_rows jsonb)` — bulk add; same atomic pattern already used in current import.

Partial consumption: if `p_quantity < size_value`, the RPC marks the original consumed and auto-creates one residual piece of `size_value − p_quantity` with a new auto code, linked via `source_ref`.

## UI

Route stays `/warehouse/partial-quantities`. Page rebuilt:

- **Header**: title "Partial Pieces (Remnants)", filters (parent item picker, location, status), Search, Add Piece, Import, Export.
- **Grid** (VirtualTable): `Piece Code | Parent Item | Size × UOM | Location / Bin | Status | Age | Source | Actions(Edit, Consume, Split, Delete)`.
- **AddPartialPieceDialog**: parent item picker (defaults UOM from item.secondary_uom), size input with UOM dropdown, location/bin, source ref, batch, optional piece_code & label.
- **EditPartialPieceDialog**: same fields, locked when not available.
- **ConsumePartialPieceDialog**: quantity (≤ size), reason (GS1 CBV codes — `consumption`, `scrap`, `sample`, `production`), checkbox "Also reduce parent stock", reference, notes.
- **SplitPartialPieceDialog**: two size inputs, validated to sum = original.
- Import/Export templates updated to the new schema (`piece_code, parent_item_code, size_value, size_uom, location_code, bin_code, source_ref, batch_number, unit_cost, label, notes`).

## Files

New:
- `supabase/migrations/<ts>_partial_pieces.sql` (table, RLS, RPCs, indexes; drops old `list_partial_quantities` / `issue_partial_quantity` / `import_partial_quantities`)
- `src/types/partialPiece.ts`
- `src/hooks/warehouse/usePartialPieces.ts` (list, create, update, delete, consume, split, import)
- `src/components/warehouse/partial-qty/AddPartialPieceDialog.tsx`
- `src/components/warehouse/partial-qty/EditPartialPieceDialog.tsx`
- `src/components/warehouse/partial-qty/ConsumePartialPieceDialog.tsx`
- `src/components/warehouse/partial-qty/SplitPartialPieceDialog.tsx`
- `src/components/warehouse/partial-qty/importTemplate.ts` (rewritten)
- `src/components/warehouse/partial-qty/ImportPartialPiecesDialog.tsx` (rewritten)

Edited:
- `src/pages/warehouse/PartialQuantities.tsx` — full rewrite to new model
- `src/constants/moduleConfig.ts` — submodule label "Partial Pieces"
- `src/integrations/supabase/types.ts` — regenerated post-migration

Deleted:
- `src/components/warehouse/partial-qty/IssuePartialQuantityDialog.tsx`
- `src/components/warehouse/partial-qty/ImportPartialQuantitiesDialog.tsx` (replaced)
- old hook `usePartialQuantities.ts`

## Standards alignment

- **GS1 CBV**: piece = "Variable Measure Trade Item"; reason codes (`consumption`, `scrap`, `sample`) mirror the bin-adjustment RPC.
- **SAP IS-Mill / EWM "remnant management"**: parent material + size attribute + status lifecycle (available → reserved → consumed/scrapped) + split operation.
- **Audit trail**: consumption optionally writes one `stock_transactions` row (existing trigger stamps qty before/after) — keeps a single ledger of truth.
- **RLS**: full company-scoped; `warehouse.partial_piece.{view,create,edit,delete,consume}` RBAC keys (mirrors existing convention).

## Out of scope (phase 1)

Reservations workflow against sales/work orders, multi-dimensional pieces (length × width), barcode label printing — can come in phase 2.
