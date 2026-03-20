

## Fix: Bulk Stock Upload item code matching is case-sensitive

### Root Cause

On line 157, item codes extracted from the CSV are lowercased:
```typescript
const itemCodes = [...new Set(dataRows.map(r => (r[codeIdx] || '').toLowerCase().trim()).filter(Boolean))];
```

These lowercased values are then passed to `.in('item_code', chunk)` on line 168, which performs a **case-sensitive** match against the database. The catalog stores codes like `INV-PLB-000-0226`, but the query sends `inv-plb-000-0226` — no match.

The same issue affects `binCodes` on line 158.

### Fix

**File: `src/components/warehouse/BulkStockUploadDialog.tsx`**

Collect **original-case** codes for the database query, while still using lowercase keys for the local lookup maps.

1. **Lines 157-158**: Collect original-case unique codes for querying, separately from lowercase keys
2. **Lines 162-172 (catalog query)**: Use original-case codes in `.in()`, but still key the map by lowercase
3. **Lines 191-201 (bin query)**: Same approach — original-case codes for query, lowercase for map keys

Specifically:
```typescript
// Collect original-case codes for DB queries
const itemCodesOriginal = [...new Set(dataRows.map(r => (r[codeIdx] || '').trim()).filter(Boolean))];
const binCodesOriginal = [...new Set(dataRows.map(r => (r[binIdx] || '').trim()).filter(Boolean))];

// Query with original case
.in('item_code', itemCodesOriginalChunk)

// Map keyed by lowercase for case-insensitive local lookup
catalogMap.set((item.item_code || '').toLowerCase().trim(), item);
```

Single file, ~6 lines changed. The map lookups on lines 217, 222, 227 already use `.toLowerCase()` so those remain correct.

