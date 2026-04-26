# Phase 3 Follow-up — Deep Links, Memory Refresh & Smoke Test

The 26 Phase 3 reports are live in the registry, RPCs, and dispatcher. This pass closes the three items that were intentionally skipped last turn so every module surface can launch its own templates and the docs stay in sync.

## What you'll get

A "Generate Report" button (icon + label) on the 12 most-used module pages that opens the Reports Center with the right template pre-selected and, where natural, parameters pre-filled (date range, supplier, project, etc.). The button only renders for users who can access the Management → Reports module, so it never leaks to unauthorised roles.

## 1. Deep-link buttons (12 pages, 19 templates)

Each button uses the existing pattern:
```ts
navigate(`/management/reports?template=<CODE>`);
```
ReportsCenter already reads `?template=` and selects the matching definition.

| Module | Page | Templates exposed |
|---|---|---|
| Finance | `GeneralLedger.tsx` | FN-GL-001, FN-TB-001 |
| Finance | `AccountsPayable.tsx` | FN-AP-AGE-001 |
| Finance | `AccountsReceivable.tsx` | FN-AR-AGE-001 |
| Finance | `FixedAssets.tsx` | FN-FA-REG-001 |
| Finance | `CashBank.tsx` | FN-CF-001 |
| Procurement | `PurchaseRequisition.tsx` | PR-PR-REG-001 |
| Procurement | `PurchaseOrder.tsx` | PR-PO-REG-001, PR-PO-OPN-001, PR-SPND-001 |
| Procurement | `ThreeWayMatch.tsx` | PR-3WM-001 |
| Sourcing | `RfqManagement.tsx` | SR-RFQ-REG-001 |
| Sourcing | `QuotationComparison.tsx` | SR-QUOTE-CMP-001 |
| Sourcing | `SupplierScorecard.tsx` | SR-SUP-SCORE-001 |
| Sourcing | `Contracts.tsx` | SR-CTR-EXP-001 |
| Production | `ProductionModule.tsx` | PD-WIP-001, PD-DAILY-001, PD-STG-COST-001, PD-EFF-001 |
| Construction | `DailySiteReports.tsx` | CN-DSR-001 |
| Construction | `ProgressTracking.tsx` | CN-PROG-001 |
| Construction | `ProjectBudgeting.tsx` | CN-BUD-VAR-001 |
| Construction | `ResourceAllocation.tsx` | CN-MAT-MOV-001 |
| Management | `ApprovalConsole.tsx` | MG-APR-PEND-001 |
| Management | `AuditLogs.tsx` | MG-AUD-LOG-001 |

For pages with multiple templates, render a small dropdown ("Generate Report ▾") instead of a single button. Single-template pages get a plain button.

A tiny shared helper keeps usage one-liner and consistent:

```tsx
// src/components/management/reports/GenerateReportButton.tsx
<GenerateReportButton template="FN-GL-001" />
<GenerateReportButton templates={["PR-PO-REG-001","PR-PO-OPN-001","PR-SPND-001"]} />
```

The helper:
- gates visibility via the existing module/role check used elsewhere for Management → Reports,
- forwards optional `params` (e.g. `{ from, to, supplier_id }`) as extra query string keys that ReportsCenter already understands.

## 2. ReportsCenter parameter pre-fill

Tiny addition: after reading `?template=`, also read any other query params and merge them into the parameter form's initial state (only keys that match the selected template's declared parameters). No schema change.

## 3. Memory refresh

Update `mem://architecture/reporting-standards.md` to:
- list all 37 codes (11 warehouse + 26 Phase 3) with their standard reference (IFRS/ISO/PMI/SOX),
- document the `GenerateReportButton` deep-link contract and supported query params,
- note the 50k-row RPC cap and `ReportEnvelope` audit pattern.

## 4. Smoke test

After wiring is complete, open ReportsCenter and run one report per module (7 total) to confirm:
- template appears under the right tab,
- RPC returns rows (or an empty-state with no error),
- export to CSV/XLSX/PDF works on at least one report.
Capture any failures and patch before closing the task.

## Out of scope

- No new RPCs or registry entries — the 26 Phase 3 reports already exist.
- No changes to RLS, role model, or navigation registry.
- No redesign of ReportsCenter UI; only the param-prefill tweak.

## Technical notes

- New file: `src/components/management/reports/GenerateReportButton.tsx` (≈40 LOC, uses `useNavigate`, `Button`, `DropdownMenu`, and the existing role/module access hook).
- Edits to 12 page files: import + place the button in the page header's action area (next to existing "Export" / "Add" buttons).
- Edit to `src/pages/management/ReportsCenter.tsx`: extend the existing `useSearchParams` effect to seed parameter defaults from the URL.
- Edit to `mem://architecture/reporting-standards.md`.
- No DB migration.
