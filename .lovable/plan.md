

## Fix: Item Master search not filtering by item code or name

### Root Cause

Both `useWarehouseItemsPaged.ts` and `useWarehouseItemsLazyInventory.ts` use **two separate `.or()` calls** on the same query builder — one for search, one for cursor-based pagination. PostgREST does not reliably support multiple `or` query parameters; the second one can overwrite the first. This means:

- **Page 1** (no cursor): search works correctly
- **Page 2+**: cursor `.or()` overwrites the search `.or()`, so unfiltered items leak into subsequent pages, making it appear that search is broken

### Fix

Refactor both hooks to ensure only **one** `.or()` call exists per query. When both search and cursor are active, nest them in a single `.or()` using PostgREST's `and()/or()` nesting syntax.

### Files to change

**`src/hooks/useWarehouseItemsPaged.ts`**
- Change `buildFilteredQuery` to **return the search filter string** instead of applying `.or()` directly
- In `useWarehouseItemsLazy` queryFn, combine search + cursor into a single `.or()`:
  - Search only: `query.or('name.ilike.%term%,...')`
  - Cursor only: `query.or('created_at.lt.X,...')`
  - Both: `query.filter('and', 'or(name.ilike.%term%,...),or(created_at.lt.X,...)', '')` — or merge into a single structured filter

**`src/hooks/useWarehouseItemsLazyInventory.ts`**
- Apply the same pattern: avoid two `.or()` calls by combining search + cursor into one filter expression

### Concrete approach

```typescript
// Build search OR string without applying it
const searchOr = search?.trim()
  ? `name.ilike.${term},item_code.ilike.${term},brand.ilike.${term},barcode.ilike.${term},sku.ilike.${term}`
  : null;

const cursorOr = pageParam
  ? `created_at.lt.${pageParam.created_at},and(created_at.eq.${pageParam.created_at},id.lt.${pageParam.id})`
  : null;

// Apply as a SINGLE filter
if (searchOr && cursorOr) {
  // Both active: use .or() once with nested and()
  query = query.or(cursorOr).filter('or', `(${searchOr})`, '');
  // OR restructure to avoid double-or entirely
} else if (searchOr) {
  query = query.or(searchOr);
} else if (cursorOr) {
  query = query.or(cursorOr);
}
```

The precise PostgREST nesting will be tested, but the key change is: **never call `.or()` twice on the same query**.

