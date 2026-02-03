
# Complete Finance Module Development Plan
## ERPNext-Inspired Accounting System

This plan outlines the complete implementation of a professional-grade accounting system based on ERPNext's architecture, adapted for your React/Supabase stack.

---

## Current State Assessment

### Already Implemented (Functional)
- Chart of Accounts with hierarchical tree structure
- Journal Entries (create, post, void, reverse)
- Trial Balance Report (via database function)
- Basic Bank Accounts & Transactions
- Customer/Supplier master data
- Basic invoice structures (AP/AR)

### Partially Implemented (Need Data Connection)
- Profit & Loss Report (uses static data)
- Balance Sheet Report (uses static data)
- Cash Flow Report (placeholder)
- Asset Register (UI only)
- Budget Management (UI only)
- Cost Centers (UI only)

---

## Phase 1: Financial Statements (Core Reports)

### 1.1 Profit & Loss Statement
**Database Changes:**
```text
- Create get_profit_loss_report() function that:
  - Aggregates revenue accounts (credits - debits)
  - Aggregates expense accounts (debits - credits)
  - Groups by account category/subcategory
  - Supports date range filtering
  - Handles multi-period comparison
```

**Frontend Updates:**
- Replace static data with real GL data
- Add date range picker (period selector)
- Add comparative columns (vs prior period/budget)
- Export to PDF/Excel functionality

### 1.2 Balance Sheet
**Database Changes:**
```text
- Create get_balance_sheet() function that:
  - Assets = Debit balances from asset accounts
  - Liabilities = Credit balances from liability accounts
  - Equity = Credit balances + Retained Earnings
  - Calculate Retained Earnings from P&L accounts
```

**Frontend Updates:**
- Connect to real account balances
- Add drill-down to account details
- Support as-of-date selection
- Validate Assets = Liabilities + Equity

### 1.3 Cash Flow Statement
**Database Changes:**
```text
- Create cash_flow_mappings table:
  | account_id | cash_flow_category | activity_type |
  - Categories: Operating, Investing, Financing
  
- Create get_cash_flow_statement() function using:
  - Direct method: Cash receipts/payments by category
  - Indirect method: Net income + adjustments
```

**Frontend Updates:**
- Build interactive cash flow report
- Support both direct and indirect methods
- Add trend analysis charts

---

## Phase 2: Accounts Payable/Receivable Completion

### 2.1 Enhanced Invoice Management

**New Database Tables:**
```text
payment_terms:
- id, name, description
- credit_days, discount_days, discount_percent
- company_id

invoice_payment_schedule:
- id, invoice_id, invoice_type (customer/supplier)
- due_date, amount, discount_date, discount_amount
- paid_amount, status (pending/partial/paid)
```

**Features to Implement:**
- Invoice aging with 30/60/90/120+ day buckets
- Payment schedule per invoice (multiple due dates)
- Early payment discount tracking
- Credit limit checking on sales invoices
- Invoice approval workflow
- Recurring invoices

### 2.2 Payment Allocation System

**Database Changes:**
```text
Enhance payment_allocations table:
- Add discount_taken, write_off_amount
- Add allocation_date, cleared_date
- Link to GL posting

Create payment_runs table for batch payments:
- id, payment_date, bank_account_id
- total_amount, status
- payment_method (check/eft/wire)
```

**Frontend Updates:**
- Payment allocation dialog with invoice matching
- Batch payment processing
- Check printing / EFT file generation
- Customer statements generation

### 2.3 Dunning & Collections

**New Tables:**
```text
dunning_levels:
- id, level_number, days_overdue
- fee_amount, fee_percent
- letter_template, company_id

dunning_history:
- id, customer_id, invoice_id
- dunning_level, dunning_date
- letter_sent, response_notes
```

---

## Phase 3: Bank & Reconciliation

### 3.1 Bank Statement Import

**New Tables:**
```text
bank_statement_imports:
- id, bank_account_id, file_name
- import_date, statement_date
- opening_balance, closing_balance
- status (pending/processed/reconciled)

bank_statement_lines:
- id, import_id, line_number
- transaction_date, value_date
- description, reference
- debit_amount, credit_amount
- matched_transaction_id, match_status
```

**Features:**
- CSV/OFX/MT940 file parsing
- Auto-detection of bank format
- Duplicate detection

### 3.2 Auto-Matching Engine

