
# Continue Finance Module Development
## Phase 2-6 Implementation

---

## Current State Summary

### Database Infrastructure (Complete)
| Component | Tables | Functions |
|-----------|--------|-----------|
| Payment Terms | `payment_terms`, `invoice_payment_schedule` | - |
| Bank Reconciliation | `bank_statement_imports`, `bank_statement_lines`, `bank_reconciliation_sessions` | `match_bank_transactions()` |
| Fixed Assets | `asset_master`, `depreciation_schedule` | `calculate_depreciation()` |
| Multi-Currency | `currencies`, `exchange_rates` | `run_fx_revaluation()` |
| Tax Management | `tax_templates`, `tax_template_details` | - |
| Dunning | `dunning_levels`, `dunning_history` | - |

### UI Components Needing Implementation
The database is ready - now we build the frontend.

---

## Implementation Plan

### 1. Payment Terms Management (New Module)

**New Components:**
```text
src/components/finance/settings/
  - PaymentTermsList.tsx       // CRUD for payment terms
  - CreatePaymentTermDialog.tsx // Add new payment terms
```

**Features:**
- View/create/edit payment terms (Net 30, 2% 10 Net 30, etc.)
- Set company-level defaults
- Calculate due dates automatically on invoices

**Update Invoice Dialogs:**
- Add payment terms dropdown to `CreateSupplierInvoiceDialog`
- Add payment terms dropdown to `CreateCustomerInvoiceDialog`
- Auto-calculate due date based on selected terms
- Show early payment discount information

---

### 2. Invoice Payment Allocation

**New Components:**
```text
src/components/finance/ap/
  - PaymentAllocationDialog.tsx   // Allocate payment to invoices
  - OutstandingInvoicesTable.tsx  // Select invoices to pay
```

**Features:**
- When creating payment, show outstanding invoices for supplier
- Allow allocation to multiple invoices
- Track partial payments
- Calculate early payment discounts if within discount period
- Update invoice `amount_paid` and `status` automatically

---

### 3. Bank Statement Import & Reconciliation

**New Components:**
```text
src/components/finance/bank/
  - BankStatementImport.tsx       // CSV file upload
  - StatementLinesList.tsx        // View imported lines
  - ReconciliationWorkspace.tsx   // Side-by-side matching
  - AutoMatchResults.tsx          // Show match suggestions
```

**Bank Statement Import Flow:**
1. Upload CSV file (detect format)
2. Parse and validate rows
3. Insert to `bank_statement_imports` and `bank_statement_lines`
4. Show imported transactions for matching

**Auto-Matching Integration:**
- Call `match_bank_transactions()` RPC
- Display match suggestions with confidence scores
- One-click accept/reject matches
- Manual matching for unmatched items
- Mark reconciled items

---

### 4. Fixed Asset Depreciation Engine

**Update Existing Components:**

`RunDepreciationDialog.tsx`:
- Connect to `calculate_depreciation()` database function
- Show preview of depreciation amounts before posting
- Create journal entries on confirmation
- Update `asset_master.accumulated_depreciation`

`DepreciationScheduleView.tsx`:
- Already connected to `depreciation_schedule` table
- Add filtering by period/asset category
- Add drill-down to journal entry

**New Components:**
```text
src/components/finance/assets/
  - CreateAssetDialog.tsx         // Add new fixed asset
  - AssetDisposalDialog.tsx       // Record asset disposal
  - AssetTransferDialog.tsx       // Transfer between cost centers
```

---

### 5. Multi-Currency Management

**New Components:**
```text
src/components/finance/settings/
  - CurrencyList.tsx              // View/manage currencies
  - ExchangeRatesList.tsx         // Exchange rate history
  - CreateExchangeRateDialog.tsx  // Add/update rates
```

**New Page:**
```text
src/pages/finance/CurrencySettings.tsx
```

**Features:**
- Define base currency and enabled currencies
- Maintain exchange rate history (spot/average/closing)
- FX Revaluation runner using `run_fx_revaluation()`
- Track unrealized FX gains/losses

**Update Invoice Components:**
- Add currency selector
- Auto-populate exchange rate from `exchange_rates` table
- Calculate base currency amounts

---

### 6. Tax Management

**New Components:**
```text
src/components/finance/settings/
  - TaxTemplateList.tsx           // View tax templates
  - CreateTaxTemplateDialog.tsx   // Create VAT/GST templates
  - TaxTemplateDetails.tsx        // Configure tax components
```

**New Page:**
```text
src/pages/finance/TaxSettings.tsx
```

**Features:**
- Create tax templates (VAT, GST, Withholding)
- Define tax components with rates and GL accounts
- Apply templates to invoices
- Tax-inclusive vs tax-exclusive calculation
- Tax report generation (output tax, input tax, net payable)

---

