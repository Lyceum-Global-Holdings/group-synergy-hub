---
name: Reporting standards
description: All Reports Center outputs must use the shared envelope and comply with ISO 8601, ISO 4217, GS1, IFRS/IAS, ISO 9001/22400/19650/27001, PMI EVM and SOX documentation rules
type: feature
---
All reports under `/management/reports` flow through `src/lib/reports/` (types, registry, xlsx/pdf/csv renderers, exporter). Every export writes an immutable row to `report_audit_log` (SOX-style trail) — never bypass it. Dates are ISO 8601, currency uses ISO 4217 codes from the company's `baseCurrency`, inventory valuation must surface FIFO + Weighted Average + NRV (IAS 2), and headers always carry: company, report code, standard, period, filters, generated-by, generated-at. Add new reports by appending a `ReportDefinition` to `registry.ts` (set `group` for sub-grouping in the UI) and a branch to the dispatcher in `useReportData.ts`.

## RPC pattern

All report RPCs are `SECURITY INVOKER` (RLS still applies), capped at **50,000 rows**, and return flat rows the dispatcher converts into a `ReportEnvelope`. New report types should add a generic dispatch via `fetchRpc(def, ctx, rpcName, args)` rather than custom hooks where possible.

## Full registry (37 codes)

### Warehouse (11)
- `WH-STK-OH-001` Stock on Hand — IAS 2
- `WH-INV-VAL-001` Inventory Valuation (FIFO/WA/NRV) — IAS 2
- `WH-AGE-001` Inventory Aging — IAS 2
- `WH-ABC-001` ABC Classification (12-month Pareto) — ISO 9001
- `WH-MOV-001` Stock Movement Ledger — ISO 9001 §7.5
- `WH-CYC-VAR-001` Cycle Count Variance — ISO 9001
- `WH-BIN-UTL-001` Bin Utilisation — GS1
- `WH-GRN-REG-001` GRN Register — ISO 9001
- `WH-AST-REG-001` Asset Register (NBV/depreciation) — IAS 16
- `WH-TOOL-LED-001` Tool Ledger — ISO 9001
- `WH-BATCH-TRC-001` Batch Traceability (forward/backward) — GS1 / ISO 22005

### Finance (6)
- `FN-TB-001` Trial Balance — IFRS
- `FN-GL-001` General Ledger — IFRS
- `FN-AP-AGE-001` AP Aging — IFRS / IAS 1
- `FN-AR-AGE-001` AR Aging — IFRS / IAS 1
- `FN-FA-REG-001` Fixed Asset Register — IAS 16
- `FN-CF-001` Cash Flow Statement — IAS 7

### Procurement (5)
- `PR-PR-REG-001` Purchase Requisition Register — ISO 9001
- `PR-PO-REG-001` Purchase Order Register — ISO 9001
- `PR-PO-OPN-001` Open POs — ISO 9001
- `PR-3WM-001` Three-Way Match Exceptions — SOX
- `PR-SPND-001` Spend Analysis — ISO 9001

### Sourcing (4)
- `SR-RFQ-REG-001` RFQ Register — ISO 9001
- `SR-QUOTE-CMP-001` Quotation Comparison — ISO 9001
- `SR-SUP-SCORE-001` Supplier Scorecard — ISO 9001
- `SR-CTR-EXP-001` Contract Expiry — ISO 9001

### Production (4)
- `PD-WIP-001` Work-in-Progress — ISO 22400
- `PD-DAILY-001` Daily Production — ISO 22400
- `PD-STG-COST-001` Stage-wise Cost — ISO 22400
- `PD-EFF-001` Production Efficiency / OEE — ISO 22400

### Construction (4)
- `CN-DSR-001` Daily Site Report — ISO 19650
- `CN-PROG-001` Project Progress (% complete, EVM-ready) — PMI EVM
- `CN-BUD-VAR-001` Budget vs Actual — PMI EVM
- `CN-MAT-MOV-001` Material Movement — ISO 19650

### Management (3)
- `MG-APR-PEND-001` Pending Approvals — SOX DoA
- `MG-AUD-LOG-001` System Audit Log — ISO 27001 A.12.4
- `MG-RPT-USE-001` Report Usage — SOX evidence pack

## Deep linking — `<GenerateReportButton>`

Module pages launch reports via `src/components/management/reports/GenerateReportButton.tsx`. Single template:
```tsx
<GenerateReportButton template="FN-GL-001" />
```
Multiple templates render a dropdown:
```tsx
<GenerateReportButton templates={["PR-PO-REG-001","PR-PO-OPN-001","PR-SPND-001"]} />
```
Optional `params` map become extra query keys. The Reports Center seeds the parameter form from the URL using `seedParamsFromUrl`, only for keys declared in the selected report definition. Conventions:
- Scalars/text/select/location/category/supplier: `?key=value`
- Booleans: `?key=true|false|1|0`
- Date range: `?keyFrom=YYYY-MM-DD&keyTo=YYYY-MM-DD` or shorthand `?key=YYYY-MM-DD|YYYY-MM-DD`

Reserved keys (`template`, `module`) drive ReportsCenter itself and are never forwarded to params. The Module tab auto-switches to the report's `moduleKey` when opened from a deep link.

## Parameter types

Supported by `ReportParameterPanel`: `date`, `dateRange` (with `defaultDays`), `location`, `category`, `supplier`, `text`, `select`, `boolean`. `dateRange` values are `{ from, to }` ISO date strings.
