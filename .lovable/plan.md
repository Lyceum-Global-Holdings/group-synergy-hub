# Fix: Tool Import "Find by exact code" — found items must appear in the list

## Symptom
On `/warehouse/tool-management` → "Import from Item Master", typing an exact code (e.g. `INV-CMP-CBL-0001`) into the finder shows the green "Item found" toast, but the row never appears in the table for the user to tick.

## Root cause
The candidate query in `ImportFromItemMasterDialog.tsx` is keyed on:

```ts
queryKey: [
  "tool-catalog-candidates",
  sourceScope,                       // "suggested" | "tools" | "all"
  targetCompanyId,
  destinationLocationId,
  effectiveCategoryIds.join(","),    // null when scope === "all"
]
```

When `sourceScope` is `"tools"` or `"suggested"`, the RPC is called with the recursive descendant set of `TOO-HND` / `TOO-PWR`. Catalog rows that are **uncategorized** (the bulk of the catalog — see existing memory `tool-promotion-source-of-truth`) or whose category sits outside the tool subtree are **never returned by the server**, so:

1. `runFinder` confirms the row exists via `find_catalog_item_by_code`,
2. sets `searchTerm = row.item_code` and `categoryFilter = "all"`,
3. but leaves `sourceScope` untouched,
4. so `items` still doesn't contain the row → `filteredItems` is empty → nothing to tick.

The current code also scrolls via a fixed `setTimeout(..., 50)` which races with the React Query refetch when the scope *does* change.

## Fix — "Lookup outranks filter"

Edit `src/components/warehouse/tools/ImportFromItemMasterDialog.tsx`, in `runFinder` after the success/active/already-imported guards:

1. **Force `setSourceScope("all")`** before setting search/category. This is the only scope guaranteed to include the confirmed row, since `find_catalog_item_by_code` scans the entire `warehouse_item_catalog` regardless of category.
2. Keep `setCategoryFilter("all")` and `setSearchTerm(row.item_code)`.
3. **Replace the fixed `setTimeout(50)` scroll** with a poll loop (≤2s) that watches the React Query cache for any `["tool-catalog-candidates", …]` entry containing the matched `catalog_id`. Once present, `requestAnimationFrame` then `rowVirtualizer.scrollToIndex(0, { align: "center" })`. This works whether the data was already cached (instant) or had to refetch (waits for the broadened scope's response).
4. **Update the success toast** to tell the user when the scope was switched, so the UI change isn't surprising:
   - If `sourceScope !== "all"` or `categoryFilter !== "all"` before the lookup → append `"Switched scope to \"All item master\" so it's visible."`
   - Otherwise keep the existing copy.
5. Add `sourceScope`, `categoryFilter`, `queryClient` to the `useCallback` dep array.

No other files need changing. The existing RPC `find_catalog_item_by_code` and the candidate RPC `get_tool_catalog_candidates` already support this — only the client orchestration was wrong.

## Memory update
Append to `.lovable/memory/architecture/tool-promotion-source-of-truth.md` under "How to apply":

> - **Lookup outranks filter.** When `find_catalog_item_by_code` returns a server-confirmed row, the dialog MUST broaden the data window (`sourceScope = "all"`, `categoryFilter = "all"`) before applying the search term. A confirmed row is authoritative and must never stay invisible because of a narrowing UI filter. Wait for the candidate query to contain the matched `catalog_id` (poll the React Query cache, ≤2s deadline) BEFORE asking the virtualizer to scroll, otherwise the scroll lands on an empty list mid-refetch.

## Verification
1. Open Import from Item Master with the default scope tab.
2. Switch to the "Tools" scope tab (narrow window).
3. Type `INV-CMP-CBL-0001` → click Find.
4. Expected: scope tab flips to "All item master", the row appears highlighted at the top, ready to tick. Toast mentions the scope switch.
5. Repeat with an inactive code → "Item is inactive" toast, no scope change.
6. Repeat with an already-imported code → "Already in Tool Master" toast, no scope change.
