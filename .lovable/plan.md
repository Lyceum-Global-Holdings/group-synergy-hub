

## Plan: Rebuild Finance Module to Match StoresONE Structure

### What Changes

Replace the current multi-page Finance module (11 separate pages at `/finance/*`) with a single unified **Finance & Accounting** page at `/finance` (or `/accounting`) using a tabbed interface, matching the StoresONE architecture.

### Current vs Target Structure

```text
CURRENT (11 separate pages)          TARGET (1 page, 13 tabs with sub-tabs)
/finance/general-ledger              /finance?tab=gl     (Dashboard, COA, Journal Entries, Recurring, Periods, Currencies, Period Closing, Approvals)
/finance/accounts-payable            /finance?tab=ap     (Dashboard, Invoices, Payments, Debit Notes, Advances, WHT, Aging, Vendor Payment Center)
/finance/accounts-receivable         /finance?tab=ar     (Dashboard, Invoices, Receipts, Credit Notes, Advances, Bad Debt, Aging, Reconciliation)
/finance/cash-bank                   /finance?tab=banking (Dashboard, Accounts, Transactions, Cheques, Transfers, Batches, Reconciliation, Rules)
/finance/fixed-assets                /finance?tab=assets (Asset Register, Depreciation)
/finance/budgeting                   (merged into settings/costing)
/finance/cost-centers                (merged into GL or settings)
/finance/reporting                   /finance?tab=reports (Trial Balance, Financial Statements, Cash Flow, Variance, Tax, Audit, etc.)
/finance/bank-reconciliation         (merged into banking tab)
/finance/payments                    (merged into AP tab)
/finance/settings                    /finance?tab=settings (Companies, Account Mapping, Payment Terms, Tax, Templates, etc.)
NEW TABS:                            /finance?tab=selling, expenses, inventory, procurement, quality, automation
```

### Scope -- This is Very Large (~100+ files)

Given the massive scale (StoresONE has ~120 component files in `src/components/accounting/`), I recommend a **phased approach**:

**Phase 1 (this implementation):** Create the structural foundation
- Unified `Accounting` page with all 13 primary tabs
- Shared components: `KPICard`, `ModuleSubTabs`, `PlaceholderContent`, `QuickActions`
- Shared utility components: `CreatedByCell`, `AccountCombobox`, `CostCenterCombobox`
- **GL Module** -- fully functional (reuses existing `useChartOfAccounts`, `useJournalEntries`, `ChartOfAccountsTab`)
- **AP Module** -- fully functional (reuses existing AP components from `src/components/finance/ap/`)
- **AR Module** -- fully functional (reuses existing AR components from `src/components/finance/ar/`)
- **Banking Module** -- fully functional (reuses existing bank components from `src/components/finance/bank/`)
- **Fixed Assets Module** -- fully functional (reuses existing `src/components/finance/assets/`)
- **Reports Module** -- fully functional (reuses existing `src/components/finance/reports/`)
- **Settings Module** -- fully functional (reuses existing `src/components/finance/settings/`)
- **Selling, Expenses, Inventory, Procurement, Quality, Automation** -- placeholder modules
- Update routing: single `/finance` route, redirect old routes
- Update `moduleConfig.ts` sidebar to single "Finance & Accounting" entry

**Phase 2 (follow-up):** Flesh out placeholder modules and add missing hooks (`useGeneralLedger`, `useLedgerTotals`, `useCostCenters`, GL posting service, etc.)

### Files to Create

1. `src/pages/Accounting.tsx` -- Main unified page with 13 tabs
2. `src/components/accounting/KPICard.tsx`
3. `src/components/accounting/ModuleSubTabs.tsx`
4. `src/components/accounting/PlaceholderContent.tsx`
5. `src/components/accounting/QuickActions.tsx`
6. `src/components/accounting/gl/GLModule.tsx`
7. `src/components/accounting/ap/APModule.tsx`
8. `src/components/accounting/ar/ARModule.tsx`
9. `src/components/accounting/banking/BankingModule.tsx`
10. `src/components/accounting/assets/FixedAssetsModule.tsx`
11. `src/components/accounting/reports/ReportsModule.tsx`
12. `src/components/accounting/settings/SettingsModule.tsx`
13. `src/components/accounting/selling/SellingModule.tsx`
14. `src/components/accounting/expenses/ExpensesModule.tsx`
15. `src/components/accounting/inventory/InventoryModule.tsx`
16. `src/components/accounting/procurement/ProcurementModule.tsx`
17. `src/components/accounting/quality/QualityModule.tsx`
18. `src/components/accounting/automation/AutomationModule.tsx`

### Files to Modify

1. `src/App.tsx` -- Replace 11 finance routes with single `/finance` route + redirects
2. `src/constants/moduleConfig.ts` -- Replace finance sub-modules with single entry pointing to `/finance`

### Files to Remove (old finance pages)

All 11 files in `src/pages/finance/` will no longer be used as standalone pages. Existing components in `src/components/finance/` will be **kept and reused** by the new module wrappers.

### Key Technical Notes

- The GL, AP, AR, Banking, Assets, Reports, and Settings modules will wrap existing components from `src/components/finance/` rather than rewriting them
- Missing hooks from StoresONE (`useGeneralLedger`, `useLedgerTotals`, `useCostCenters`, etc.) will need to be created or adapted from existing hooks
- The `useFormatCurrency` pattern differs: current project uses `formatCurrency` from `src/lib/utils.ts` (not a hook), so module files will adapt accordingly
- Placeholder modules (Selling, Expenses, Inventory, Procurement, Quality, Automation) will use the `PlaceholderContent` component

