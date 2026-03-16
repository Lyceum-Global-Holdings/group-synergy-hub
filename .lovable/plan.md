

# Fix: Dual `.or()` in Inventory tab (and Item Master tab)

## Problem

Both `useWarehouseItemsLazyInventory.ts` and `useWarehouseItemsPaged.ts` currently use a broken workaround for the "combined search + cursor" case:

```typescript
query = query.or(searchOr).filter('or', `(${cursorOr})`, '');
```

The `.filter('or', ...)` call is invalid — `.filter(column, operator, value)` expects a real column name, not `'or'`. This produces broken queries on page 2+ when search is active.

## Fix

The correct approach is simply **two separate `.or()` calls**. In PostgREST, multiple `or` query parameters are ANDed together, so `?or=(search_conditions)&or=(cursor_conditions)` correctly produces `(search match) AND (past cursor)`. The supabase-js client supports this.

Replace the combined filter block in both files with:

```typescript
if (searchOr) query = query.or(searchOr);
if (cursorOr) query = query.or(cursorOr);
```

### Files to change

| File | Lines | Change |
|------|-------|--------|
| `src/hooks/useWarehouseItemsLazyInventory.ts` | 89-96 | Replace combined filter block with two independent `.or()` calls |
| `src/hooks/useWarehouseItemsPaged.ts` | 76-83 | Same fix in `useWarehouseItemsLazy` |
| `src/hooks/useWarehouseItemsPaged.ts` | 148-154 | Same fix in `fetchAllWarehouseItemsBatched` |

