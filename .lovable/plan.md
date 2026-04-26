## Filter Stock by Notes Content — Reports Center (Warehouse)

Add a standards-aligned **"Notes contains…"** text filter to the warehouse stock reports in Reports Center, plus expose the `notes` column where it isn't already shown. The filter searches the free-text notes/comment fields attached to stock transactions (e.g., reason, remarks, batch comments) using a case-insensitive partial match performed **server-side** in the report RPCs.

### Why this design (international standards)

- **ISO 9001 §7.5 / §8.7** — documented information & nonconformity records require traceable, searchable comments on stock movements (reasons, deviations, root causes).
- **GS1 EPCIS / CTE-KDE** — traceability events carry free-text "bizStep notes" that auditors must be able to query.
- **IAS 2 / IFRS audit trail** — write-down justifications and adjustment narratives stored in notes must be locatable for external audit.
- **WCAG 2.2** — single text input with clear label, no hidden behaviour, accessible by keyboard.
- **Server-side ILIKE filtering** (not client filtering) ensures the filter applies to the full result set even when the report is exported to XLSX/PDF/CSV — matching SAP/Oracle EBS report behaviour where every column filter is part of the report criteria printed in the header.

### Scope — which reports get the filter

Three warehouse reports actually surface stock-level free-text notes:

| Report | Code | Notes source |
|---|---|---|
| Stock Movement Ledger | `WH-MOV-001` | `warehouse_stock_movements.notes` |
| Cycle Count Variance | `WH-CYC-VAR-001` | `cycle_count_items.variance_reason` (already returned as `variance_reason`) |
| Batch Traceability | `WH-BATCH-TRC-001` | event-level notes (already returned) |

Stock Movement Ledger does **not** currently expose `notes` in its column list even though the RPC already returns it — we'll surface the column **and** add the filter parameter.

### Changes

**1. Database — extend 3 RPCs with a `p_notes_contains text` parameter (nullable, default NULL)**

New migration adds an overloaded signature (or `CREATE OR REPLACE` with the new trailing param) for:
- `report_stock_movement_ledger(... , p_notes_contains text DEFAULT NULL)`
- `report_cycle_count_variance(... , p_notes_contains text DEFAULT NULL)`
- `report_batch_traceability(... , p_notes_contains text DEFAULT NULL)`

Filter logic inside each function:
```sql
AND (
  p_notes_contains IS NULL
  OR p_notes_contains = ''
  OR notes ILIKE '%' || p_notes_contains || '%'
)
```
For Cycle Count, the predicate is applied to `variance_reason`. Special characters in the search term are escaped with `replace(replace(p_notes_contains,'\','\\'),'%','\%')` to prevent wildcard injection — same pattern used by the existing item-search sanitiser (see `mem://features/warehouse/search-special-character-handling`). RLS is unchanged (functions remain `SECURITY INVOKER`).

**2. Report registry — add the parameter and the missing column** (`src/lib/reports/registry.ts`)

For each of the 3 reports above, append:
```ts
{
  key: "notesContains",
  label: "Notes contain",
  type: "text",
  placeholder: "e.g. damaged, audit, return",
}
```
For `WH-MOV-001` only, also add:
```ts
{ key: "notes", label: "Notes", type: "string", width: 36 }
```
to the columns array so the filtered results clearly show **why** each row matched.

**3. Hook layer — pass the new param to the RPC** (`src/hooks/reports/useReportData.ts`)

Update `fetchStockMovement`, `fetchCycleCountVariance`, and `fetchBatchTraceability` to:
- accept `notesContains?: string` in the params type
- trim and pass it as `p_notes_contains: (params.notesContains || "").trim() || null`

The existing `buildFilterDescriptors` already handles `text`-type params, so the filter value will appear in the report header automatically (visible in Preview, XLSX, PDF, CSV).

**4. Parameter panel** — no changes needed; `ReportParameterPanel` already renders `text` parameters with placeholder support.

### Files touched

- `supabase/migrations/<timestamp>_reports_notes_filter.sql` (new) — `CREATE OR REPLACE` for the 3 RPCs
- `src/lib/reports/registry.ts` (edit) — add `notesContains` parameter to 3 reports + `notes` column to `WH-MOV-001`
- `src/hooks/reports/useReportData.ts` (edit) — wire the new param into the 3 fetchers

### UX

In Reports Center → Warehouse → open **Stock Movement Ledger** (or Cycle Count Variance / Batch Traceability):
- A **"Notes contain"** text input appears alongside Period and Location
- Empty → no filtering (current behaviour)
- Typing e.g. `damaged` → server returns only rows whose notes contain "damaged" (case-insensitive)
- The filter value is printed in the report header ("Notes contain: damaged") on every export per ISO 9001 §7.5 documentation requirements
- Filter persists in the URL (`?notesContains=damaged`) for sharable, reproducible reports — same mechanism as existing params

No breaking changes: the new RPC parameter has `DEFAULT NULL`, so any other caller continues to work.
