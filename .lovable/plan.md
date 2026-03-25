

## Phase 3: Expand Existing Modules to Match StoresONE

Phase 1 created the unified tab structure. Phase 2 fleshed out placeholder modules. Phase 3 expands the 7 already-functional modules (GL, AP, AR, Banking, Assets, Reports, Settings) to match StoresONE's full sub-tab coverage, and creates the missing database tables, hooks, and shared components needed.

### Gap Analysis

```text
MODULE      CURRENT SUB-TABS          STORESONE MISSING SUB-TABS
GL          5 (COA, JE, Reports,      +Dashboard, +Recurring, +Currencies,
            Periods, Settings)         +Period Closing, +Approvals
AP          3 (Invoices, Payments,    +Vendors, +Payment Center, +Scheduled,
            Aging)                     +Debit Notes, +Advances, +WHT,
                                       +Reconciliation, +Performance
AR          4 (Customers, Invoices,   +POS Approvals, +Recurring, +Credit Notes,
            Receipts, Aging)           +Advances, +Reminders, +Bad Debt,
                                       +Reconciliation
Banking     4 (Accounts, Txns,        +Cashbook, +Cheque Register, +Fund Transfers,
            Position, Recon)           +Payment Batches, +Transaction Rules, +POS
Assets      4 (Register, Deprec,      +Revaluations, +Transfers, +Disposals
            Transactions, Reports)     (replace current Transactions/Reports)
Reports     6                          +Variance, +Sales Perf, +Segment, +SSCL,
                                       +Tax Returns, +Audit, +Report Builder,
                                       +Cash Flow Forecast, +Scheduled Reports
Settings    3                          +Companies, +Account Mapping, +Payment Modes,
                                       +Templates, +Email Templates, +Custom Fields,
                                       +Costing/Budget, +Approval Workflow,
                                       +Activity, +Notifications, +Data Import
```

### Missing Database Tables (need migrations)

1. **cheques** -- cheque register (cheque_number, bank_account_id, cheque_type, cheque_date, payee_payer, amount, status, is_post_dated)
2. **fund_transfers** -- inter-account transfers (from_account_id, to_account_id, transfer_date, amount, status)
3. **payment_batches** -- batch payments (bank_account_id, batch_date, batch_type, payment_count, total_amount, status)
4. **credit_notes** -- AR credit notes (customer_id, credit_note_number, credit_date, amount, amount_applied, reason, status)
5. **customer_advances** -- AR customer advances (customer_id, advance_number, advance_date, original_amount, remaining_amount, status)
6. **bad_debt_provisions** -- bad debt write-offs (customer_id, invoice_id, provision_date, amount, status)
7. **petty_cash_funds** -- petty cash fund management (fund_name, custodian_id, float_amount, current_balance, status)
8. **petty_cash_vouchers** -- petty cash transactions (fund_id, voucher_number, voucher_date, payee_name, amount, status)
9. **staff_advances** -- employee advances (employee_id, advance_number, advance_date, requested_amount, disbursed_amount, settled_amount, status)
10. **asset_revaluations** -- fixed asset revaluations (asset_id, revaluation_date, old_value, new_value, adjustment_amount, reason)
11. **asset_disposals** -- fixed asset disposals (asset_id, disposal_date, disposal_method, proceeds, net_book_value_at_disposal)
12. **debit_notes** -- AP debit notes (supplier_id, debit_note_number, debit_date, amount, status)
13. **vendor_advances** -- AP vendor advances (supplier_id, advance_number, advance_date, amount, remaining_amount, status)
14. **wht_certificates** -- withholding tax (supplier_id, certificate_number, amount, tax_period, status)
15. **vendor_payments** -- separate from supplier_payments for extended fields (payment_number, supplier_id, amount, payment_method, status)
16. **transaction_rules** -- bank auto-categorization rules (pattern, account_id, description_template)
17. **expense_categories** -- expense type classification (category_name, category_code, parent_id)
18. **pos_sales** -- POS sales data (sale_number, sale_date, customer_id, total_amount, payment_method, status)

### Missing Hooks (~25 new hooks)

