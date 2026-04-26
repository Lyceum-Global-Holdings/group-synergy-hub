## Reports Center — Phase 3 (cross-module expansion)

The Warehouse tab in `/management/reports` now ships 11 standards-aligned reports. The other module tabs (Finance, Procurement, Sourcing, Production, Construction, Management) currently render empty. Phase 3 fills them with the most-needed reports per module, keeping the same envelope / exporter / `report_audit_log` pattern so every export remains SOX-traceable, ISO 8601-dated, and ISO 4217-currencied.

## What gets added

### Finance (6 reports — IFRS / IAS aligned)

| Code | Title | Standard | Source |
|---|---|---|---|
| `FN-TB-001` | Trial Balance (as-of date) | IFRS presentation | `journal_entries`, `journal_lines`, `chart_of_accounts` |
| `FN-GL-001` | General Ledger Detail (account × period) | IAS 1 | `journal_lines` |
| `FN-AP-AGE-001` | Accounts Payable Aging (0/30/60/90/90+) | IFRS 9 | `supplier_invoices`, `payments` |
| `FN-AR-AGE-001` | Accounts Receivable Aging | IFRS 9 / IFRS 15 | `customer_invoices`, `receipts` |
| `FN-FA-REG-001` | Fixed Asset Register & Depreciation Schedule | IAS 16 | `warehouse_assets` (single source of truth, per existing memory) |
| `FN-CF-001` | Cash & Bank Statement (period) | IAS 7 | `bank_accounts`, `bank_transactions` |

### Procurement (5 reports)

| Code | Title | Standard |
|---|---|---|
| `PR-PR-REG-001` | Purchase Requisition Register | ISO 9001 §7.4 |
| `PR-PO-REG-001` | Purchase Order Register (period, status) | WCO trade docs |
| `PR-PO-OPN-001` | Open PO / Outstanding Commitments | IAS 37 (commitments disclosure) |
| `PR-3WM-001` | Three-Way Match Exceptions (PO ↔ GRN ↔ Invoice) | SOX ITGC |
| `PR-SPND-001` | Spend Analysis (by supplier, category, month) | CIPS spend cube |

### Sourcing (4 reports)

| Code | Title | Standard |
|---|---|---|
| `SR-RFQ-REG-001` | RFQ / RFP Register & Status | ISO 9001 §8.4 |
| `SR-QUOTE-CMP-001` | Quotation Comparison (per RFQ) | CIPS evaluation |
| `SR-SUP-SCORE-001` | Supplier Scorecard (quality, OTD, price, compliance) | ISO 9001 §8.4.2 |
| `SR-CTR-EXP-001` | Contract Expiry & Renewal Pipeline | ISO 9001 §7.5 |

### Production (4 reports)

| Code | Title | Standard |
|---|---|---|
| `PD-WIP-001` | Work-In-Progress by Stage (qty + cost) | IAS 2 |
| `PD-DAILY-001` | Daily Production Output (period) | OEE / ISO 22400 |
| `PD-STG-COST-001` | Stage-wise Cost Breakdown (per order) | IAS 2 §10 |
| `PD-EFF-001` | Production Efficiency / OEE | ISO 22400-2 |

### Construction (4 reports)

| Code | Title | Standard |
|---|---|---|
| `CN-DSR-001` | Daily Site Report Summary (labour, weather, progress) | ISO 19650 |
| `CN-PROG-001` | Project Progress vs Plan (% complete) | PMI EVM (PV/EV/AC) |
| `CN-BUD-VAR-001` | Project Budget vs Actual Variance | PMI EVM |
| `CN-MAT-MOV-001` | Material Issues / Returns by Project | ISO 9001 §8.5 |

### Management (3 cross-module reports)

| Code | Title | Standard |
|---|---|---|
| `MG-APR-PEND-001` | Pending Approvals Aging (across all modules) | SOX delegation-of-authority |
| `MG-AUD-LOG-001` | System Audit Log (filterable by module/user/period) | ISO 27001 A.12.4 |
| `MG-RPT-USE-001` | Report Usage / Export Audit (from `report_audit_log`) | SOX evidence pack |

