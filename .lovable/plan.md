## Goal

Add a single **Reports Center** under the Management module that can generate standardised reports for every operational module, with a deep, first-class set of warehouse reports. The system follows international reporting standards so the output is audit-ready.

## International standards applied

- **WCO / ISO 9001 §7.5 (Documented Information)** — every report carries a header block: company, report code, generated-by, generated-at (UTC + local), period, filters, page x/y, signature line.
- **ISO 8601** dates/times, **ISO 4217** currency codes, **ISO 3166** country codes.
- **GS1 / ISO/IEC 15459** item & batch identifiers shown alongside internal codes.
- **IFRS / IAS 2 (Inventories)** valuation reports show cost basis (FIFO/Weighted Avg), NRV, and write-down columns.
- **COSO / SOX-style** audit trail report (who/what/when/before/after).
- **GDPR Art. 30** processing-records friendly export (PII fields flagged, can be redacted).
- Output formats: **XLSX** (openpyxl-style structured workbooks via existing `writeExcelFromJSON`), **PDF/A-ready** (jsPDF + autoTable, already in stack), and **CSV (RFC 4180)**.

## What will be built

### 1. New route & navigation

- New page `src/pages/management/ReportsCenter.tsx` at `/management/reports`.
- Add `{ key: 'reports', name: 'Reports Center', description: 'Standardised reports for all modules', url: '/management/reports' }` to `moduleConfig.management.subModules`.
- Wire route in `src/App.tsx` (lazy import).
- Sidebar entry inherits automatically from module config.

### 2. Reports Center UI

```text
┌──────────────────────────────────────────────────────────┐
│  Reports Center                                          │
│  [ Module ▾ ]  [ Search reports… ]   [ Recently run ]    │
├──────────────────────────────────────────────────────────┤
│  Warehouse  │  Stock on Hand        ISO/IAS 2            │
│             │  Stock Movement       ISO 8601 period      │
│             │  Inventory Valuation  IFRS/IAS 2 (FIFO/WA) │
│             │  ABC / Pareto         ISO 55000 asset mgmt │
│             │  Aging & Dead Stock   IAS 2 §28 NRV        │
│             │  Cycle Count Variance ISO 9001 §8.7        │
│             │  Bin Utilisation      WMS best practice    │
│             │  GRN Register         WCO trade docs       │
│             │  Asset Register       ISO 55000 / IAS 16   │
│             │  Tool Issue / Return  ISO 55000            │
│             │  Batch Traceability   GS1 CTE/KDE, ISO22005│
│  Finance    │  …                                         │
│  Procurement│  …                                         │
└──────────────────────────────────────────────────────────┘
```

- Left rail = module list (warehouse expanded by default).
- Middle = grid of report cards (title, standard tag, description, last run).
- Right slide-over = parameter panel (period, location, category, status, currency, format).
- Footer of dialog: **Preview**, **Export XLSX**, **Export PDF**, **Export CSV**, **Schedule** (future).

### 3. Warehouse reports (priority set)

Each report is an SQL-backed `SECURITY INVOKER` RPC returning a flat row shape (keeps with the existing list-RPC pattern), plus a TS adapter that maps it to the standard report envelope.

| Report | RPC | Source tables | Standard |
|---|---|---|---|
| Stock on Hand (by location/category) | `report_stock_on_hand` | warehouse_items, warehouse_bins, warehouse_locations, item_categories | IAS 2 |
| Stock Movement Ledger | reuse `useStockMovementReport` + extend | stock_transactions | ISO 8601 period |
| Inventory Valuation (FIFO / Weighted Avg) | `report_inventory_valuation` | warehouse_items, grn_items, batches | IFRS / IAS 2 |
| ABC / Pareto Classification | `report_abc_classification` | stock_transactions (12-mo consumption) | ISO 55000 |
| Aging & Dead Stock | `report_inventory_aging` | warehouse_items, stock_transactions | IAS 2 §28 NRV |
| Cycle Count Variance | `report_cycle_count_variance` | cycle_counts, cycle_count_lines | ISO 9001 §8.7 |
| Bin Utilisation / Capacity | `report_bin_utilisation` | warehouse_bins | WMS best practice |
| GRN Register | `report_grn_register` | grn, grn_items, suppliers | WCO |
| Asset Register | reuse `useWarehouseAssetReport` + add depreciation columns | warehouse_assets | ISO 55000 / IAS 16 |
| Tool Issue / Return Ledger | `report_tool_ledger` | tool_issues, tool_returns | ISO 55000 |
| Batch Traceability (forward + backward) | `report_batch_traceability` | batches, grn_items, stock_transactions | GS1 CTE/KDE, ISO 22005 |

