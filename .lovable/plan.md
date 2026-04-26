## Continue Reports Center — Phase 2

The Reports Center foundation is live at `/management/reports` with 3 warehouse templates (Stock on Hand, Inventory Valuation, Inventory Aging). This phase adds the remaining warehouse reports promised in the original plan and rounds out the standards-aligned set.

## What gets added

### New warehouse report templates (8)

| # | Report | Code | Standard | Source data |
|---|---|---|---|---|
| 1 | Stock Movement Ledger | `WH-MOV-001` | ISO 8601 period | `stock_transactions` |
| 2 | ABC / Pareto Classification | `WH-ABC-001` | ISO 55000 | 12-month consumption from `stock_transactions` |
| 3 | Cycle Count Variance | `WH-CYC-VAR-001` | ISO 9001 §8.7 | `cycle_counts`, `cycle_count_lines` |
| 4 | Bin Utilisation / Capacity | `WH-BIN-UTL-001` | WMS best practice | `warehouse_bins` |
| 5 | GRN Register | `WH-GRN-REG-001` | WCO trade docs | `grn`, `grn_items`, suppliers |
| 6 | Asset Register (with depreciation) | `WH-AST-REG-001` | ISO 55000 / IAS 16 | `warehouse_assets` |
| 7 | Tool Issue / Return Ledger | `WH-TOOL-LED-001` | ISO 55000 | `tool_issues`, `tool_returns` |
| 8 | Batch Traceability (forward + backward) | `WH-BATCH-TRC-001` | GS1 CTE/KDE, ISO 22005 | `batches`, `grn_items`, `stock_transactions` |

Each gets a `SECURITY INVOKER` RPC, a `ReportDefinition` entry in `registry.ts`, and a fetch branch in `useReportData.ts`. All flow through the existing envelope/exporter and write to `report_audit_log`.

### Parameter panel extensions

Adds new parameter types so reports can ask for the right inputs:
- `dateRange` (period start/end) — for movement ledger, GRN register, tool ledger.
- `text` — for Batch Traceability (batch number / item code) and ABC threshold tuning.
- `select` (custom options) — for trace direction (forward / backward / both) and ABC class buckets.

### UI polish on the Sheet panel

- Period selector defaults to current month (ISO 8601).
- Show row count and total formatted currency in the preview footer.
- "Reset filters" button.
- Group warehouse cards by category (Inventory · Movement · Compliance · Assets) for easier discovery.

### Discoverability hooks (light-touch)

Add a "Generate Report" button on:
- `Inventory Valuation` page → opens Reports Center with `WH-INV-VAL-001` pre-loaded.
- `GoodsReceiptNote` page → opens with `WH-GRN-REG-001`.
- `ToolManagement` page → opens with `WH-TOOL-LED-001`.

Uses the existing `?template=CODE` query-param contract already wired in `ReportsCenter.tsx`.

## Technical changes

**Database migration** — one new migration with:
- 8 new SECURITY INVOKER RPCs returning flat rows, all filtered by `p_company_id` and respecting RLS via the invoker's session.
- Each RPC limited to 50k rows and indexed-friendly (uses existing indexes; no new indexes required).
- Batch traceability RPC takes `p_batch_number`, `p_item_code`, `p_direction` ('forward' | 'backward' | 'both').

**Files to create**
- Migration: 8 RPCs (single SQL file).

**Files to edit**
- `src/lib/reports/registry.ts` — add 8 `ReportDefinition` entries with full column maps.
- `src/hooks/reports/useReportData.ts` — add 8 `fetchXxx` functions and switch cases.
- `src/components/management/reports/ReportParameterPanel.tsx` — add `dateRange`, `text`, `select` parameter types.
- `src/pages/management/ReportsCenter.tsx` — group cards by sub-category, add row-count/total footer, reset button.
- `src/pages/warehouse/InventoryValuation.tsx`, `src/pages/warehouse/GoodsReceiptNote.tsx`, `src/pages/warehouse/ToolManagement.tsx` — add "Generate Report" link button.
- `.lovable/memory/architecture/reporting-standards.md` — append the 8 new report codes.

## Out of scope

- Other modules (Finance, Procurement, Sourcing, Production, Construction) — will be a Phase 3 once the warehouse set is verified by users.
- Scheduled / emailed delivery (already noted as future work).
- Per-user saved presets.

## Acceptance criteria

- All 11 warehouse reports appear in the Warehouse tab and run end-to-end (preview, XLSX, PDF, CSV).
- Batch Traceability returns both upstream (GRN, supplier, batch) and downstream (issues, transfers) movements when `direction = 'both'`.
- Cycle Count Variance shows expected vs counted vs variance qty and variance value.
- Asset Register includes acquisition cost, depreciation method, accumulated depreciation, and net book value (IAS 16).
- Every export still writes a row to `report_audit_log`.
- "Generate Report" buttons on the three warehouse pages open the Reports Center with the matching template pre-loaded.
