## Goal

Add two warehouse reports for **partial pieces** (SAP EWM Handling Units / GS1 logistic units), aligned with the existing Reports Center pattern at `/management/reports`:

1. **WH-PP-OH-001 — Partial Pieces on Hand** (IAS 2 inventory disclosure, SAP EWM HU view)
2. **WH-PP-MOV-001 — Partial Pieces Movement Ledger** (ISO 8601 period, chronological HU lifecycle)

Both follow the existing `ReportDefinition` → RPC → `useReportData` → `ReportParameterPanel` pipeline, so XLSX / PDF / CSV / Preview all work for free.

## Data model recap (no schema changes)

- `warehouse_partial_pieces` rows = N identical pieces of one size (`piece_count × size_value` in `size_uom`). Statuses: `available | reserved | consumed | scrapped`. Lifecycle timestamps: `created_at` (issue), `consumed_at` + `consumed_qty` + `consumed_reason` (issue/scrap), `parent_piece_id` (split residual).
- No dedicated movement log exists; lifecycle is reconstructed from the row itself. `consume_partial_piece_pieces` also writes a `stock_transactions` row tagged `[partial-piece:<code>]` when `p_post_to_stock=true` — we will reuse that note prefix to link ledger lines back to a HU when present.
- No schema change is needed. Pure read-side additions.

## 1. WH-PP-OH-001 — Partial Pieces on Hand

International framing: IAS 2 §36 (composition of inventory) + SAP EWM HU on-hand snapshot.

### New RPC `public.report_partial_pieces_on_hand`

```
report_partial_pieces_on_hand(
  p_company_id uuid,
  p_location_id uuid default null,
  p_bin_id     uuid default null,
  p_category_id uuid default null,
  p_item_id    uuid default null,
  p_status     text default 'available',   -- 'available' | 'reserved' | 'all'
  p_include_zero boolean default false     -- include piece_count = 0 groups
)
RETURNS TABLE(
  piece_id uuid, piece_code text,
  item_id uuid, item_code text, item_name text,
  category_id uuid, category_name text,
  location_id uuid, location_name text,
  bin_id uuid, bin_code text, bin_name text,
  size_value numeric, size_uom text,
  piece_count integer, original_piece_count integer,
  total_size numeric,             -- size_value * piece_count
  base_uom text, secondary_uom text,
  unit_cost numeric, stock_value numeric,  -- total_size * unit_cost
  batch_number text, source_ref text, label text,
  status text, age_days integer, created_at timestamptz
)
```

Source: `warehouse_partial_pieces` LEFT JOIN `warehouse_items_full` (master fields per Core memory) + `item_categories` + `warehouse_locations` + `warehouse_bins`.
Filters: `company_id = p_company_id`, status filter, optional location/bin/category/item, `piece_count > 0` unless `p_include_zero`.
Order: `item_code, piece_code`.

### Registry entry

- Group: "Inventory", standard: "IAS 2 / SAP EWM HU".
- Parameters: Location, Bin (depends on Location — reuses the `bin` param type already added for Stock on Hand), Category, Status select (Available default / Reserved / All), Include depleted toggle.
- Columns: Piece Code · Item Code · Item Name · Category · Location · Bin · Size · UoM · Pieces · Total · Unit Cost · Stock Value · Batch · Status · Age (days).
- Totals row: `piece_count`, `total_size`, `stock_value`.

### Data hook

`fetchPartialPiecesOnHand(def, ctx, params)` in `src/hooks/reports/useReportData.ts` — calls the RPC, runs the envelope with sums above. New dispatcher case `warehouse.partialPiecesOnHand`.

## 2. WH-PP-MOV-001 — Partial Pieces Movement Ledger

International framing: ISO 8601 dated period + SAP EWM HU lifecycle events (CREATE → SPLIT → CONSUME / SCRAP).

### New RPC `public.report_partial_pieces_movement`

Returns a synthesized chronological ledger by `UNION ALL` over `warehouse_partial_pieces`:

