

# Fix: Use System Currency in PDF Export

## Problem

Line 582 of `LocationReportAnalytics.tsx` hardcodes a `$` dollar sign for all currency values in the PDF export:

```typescript
const formatCurrency = (val: number) => `$${val.toLocaleString("en-US", ...)}`;
```

The rest of the application uses `useCompany().formatCurrency` which reads the GL Settings (base currency, symbol, decimal places) from the database.

## Fix

### File: `src/components/warehouse/LocationReportAnalytics.tsx`

**Change 1: Import `useCompany` and extract `formatCurrency`**

At the top of the component function, destructure `formatCurrency` from the `useCompany` context (which is already available since this component renders inside the CompanyContext provider).

**Change 2: Remove the hardcoded `$` formatter inside `handleCaptureAsPdf`**

Delete line 582:
```typescript
const formatCurrency = (val: number) => `$${val.toLocaleString("en-US", ...)}`;
```

The function will then use the `formatCurrency` from `useCompany()` declared at the component level, which automatically applies the correct currency code, symbol, and decimal places from GL Settings.

**Change 3: Add `formatCurrency` to the `useCallback` dependency array**

Update the dependency array of `handleCaptureAsPdf` to include `formatCurrency` so it stays in sync with any settings changes.

## Result

All currency values in the exported PDF (Total Value, Average Value, Category/Subcategory values, Asset Master values) will display with the correct currency symbol (e.g., `Rs.`, `$`, `EUR`) as configured in the system's Finance/GL Settings.

## Files Modified

- `src/components/warehouse/LocationReportAnalytics.tsx` (3 small edits)