### 7. GL Integration - Auto-Posting Triggers

**Database Triggers/Functions:**
```text
post_supplier_invoice_to_gl():
  - On invoice POST status change
  - Debit: Expense Account (from invoice lines)
  - Debit: Input Tax Account
  - Credit: Accounts Payable (supplier)

post_supplier_payment_to_gl():
  - On payment POST status change
  - Debit: Accounts Payable (supplier)
  - Credit: Bank Account
  - Handle withholding tax deduction

post_customer_invoice_to_gl():
  - Debit: Accounts Receivable (customer)
  - Credit: Revenue Account
  - Credit: Output Tax Account

post_customer_receipt_to_gl():
  - Debit: Bank Account
  - Credit: Accounts Receivable (customer)
```

---

### 8. Settings Hub Page

**New Page:**
```text
src/pages/finance/FinanceSettings.tsx
```

**Tabs:**
- Payment Terms
- Currencies & Exchange Rates
- Tax Templates
- GL Account Defaults
- Period Management

---

## File Structure Summary

### New Files to Create

**Components (12 files):**
```text
src/components/finance/settings/
  - PaymentTermsList.tsx
  - CreatePaymentTermDialog.tsx
  - CurrencyList.tsx
  - ExchangeRatesList.tsx
  - CreateExchangeRateDialog.tsx
  - TaxTemplateList.tsx
  - CreateTaxTemplateDialog.tsx

src/components/finance/ap/
  - PaymentAllocationDialog.tsx
  - OutstandingInvoicesTable.tsx

src/components/finance/bank/
  - BankStatementImport.tsx
  - ReconciliationWorkspace.tsx

src/components/finance/assets/
  - CreateAssetDialog.tsx
```

**Pages (2 files):**
```text
src/pages/finance/
  - FinanceSettings.tsx
  - CurrencySettings.tsx
```

**Hooks (3 files):**
```text
src/hooks/finance/
  - usePaymentTerms.ts
  - useCurrencies.ts
  - useTaxTemplates.ts
```

### Files to Update

**Invoice Dialogs:**
- `CreateSupplierInvoiceDialog.tsx` - Add payment terms, currency
- `CreateCustomerInvoiceDialog.tsx` - Add payment terms, currency
- `CreatePaymentDialog.tsx` - Add invoice allocation

**Bank Reconciliation:**
- `BankReconciliation.tsx` - Integrate import and auto-match

**Fixed Assets:**
- `RunDepreciationDialog.tsx` - Connect to DB function

---

## Database Migrations

### Add GL Account References
```sql
-- Add payment_terms_id to invoices (link to structured payment_terms)
ALTER TABLE supplier_invoices ADD COLUMN payment_terms_id uuid REFERENCES payment_terms(id);
ALTER TABLE customer_invoices ADD COLUMN payment_terms_id uuid REFERENCES payment_terms(id);

-- Add default GL accounts for auto-posting
ALTER TABLE suppliers ADD COLUMN default_expense_account_id uuid REFERENCES chart_of_accounts(id);
ALTER TABLE customers ADD COLUMN default_revenue_account_id uuid REFERENCES chart_of_accounts(id);
```

### Auto-Posting Functions
```sql
CREATE OR REPLACE FUNCTION post_invoice_to_gl()
RETURNS TRIGGER AS $$
-- Auto-create journal entries when invoice is posted
$$;
```

---

## Implementation Order

| Priority | Module | Effort | Files |
|----------|--------|--------|-------|
| 1 | Payment Terms UI | Low | 2 components, 1 hook |
| 2 | Enhanced Invoice Dialogs | Low | Update 2 existing |
| 3 | Payment Allocation | Medium | 2 components |
| 4 | Bank Statement Import | Medium | 2 components |
| 5 | Auto-Match Integration | Medium | Update reconciliation |
| 6 | Depreciation Connection | Low | Update 1 dialog |
| 7 | Currency Management | Medium | 3 components, 1 hook |
| 8 | Tax Templates | Medium | 3 components, 1 hook |
| 9 | GL Auto-Posting | High | DB triggers |
| 10 | Finance Settings Page | Low | 1 page |

---

## Technical Considerations

### Hooks Pattern
All new hooks will follow existing patterns:
- Use `@tanstack/react-query` for data fetching
- Company-scoped queries via `useCompany()` context
- Optimistic updates with `queryClient.invalidateQueries()`

### Form Validation
All dialogs will use:
- `react-hook-form` with `zod` schema validation
- Consistent error messaging via `FormMessage`

### Security
- All new tables already have RLS policies from migrations
- Finance role required for sensitive operations
- Audit trail via `created_by`/`updated_at` columns

### Performance
- Indexes already created on foreign keys
- Use `STABLE` functions for RLS helpers
- Lazy-load heavy components (reports, large tables)
