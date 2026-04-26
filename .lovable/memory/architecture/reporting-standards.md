---
name: Reporting standards
description: All Reports Center outputs must use the shared envelope and comply with ISO 8601, ISO 4217, GS1, IFRS/IAS 2, and ISO 9001 §7.5 documentation rules
type: feature
---
All reports under `/management/reports` flow through `src/lib/reports/` (types, registry, xlsx/pdf/csv renderers, exporter). Every export writes an immutable row to `report_audit_log` (SOX-style trail) — never bypass it. Dates are ISO 8601, currency uses ISO 4217 codes from the company's `baseCurrency`, inventory valuation must surface FIFO + Weighted Average + NRV (IAS 2), and headers always carry: company, report code, standard, period, filters, generated-by, generated-at. Add new reports by appending a `ReportDefinition` to `registry.ts` and a branch to `buildReportEnvelope` in `useReportData.ts`. Backed by SECURITY INVOKER RPCs `report_stock_on_hand`, `report_inventory_valuation`, `report_inventory_aging`.
