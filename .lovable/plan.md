

## Fix All Errors in Finance & Accounting Module

### Root Cause Analysis

The session replay shows: **"Error loading report: column coa.parent_id does not exist"**. This is caused by database RPC functions referencing `coa.parent_id` when the actual column is `parent_account_id`. Additionally, hooks reference non-existent columns on `journal_entries` and `suppliers`.

### Errors Found

**1. Database RPCs -- wrong column name `parent_id` (should be `parent_account_id`)**
- `get_profit_loss_report`: references `coa.parent_id` (lines 70, 118) -- should be `coa.parent_account_id`
- `get_balance_sheet`: references `coa.parent_id` (lines 189, 212, 219) -- should be `coa.parent_account_id`
- Both functions also output `parent_id` in their RETURNS TABLE -- needs renaming to `parent_account_id` or aliasing

**Fix**: New migration to `CREATE OR REPLACE` both functions, replacing all `coa.parent_id` with `coa.parent_account_id` (aliased as `parent_id` in output to maintain frontend compatibility).

**2. `useGeneralLedger` hook -- wrong column names on `journal_entries`**
- File: `src/hooks/finance/useGeneralLedger.ts`
- References `entry_number`, `entry_date`, `source_type` -- actual columns are `journal_number`, `journal_date` (no `source_type` column)
- Filter references `journal_entries.entry_date` -- should be `journal_entries.journal_date`

**Fix**: Update the select to use `journal_number, journal_date, description, status, journal_type` and fix the filter column names.

**3. AP hooks -- wrong foreign key column name on suppliers**
- File: `src/hooks/finance/useAPExpansion.ts`
- `useDebitNotes`: selects `supplier:suppliers(supplier_name)` -- should be `suppliers(name)`
- `useWHTCertificates`: selects `supplier:suppliers(supplier_name)` -- should be `suppliers(name)`
- `useVendorAdvances` (line ~80): likely same issue

**Fix**: Replace `supplier_name` with `name` in all supplier relation selects.

**4. Frontend type references**
- `src/hooks/useFinancialReports.ts`: `ProfitLossRow` and `BalanceSheetRow` interfaces have `parent_id` field -- keep as-is since the RPC will alias `parent_account_id` as `parent_id` for compatibility.

### Implementation Steps

1. **Database migration**: Fix `get_profit_loss_report` and `get_balance_sheet` RPCs to use `coa.parent_account_id` (aliased as `parent_id` in output)
2. **Fix `useGeneralLedger.ts`**: Correct column names (`journal_number`, `journal_date`, `journal_type`)
3. **Fix `useAPExpansion.ts`**: Change `suppliers(supplier_name)` to `suppliers(name)` in 3 places
4. **Check `useARExpansion.ts`**: Customer relation selects use `customers(customer_name)` which is correct -- no change needed

### Technical Details

The migration will use `CREATE OR REPLACE FUNCTION` to update both RPCs in-place, keeping the same function signatures and output column names for frontend compatibility. The key change is `coa.parent_id` → `coa.parent_account_id` and `GROUP BY ... coa.parent_id` → `GROUP BY ... coa.parent_account_id`.