All RPCs respect existing RLS and `selected_company_id` scoping.

### 4. Standard report envelope

Every report (regardless of module) is rendered through one shared renderer so headers, footers, and metadata are identical. Implemented in `src/lib/reports/reportEnvelope.ts`:

```text
HEADER:
  Lyceum Global Holdings · <Company>
  <Report Title>                       Report Code: WH-INV-VAL-001
  Period: 2026-01-01 → 2026-04-26 (ISO 8601, UTC)
  Filters: Location=All, Category=Electronics, Currency=LKR (ISO 4217)
  Generated: 2026-04-26T10:14:22Z by jane.doe@lgh.lk
BODY (table)
FOOTER:
  Page x/y  ·  Signature: __________  Date: __________
  Source: Lyceum ERP  ·  Confidential — Internal Use
```

### 5. Export pipeline

- **XLSX**: extend `writeExcelFromJSON` with a `reportMeta` parameter to emit the header rows, freeze panes, bold totals, ISO date formatting (`yyyy-mm-dd`), and ISO 4217 currency formatting.
- **PDF**: shared `src/lib/reports/pdfRenderer.ts` (jsPDF + autoTable) with the same header/footer; A4 portrait by default, A3 landscape for wide tables; embeds a small QR code linking back to the live report URL with current filters (verification).
- **CSV**: RFC 4180 quoting, UTF-8 BOM for Excel compatibility.

### 6. Permissions & audit

- New RBAC operation: `management.reports.view` and `management.reports.export`.
- Every export inserts a row into `report_audit_log` (report_code, params hash, format, user_id, company_id, row_count, generated_at) — satisfies COSO / SOX-style audit trail.

### 7. Discoverability

- "Generate Report" buttons inside each warehouse page (e.g. Inventory Valuation, GRN, Tool Mgmt) link directly to Reports Center with the matching template + filters pre-filled via query params (e.g. `/management/reports?template=WH-INV-VAL-001&location=...`).

## Out of scope (this iteration)

- Scheduled / emailed reports (Telegram + email delivery is a follow-up; the Schedule button will be present but disabled with "coming soon").
- Per-user saved report presets.
- Cross-company consolidated reports (requires separate consolidation rules).

## Files to create / edit

**Create**
- `src/pages/management/ReportsCenter.tsx`
- `src/components/management/reports/ReportCard.tsx`
- `src/components/management/reports/ReportParameterPanel.tsx`
- `src/components/management/reports/ReportPreviewDialog.tsx`
- `src/lib/reports/reportEnvelope.ts`
- `src/lib/reports/pdfRenderer.ts`
- `src/lib/reports/csvRenderer.ts`
- `src/lib/reports/registry.ts` (catalog of report definitions per module)
- `src/hooks/reports/use<ReportName>.ts` (one per warehouse report)
- Migration: new RPCs listed above + `report_audit_log` table with RLS
- `.lovable/memory/architecture/reporting-standards.md`

**Edit**
- `src/App.tsx` (route)
- `src/constants/moduleConfig.ts` (sub-module entry)
- `src/utils/excelUtils.ts` (header/meta block support)
- `src/constants/rbacConfig.ts` (new operations)

## Acceptance criteria

- `/management/reports` lists all warehouse templates and at least placeholder cards for the other modules.
- Each warehouse report can be previewed on screen, exported to XLSX/PDF/CSV, and produces an entry in `report_audit_log`.
- All exports carry the ISO-compliant header/footer block and use ISO 8601 dates and ISO 4217 currency codes.
- Inventory Valuation report shows both FIFO and Weighted Average columns and a NRV adjustment column.
- Batch Traceability report supports both forward and backward trace from a batch number or item code.
- Permissions are honoured (non-authorised users see neither the page nor the buttons).