| event_type | event_at | event_qty (base) | event_pieces |
|------------|----------|------------------|--------------|
| `CREATE`   | `created_at` when `parent_piece_id IS NULL` | `+ size_value × original_piece_count` | `+ original_piece_count` |
| `SPLIT_IN` | `created_at` when `parent_piece_id IS NOT NULL` (residual peel) | `+ size_value × original_piece_count` | `+ original_piece_count` |
| `CONSUME`  | `consumed_at` when `status='consumed'` | `- consumed_qty` | `- original_piece_count` |
| `SCRAP`    | `consumed_at` when `status='scrapped'` | `- consumed_qty` | `- original_piece_count` |

```
report_partial_pieces_movement(
  p_company_id uuid,
  p_date_from  timestamptz default null,
  p_date_to    timestamptz default null,
  p_location_id uuid default null,
  p_bin_id     uuid default null,
  p_item_id    uuid default null,
  p_event_type text default null     -- filter: CREATE | SPLIT_IN | CONSUME | SCRAP | NULL=all
)
RETURNS TABLE(
  event_at timestamptz, event_type text,
  piece_id uuid, piece_code text, parent_piece_code text,
  item_id uuid, item_code text, item_name text,
  location_id uuid, location_name text,
  bin_id uuid, bin_code text,
  size_value numeric, size_uom text,
  event_pieces integer, event_qty numeric,
  unit_cost numeric, event_value numeric,    -- event_qty * unit_cost
  reason text,                                -- consumed_reason for CONSUME/SCRAP
  user_email text, notes text
)
```

Notes column carries source_ref/label/consumed_reason context.
Filters: company + period applied to `event_at` (defaults: last 30 days), optional location/bin/item/event_type.
Order: `event_at DESC, piece_code`.

### Registry entry

- Group: "Movement", standard: "ISO 8601 period / SAP EWM HU events".
- Parameters: Period (defaultDays 30), Location, Bin (dependsOn Location), Event Type select (All / Create / Split / Consume / Scrap), Notes textOperator filter (matches `notes`, highlights matches — reuses existing infra).
- Columns: Date · Event · Piece Code · Item Code · Item Name · Location · Bin · Size · UoM · Pieces Δ · Qty Δ · Unit Cost · Value · Reason · User · Notes.
- Totals row: `event_pieces`, `event_qty`, `event_value`.

### Data hook

`fetchPartialPiecesMovement(def, ctx, params)` — calls RPC with period args; supports notes filter via existing `parseNotesFilter` / `buildHighlight` helpers. New dispatcher case `warehouse.partialPiecesMovement`.

## File-level changes

1. **Migration** — create both RPCs (SECURITY INVOKER, `STABLE`, `SET search_path=public`). RLS on `warehouse_partial_pieces` already enforces company scope for invokers.
2. **`src/lib/reports/registry.ts`** — append two `ReportDefinition` entries; reuse existing `location`, `bin`, `category`, `boolean`, `select`, `dateRange`, `textOperator` parameter types (no new types).
3. **`src/hooks/reports/useReportData.ts`** — add the two `fetch*` functions and dispatcher cases.
4. **No new UI files** — the Reports Center, ReportParameterPanel and exporters already render any registered report.

## Verification

From `/management/reports`:
- Run "Partial Pieces on Hand" with no filters → matches `select count(*) from warehouse_partial_pieces where company_id = … and status='available' and piece_count > 0`. Toggle Status=All to include consumed/scrapped/reserved.
- Run "Partial Pieces Movement Ledger" for last 30 days → counts of CREATE/SPLIT_IN/CONSUME/SCRAP events match `warehouse_partial_pieces` row timestamps.
- Filter by location and bin → results narrow as expected.
- Export XLSX/PDF/CSV → totals row populated for `piece_count`, `total_size`, `stock_value` (on-hand) and `event_pieces`, `event_qty`, `event_value` (movement).

## Out of scope

- No changes to partial-piece create/consume/split logic.
- No new tables (movement reconstructed from existing rows).
- No new UI components — exporters, preview, parameter renderer all reused.
- Other modules (finance, construction, etc.) untouched.