**Database Function:**
```text
match_bank_transactions():
- Exact match by amount + reference
- Fuzzy match by amount within tolerance
- Date proximity scoring
- Vendor/customer name matching
- Create match suggestions with confidence score
```

**Frontend:**
- Side-by-side comparison (bank vs books)
- One-click match confirmation
- Manual match override
- Bulk reconciliation

### 3.3 Bank Reconciliation Workflow

**New Tables:**
```text
bank_reconciliation_sessions:
- id, bank_account_id
- period_start, period_end
- statement_balance, book_balance
- reconciled_balance, difference
- status (in_progress/completed)
- completed_by, completed_at
```

**Features:**
- Reconciliation adjustment entries
- Outstanding items report
- Historical reconciliation view

---

## Phase 4: Fixed Assets & Depreciation

### 4.1 Asset Master Enhancement

**Schema Updates to asset_master:**
```text
Add columns:
- asset_category_id (FK)
- purchase_invoice_id, supplier_id
- depreciation_method (straight_line/declining_balance/units)
- useful_life_years, salvage_value
- depreciation_start_date
- accumulated_depreciation
- net_book_value
- disposal_date, disposal_value, disposal_account_id
```

### 4.2 Depreciation Calculation Engine

**Database Functions:**
```text
calculate_depreciation():
- Straight-line: (Cost - Salvage) / Useful Life
- Declining balance: NBV x Rate
- Units of production: (Cost - Salvage) x (Units/Total Units)
- Pro-rata for partial periods

run_depreciation_batch(period_date):
- Calculate depreciation for all active assets
- Create journal entries (Depreciation Exp / Accum Dep)
- Update asset NBV
```

### 4.3 Asset Transactions

**Features:**
- Asset acquisition from PO
- Asset transfers between cost centers
- Asset revaluation
- Asset impairment
- Asset disposal (sale/scrap/write-off)
- Capital work-in-progress (CWIP)

---

## Phase 5: Multi-Currency Support

### 5.1 Currency Setup

**New Tables:**
```text
currencies:
- id, code (USD, EUR, LKR)
- name, symbol, decimal_places
- is_base_currency

exchange_rates:
- id, from_currency, to_currency
- rate_date, exchange_rate
- rate_type (spot/average/closing)
```

### 5.2 Transaction Currency Handling

**Schema Updates:**
```text
Add to journal_entry_lines:
- transaction_currency
- transaction_amount
- exchange_rate
- base_currency_amount (calculated)

Add to invoices:
- currency_code
- exchange_rate_at_invoice
- base_currency_total
```

### 5.3 Foreign Exchange Revaluation

**Database Function:**
```text
run_fx_revaluation(as_of_date):
- Identify foreign currency balances
- Calculate unrealized gain/loss
- Post adjustment entries
- Track realized vs unrealized
```

---

## Phase 6: Tax Management

### 6.1 Tax Configuration

**New Tables:**
```text
tax_templates:
- id, name, description
- tax_type (vat/gst/sales_tax/withholding)
- is_default, company_id

tax_template_details:
- id, template_id
- tax_component_name
- tax_rate, account_id
- is_included_in_price
```

### 6.2 Tax Calculations

**Features:**
- Tax-inclusive vs tax-exclusive pricing
- Compound tax calculations
- Reverse charge VAT
- Withholding tax on payments
- Tax exemption handling

### 6.3 Tax Reports

**New Tables:**
```text
tax_returns:
- id, period_start, period_end
- tax_type, status
- output_tax, input_tax
- net_tax_payable
- filing_date, reference_number

tax_return_lines:
- id, return_id
- category, description
- taxable_amount, tax_amount
```

---

## Phase 7: Period Close & Year-End

### 7.1 Period Management

**Enhance accounting_periods table:**
```text
Add columns:
- soft_close_date (warnings only)
- hard_close_date (prevents posting)
- closed_by, closed_at
- ap_closed, ar_closed, fa_closed, gl_closed
```

### 7.2 Period Close Checklist

**New Table:**
```text
period_close_tasks:
- id, period_id, task_order
- task_name, task_type
- status (pending/completed/skipped)
- completed_by, completed_at, notes
```

**Standard Tasks:**
- Bank reconciliation complete
- Depreciation posted
- Accruals/prepayments posted
- Intercompany cleared
- All invoices posted
- FX revaluation done

### 7.3 Year-End Close

