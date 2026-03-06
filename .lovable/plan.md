

## Plan: Separate Item Master (Global) from Inventory (Company-Scoped)

### Problem
Both the Item Master Definition tab and the Inventory tab use `useWarehouseItems`, which filters by `selectedCompany.id`. This means item definitions are hidden when switching companies.

### Solution
Add a `skipCompanyFilter` option to `useWarehouseItems` so the Item Master Definition tab can show all items across all companies, while the Inventory tab continues filtering by company.

### Changes

**1. `src/hooks/useWarehouseItems.ts`**
- Add an optional parameter `options?: { skipCompanyFilter?: boolean }` to `useWarehouseItems`
- When `skipCompanyFilter` is true, skip the `company_id` filter in the query
- Include the flag in the query key for proper caching

**2. `src/components/warehouse/ItemMasterDefinitionTab.tsx`**
- Call `useWarehouseItems({ skipCompanyFilter: true })` so all items from all companies are visible
- Add a "Company" column to the table showing which company each item belongs to (or "All Companies" if null)

**3. `src/components/warehouse/ItemMasterTab.tsx` (Inventory tab)**
- No changes needed — it already filters by company via the default behavior

### Technical Detail
In `useWarehouseItems.ts`, the company filter logic (lines 28-31) currently reads:
```typescript
if (!isViewingAllCompanies && selectedCompany?.id) {
  query = query.eq('company_id', selectedCompany.id);
}
```
With the new option, it becomes:
```typescript
if (!skipCompanyFilter && !isViewingAllCompanies && selectedCompany?.id) {
  query = query.eq('company_id', selectedCompany.id);
}
```

This is a minimal, non-breaking change that cleanly separates catalog browsing from inventory management.