**GL**: `useGeneralLedger`, `useLedgerTotals`, `useLedgerSummary`
**AP**: `useInvoices` (vendor), `useVendorPayments`, `useDebitNotes`, `useVendorAdvances`, `useWHTCertificates` (each with stats hook)
**AR**: `useCustomerInvoices`, `useCustomerReceipts` (extended), `useCreditNotes`, `useCustomerAdvances`, `useBadDebtProvisions` (each with stats)
**Banking**: `useBankAccounts` (extended with stats), `useBankTransactions` (extended with stats), `useCheques`, `useFundTransfers`, `usePaymentBatches`, `usePOSSales`
**Assets**: `useFixedAssets` (with stats + batch depreciation)
**Reports**: `useCostCenters` (with stats)
**Expenses**: `useExpensesDashboard`, `usePettyCashFunds`, `usePettyCashVouchers`, `useStaffAdvances`

### Missing Shared Components

1. **`src/components/shared/CreatedByCell.tsx`** -- renders user avatar/name from user ID
2. **`src/components/shared/DataTable.tsx`** -- generic table with column render functions and onRowClick (StoresONE's custom DataTable, different from shadcn data-table)

### Implementation Order (by dependency)

Due to massive scope (~18 migrations, ~25 hooks, ~40+ components), recommend splitting into sub-phases:

**Phase 3a: Foundation + GL + Assets** (~15 files)
- Create shared components (CreatedByCell, custom DataTable)
- Create GL hooks (useGeneralLedger, useLedgerTotals, useLedgerSummary)
- Create fixed asset hooks (useFixedAssets + stats)
- Migrations: asset_revaluations, asset_disposals
- Expand GLModule to 8 sub-tabs (add Dashboard, Recurring, Currencies, Period Closing, Approvals)
- Expand FixedAssetsModule to 5 sub-tabs (add Revaluations, Transfers, Disposals)

**Phase 3b: AP Expansion** (~20 files)
- Migrations: debit_notes, vendor_advances, wht_certificates, vendor_payments
- Hooks: useInvoices, useVendorPayments, useDebitNotes, useVendorAdvances, useWHTCertificates
- Components: VendorDetailPage, PaymentFormDialog, DebitNoteFormDialog, VendorAdvanceFormDialog, WHTFormDialog, APAgingChart, VendorPaymentCenter, APReconciliationPanel, ScheduledPaymentsTab
- Expand APModule to 11 sub-tabs

**Phase 3c: AR Expansion** (~18 files)
- Migrations: credit_notes, customer_advances, bad_debt_provisions
- Hooks: useCustomerInvoices (extended), useCreditNotes, useCustomerAdvances, useBadDebtProvisions
- Components: CustomerDetailPage, CreditNoteFormDialog, AdvanceFormDialog, BadDebtFormDialog, ARAgingChart, ReconciliationPanel, RecurringInvoicesTab, PaymentRemindersTab
- Expand ARModule to 11 sub-tabs

**Phase 3d: Banking Expansion** (~15 files)
- Migrations: cheques, fund_transfers, payment_batches, transaction_rules, pos_sales
- Hooks: useCheques, useFundTransfers, usePaymentBatches, usePOSSales, extended useBankAccounts/useBankTransactions
- Components: ChequeFormDialog, FundTransferFormDialog, PaymentBatchFormDialog, TransactionRulesTab, BankReconciliationPanel (enhanced), detail panels
- Expand BankingModule to 9 sub-tabs

**Phase 3e: Reports + Settings Expansion** (~25 files)
- Hooks: useCostCenters (with stats)
- Reports components: VarianceReport, SalesPerformanceReport, SegmentReport, TaxReturnsReport, AuditLogsReport, ReportBuilderReport, CashFlowForecastReport, SSCLReport, ScheduledReportsTab
- Settings components: CompanySetup, AccountMappingTab, PaymentModesTab, DocumentTemplatesTab, EmailTemplatesTab, CustomFieldsTab, CostingBudgetTab, ApprovalWorkflowTab, UserActivityTab, NotificationSettingsTab, DataImportTab
- Expand ReportsModule to 14 sub-tabs
- Expand SettingsModule to 13 sub-tabs

**Phase 3f: Expenses Completion** (~12 files)
- Migrations: petty_cash_funds, petty_cash_vouchers, staff_advances, expense_categories
- Hooks: useExpensesDashboard, usePettyCashFunds, usePettyCashVouchers, useStaffAdvances
- Components: ExpensesByTypeChart, TopCostCentersChart, PettyCashFundFormDialog, PettyCashVoucherFormDialog, StaffAdvanceFormDialog, SettlementFormDialog, ExpenseDetailsPanel
- Fully wire ExpensesModule

### Recommendation

This is too large for a single implementation. I recommend starting with **Phase 3a** (GL + Assets + shared components) as it establishes the pattern for all other expansions. Shall I proceed with Phase 3a, or would you prefer a different sub-phase?

