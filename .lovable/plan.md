

## Fix: Search fails for item names/codes containing special characters

### Root Cause

The search filter uses PostgREST's `.or()` string syntax like:
```
name.ilike.%PVC Socket | Bend - 4" (110mm)%,item_code.ilike.%PVC Socket | Bend - 4" (110mm)%
```

Characters like `|`, `(`, `)`, `"`, and `,` are **PostgREST filter syntax delimiters**. They break the `.or()` parser — the pipe `|` looks like an OR operator, parentheses look like grouping, commas separate filter conditions, and quotes are value delimiters. This causes the query to silently return zero results instead of matching.

The database itself handles these characters fine (verified: `ilike '%PVC Socket | Bend%'` returns 18 rows). The problem is purely in how the search term is passed through the `.or()` string.

### Fix

Wrap search values in **double quotes** within the `.or()` string, and escape any `"` or `\` in the search term. This is the official PostgREST approach for values containing special characters.

**Before:**
```typescript
const term = `%${search.trim()}%`;
return `name.ilike.${term},item_code.ilike.${term},...`;
```

**After:**
```typescript
const escaped = search.trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const term = `%${escaped}%`;
return `name.ilike."${term}",item_code.ilike."${term}",...`;
```

### Files to change

| File | Change |
|------|--------|
| `src/hooks/useWarehouseItemsPaged.ts` | Update `getSearchOrString()` (line 18-22) to quote and escape the search term |
| `src/hooks/useWarehouseItemsLazyInventory.ts` | Update inline search string builder (lines 63-67) with the same quoting logic |

Two small, surgical edits. No architectural changes needed.

