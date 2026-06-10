## Fix BrowseInventoryDialog

**File:** `src/components/warehouse/BrowseInventoryDialog.tsx`

1. **Auto-load all pages for the location** — add a `useEffect` that calls `fetchNextPage()` whenever `hasNextPage && !isFetchingNextPage`, so the picker keeps paging until every in-stock item at the selected location is loaded. Keep the "Load more" button as a fallback while paging.
   - Optionally bump `PAGE_SIZE` from 50 → 200 to reduce round-trips on large locations.
   - Add a small "Loading all items…" indicator next to the count while `hasNextPage` is true.

2. **Default Qty to Issue = 0** — in `toggleRow`, set `quantity: 0` (instead of `avail > 0 ? 1 : 0`). User must type the qty explicitly. Validation already rejects `quantity <= 0`, so the Add button stays disabled until a qty is entered.

No other files touched, no RPC or schema changes.