
# Finance Module Development - Phase 2-6 UI Implementation

## Current State Analysis

### Database Infrastructure (Complete)
| Component | Status | Tables/Functions |
|-----------|--------|------------------|
| Bank Statement Import | Ready | `bank_statement_imports`, `bank_statement_lines` |
| Auto-Matching | Ready | `match_bank_transactions()` RPC |
| Payment Allocations | Ready | `payment_allocations` table |
| Payment Terms | Ready | `payment_terms` table |
| Currencies | Ready | `currencies`, `exchange_rates` tables |
| Tax Templates | Ready | `tax_templates`, `tax_template_details` tables |

### Frontend Gaps Identified
- Invoice dialogs missing payment terms/currency/tax integration
- Payment dialogs missing invoice allocation
- Bank reconciliation missing import and auto-match features
- Settings UI components created but not fully wired

---

## Implementation Plan

### 1. Bank Statement Import Component

**New File:** `src/components/finance/bank/BankStatementImport.tsx`

Features:
- CSV file upload with drag-and-drop
- Auto-detect column mapping (date, description, debit, credit, reference)
- Preview parsed transactions before import
- Insert to `bank_statement_imports` and `bank_statement_lines` tables
- Progress indicator for large files

**New Hook:** `src/hooks/finance/useBankStatementImport.ts`
- Handle file parsing logic
- Column mapping state
- Insert mutations

---

### 2. Auto-Match Integration & Reconciliation Workspace

**New File:** `src/components/finance/bank/ReconciliationWorkspace.tsx`

Features:
- Side-by-side view: Bank statement lines vs Book transactions
- Call `match_bank_transactions()` RPC after import
- Display match suggestions with confidence scores (High/Medium/Low)
- One-click accept/reject matches
- Manual drag-and-drop matching for unmatched items
- Update match status in `bank_statement_lines`

**Update:** `src/pages/finance/BankReconciliation.tsx`
- Integrate BankStatementImport dialog
- Add ReconciliationWorkspace tab
- Implement actual reconciliation logic (update `is_reconciled` on transactions)

---

### 3. Payment Allocation System

**New File:** `src/components/finance/ap/PaymentAllocationDialog.tsx`

Features:
- Show outstanding invoices for selected supplier
- Multi-select invoices to allocate payment
- Auto-calculate allocation amounts
- Support partial payments
- Calculate early payment discounts when applicable
- Create entries in `payment_allocations` table
- Update invoice `amount_paid` and `status`

**Update:** `src/components/finance/ap/CreatePaymentDialog.tsx`
- Add "Allocate to Invoices" section
- Show total outstanding for supplier
- Link to PaymentAllocationDialog

**New File:** `src/components/finance/ar/ReceiptAllocationDialog.tsx`
- Same as AP but for customer receipts

**Update:** `src/components/finance/ar/CreateReceiptDialog.tsx`
- Add allocation capability

---

### 4. Enhanced Invoice Dialogs

**Update:** `src/components/finance/ap/CreateSupplierInvoiceDialog.tsx`

Add fields:
- Payment Terms dropdown (from `payment_terms` table)
- Auto-calculate due date based on payment terms
- Currency selector (from `currencies` table)
- Exchange rate (auto-fetch from `exchange_rates`)
- Tax Template dropdown (from `tax_templates`)
- Tax amount calculation based on template
- Base currency amount display

**Update:** `src/components/finance/ar/CreateCustomerInvoiceDialog.tsx`
- Same enhancements as supplier invoice

---

### 5. GL Auto-Posting Triggers

**Database Migration:** Create auto-posting functions

```text
post_supplier_invoice_to_gl():
  - Triggered when invoice status changes to 'posted'
  - Debit: Expense Account (from invoice lines or supplier default)
  - Debit: Input Tax Account (from tax template)
  - Credit: Accounts Payable Control Account

post_supplier_payment_to_gl():
  - Triggered when payment status changes to 'posted'
  - Debit: Accounts Payable Control Account
  - Credit: Bank Account
  - Handle discount taken entries

post_customer_invoice_to_gl():
  - Debit: Accounts Receivable Control Account
  - Credit: Revenue Account
  - Credit: Output Tax Account

post_customer_receipt_to_gl():
  - Debit: Bank Account
  - Credit: Accounts Receivable Control Account
```

---

## Files to Create

| File Path | Purpose |
|-----------|---------|
| `src/components/finance/bank/BankStatementImport.tsx` | CSV import dialog |
| `src/components/finance/bank/ReconciliationWorkspace.tsx` | Side-by-side matching UI |
| `src/components/finance/ap/PaymentAllocationDialog.tsx` | Allocate payments to invoices |
| `src/components/finance/ar/ReceiptAllocationDialog.tsx` | Allocate receipts to invoices |
| `src/hooks/finance/useBankStatementImport.ts` | Import logic and parsing |
| `src/hooks/finance/usePaymentAllocation.ts` | Allocation logic |

## Files to Update

| File Path | Changes |
|-----------|---------|
| `src/pages/finance/BankReconciliation.tsx` | Add import dialog, workspace, reconcile action |
| `src/components/finance/ap/CreateSupplierInvoiceDialog.tsx` | Add payment terms, currency, tax |
| `src/components/finance/ap/CreatePaymentDialog.tsx` | Add allocation section |
| `src/components/finance/ar/CreateCustomerInvoiceDialog.tsx` | Add payment terms, currency, tax |
| `src/components/finance/ar/CreateReceiptDialog.tsx` | Add allocation section |

---

## Implementation Order

| Priority | Task | Effort | Dependencies |
|----------|------|--------|--------------|
| 1 | Bank Statement Import | Medium | useBankStatementImport hook |
| 2 | Reconciliation Workspace | Medium | Bank import complete |
| 3 | Update BankReconciliation page | Low | Import + Workspace ready |
| 4 | Payment Allocation Dialog (AP) | Medium | None |
| 5 | Receipt Allocation Dialog (AR) | Medium | None |
| 6 | Update Invoice Dialogs | Medium | usePaymentTerms, useCurrencies hooks |
| 7 | GL Auto-Posting Triggers | High | Invoice dialogs updated |

---

## Technical Details

### Bank Statement CSV Parsing

Supported formats:
- Generic CSV (auto-detect columns)
- Standard bank export (Date, Description, Debit, Credit, Balance)

Column mapping logic:
```text
- Date columns: look for "date", "transaction_date", "value_date"
- Amount columns: "debit", "credit", "amount", "withdrawal", "deposit"
- Reference columns: "reference", "ref", "check_no", "cheque"
- Description: "description", "narrative", "particulars", "memo"
```

### Match Confidence Scoring (from existing RPC)

| Score | Criteria |
|-------|----------|
| High (90+) | Exact amount + reference match |
| Medium (70-89) | Amount match + date within 3 days |
| Low (50-69) | Amount within tolerance + similar description |

### Invoice Status Flow

```text
draft -> submitted -> approved -> posted -> paid
                  \-> rejected

On status change to 'posted':
  - GL auto-posting trigger fires
  - Journal entry created
  - Invoice linked to journal entry
```

### Security Considerations
- All operations use company-scoped RLS
- Finance role required for posting operations
- Audit trail via `created_by`, `updated_at` columns