**Database Function:**
```text
year_end_close(fiscal_year_id):
- Validate all periods closed
- Calculate net income
- Post closing entries (Revenue/Expense to Retained Earnings)
- Generate comparative reports
- Lock prior year
```

---

## Phase 8: Module Integrations

### 8.1 Sales Integration

**Auto-posting Logic:**
```text
On customer_invoice POST:
- Debit: Accounts Receivable (customer)
- Credit: Revenue Account (per line item)
- Credit: Tax Payable (per tax component)

On customer_receipt POST:
- Debit: Bank/Cash Account
- Credit: Accounts Receivable (customer)
```

### 8.2 Purchase Integration

**Auto-posting Logic:**
```text
On supplier_invoice POST:
- Debit: Expense/Inventory Account (per line)
- Debit: Input Tax Account
- Credit: Accounts Payable (supplier)

On supplier_payment POST:
- Debit: Accounts Payable (supplier)
- Credit: Bank/Cash Account
- Handle withholding tax deduction
```

### 8.3 Inventory Costing

**New Tables:**
```text
inventory_gl_settings:
- id, item_category_id
- inventory_account_id
- cogs_account_id
- variance_account_id
- costing_method (fifo/lifo/average/specific)

inventory_valuation_entries:
- id, transaction_type, transaction_id
- item_id, quantity, unit_cost
- total_value, running_balance
```

**Auto-posting:**
- GRN receipt: Debit Inventory, Credit GR/IR Clearing
- Material issue: Debit COGS/WIP, Credit Inventory
- Periodic average cost calculation

### 8.4 Payroll Integration

**New Tables:**
```text
payroll_posting_rules:
- id, payroll_component_id
- debit_account_id, credit_account_id
- cost_center_id

payroll_journal_entries:
- id, payroll_period_id
- journal_entry_id
- posted_at, posted_by
```

---

## Implementation Summary

### New Database Tables (16)
1. payment_terms
2. invoice_payment_schedule
3. payment_runs
4. dunning_levels
5. dunning_history
6. bank_statement_imports
7. bank_statement_lines
8. bank_reconciliation_sessions
9. currencies
10. exchange_rates
11. tax_templates
12. tax_template_details
13. tax_returns
14. tax_return_lines
15. period_close_tasks
16. payroll_posting_rules

### Database Functions (12)
1. get_profit_loss_report()
2. get_balance_sheet()
3. get_cash_flow_statement()
4. calculate_aging_buckets()
5. match_bank_transactions()
6. calculate_depreciation()
7. run_depreciation_batch()
8. run_fx_revaluation()
9. calculate_tax()
10. year_end_close()
11. post_invoice_to_gl()
12. post_payment_to_gl()

### New/Updated UI Components (25+)
- Financial statement reports (3)
- Invoice management dialogs (4)
- Payment processing screens (3)
- Bank reconciliation interface (4)
- Asset management screens (4)
- Tax configuration dialogs (3)
- Period close wizard (2)
- Integration settings (2+)

---

## Recommended Implementation Order

| Order | Module | Effort | Dependencies |
|-------|--------|--------|--------------|
| 1 | Financial Statements | Medium | Chart of Accounts |
| 2 | AP/AR Payment Terms | Medium | Invoices |
| 3 | Bank Statement Import | Medium | Bank Accounts |
| 4 | Auto-Matching Engine | High | Bank Import |
| 5 | Fixed Asset Depreciation | Medium | Asset Master |
| 6 | Multi-Currency | High | All transactions |
| 7 | Tax Management | High | Invoices |
| 8 | Period Close | Medium | All modules |
| 9 | Sales GL Integration | Medium | AR, GL |
| 10 | Purchase GL Integration | Medium | AP, GL |
| 11 | Inventory Costing | High | Inventory, GL |
| 12 | Payroll Integration | Medium | Payroll, GL |

---

## Technical Considerations

### Performance
- Use database views for complex reports
- Implement materialized views for period snapshots
- Add indexes on date ranges and foreign keys
- Consider partitioning journal_entries by fiscal year

### Security
- All new tables require company-scoped RLS
- Finance role required for GL posting
- Audit trail on all financial transactions
- Approval workflows for high-value transactions

### Data Integrity
- Balanced journal entries enforced by triggers
- Prevent posting to closed periods
- Validate invoice totals match line totals
- Enforce sequential numbering