## Technical changes

**Database** — one consolidated migration adding `SECURITY INVOKER` RPCs, one per report (26 functions). Each:
- Filters by `p_company_id` and respects RLS via the invoker session.
- Caps result at 50k rows.
- Returns flat rows matching the column definitions in `registry.ts`.
- Uses existing tables only — no schema changes — except `MG-RPT-USE-001` which selects from the existing `report_audit_log` table.

Per existing memory `mem://architecture/finance-warehouse-asset-sync`, `FN-FA-REG-001` reads from `warehouse_assets` (single source of truth) — not a duplicate finance table.

**Files to create**
- `supabase/migrations/<timestamp>_reports_phase_3.sql` — 26 new RPCs.

**Files to edit**
- `src/lib/reports/registry.ts` — append 26 `ReportDefinition` entries with full column maps and grouping (`Ledger`, `Aging`, `Assets`, `Cash`, `Orders`, `Compliance`, `Spend`, `Sourcing`, `Contracts`, `WIP`, `Output`, `Cost`, `Site`, `Progress`, `Budget`, `Materials`, `Approvals`, `Audit`).
- `src/hooks/reports/useReportData.ts` — add 26 `fetchXxx` functions and switch cases in the dispatcher.
- `src/components/management/reports/ReportParameterPanel.tsx` — add a `supplier` picker (already declared in the type union but not yet rendered) and a `customer` picker for AR aging; add an `account` picker for GL detail.
- `src/pages/management/ReportsCenter.tsx` — no structural change; already supports all module tabs and grouping.
- `.lovable/memory/architecture/reporting-standards.md` — append the 26 new report codes and standards mapping.

**Discoverability hooks (deep links)** — add a "Generate Report" button on:
- `src/pages/finance/GeneralLedger.tsx` → `?template=FN-GL-001`
- `src/pages/finance/AccountsPayable.tsx` → `?template=FN-AP-AGE-001`
- `src/pages/finance/AccountsReceivable.tsx` → `?template=FN-AR-AGE-001`
- `src/pages/finance/FixedAssets.tsx` → `?template=FN-FA-REG-001`
- `src/pages/procurement/PurchaseOrder.tsx` → `?template=PR-PO-REG-001`
- `src/pages/procurement/ThreeWayMatch.tsx` → `?template=PR-3WM-001`
- `src/pages/sourcing/SupplierScorecard.tsx` → `?template=SR-SUP-SCORE-001`
- `src/pages/sourcing/Contracts.tsx` → `?template=SR-CTR-EXP-001`
- `src/pages/production/ProductionModule.tsx` → `?template=PD-WIP-001`
- `src/pages/construction/ProgressTracking.tsx` → `?template=CN-PROG-001`
- `src/pages/management/ApprovalConsole.tsx` → `?template=MG-APR-PEND-001`
- `src/pages/management/AuditLogs.tsx` → `?template=MG-AUD-LOG-001`

## Out of scope

- Scheduled / emailed delivery (Phase 4).
- Per-user saved presets / favourites (Phase 4).
- Multi-currency consolidation (uses each company's `baseCurrency` for now, per ISO 4217).
- Drill-down from preview rows to source documents (Phase 4).

## Acceptance criteria

- Each module tab in `/management/reports` shows its full set of templates, grouped logically.
- All 26 reports run end-to-end: Preview, XLSX, PDF, CSV.
- Every export writes a row to `report_audit_log` (already enforced by the central exporter).
- Aging reports (`FN-AP-AGE-001`, `FN-AR-AGE-001`) bucket by 0-30 / 31-60 / 61-90 / 90+ and total per bucket in the footer.
- `FN-FA-REG-001` reconciles to `WH-AST-REG-001` (same source of truth).
- `PR-3WM-001` lists only invoices where qty or price variance breaches tolerance.
- `MG-RPT-USE-001` lets admins audit every report exported by every user across the system.
- All new RPCs are `SECURITY INVOKER` and respect existing RLS — no privilege escalation.
