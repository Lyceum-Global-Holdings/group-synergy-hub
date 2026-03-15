

# Fix: Make Bins Fully Available Across All Companies

## Problem

While the main Bin Master tab and hook were fixed, there are still two places in the code that filter bins by `company_id`, preventing bins from being fully shared.

## Changes

### 1. `src/components/warehouse/ReturnStockFromSublocationDialog.tsx` (line 53-56)

Remove the company-based bin filtering. Since bins are shared, all bins should be available regardless of company selection.

**Before:**
```typescript
const companyBins = selectedCompany?.id 
  ? bins?.filter(bin => bin.company_id === selectedCompany.id) || []
  : bins || [];
```

**After:**
```typescript
const companyBins = bins || [];
```

### 2. `src/hooks/useWarehouseBinAllocations.ts` (line 364-374)

The fallback bin lookup queries `warehouse_bins` filtered by `company_id`. Since bins no longer have a meaningful `company_id`, this fallback will fail. Change it to find any active bin (without company filter), or better yet, skip the fallback since location-based lookup (lines 350-361) should be the primary method.

**Before:**
```typescript
// If no bin at location, get any bin in the company
const { data: anyBins } = await supabase
  .from('warehouse_bins')
  .select('id')
  .eq('company_id', selectedCompany.id)
  .limit(1);
```

**After:**
```typescript
// If no bin at location, get any active bin
const { data: anyBins } = await supabase
  .from('warehouse_bins')
  .select('id')
  .eq('status', 'active')
  .limit(1);
```

These are two small, targeted fixes. No database changes needed.

