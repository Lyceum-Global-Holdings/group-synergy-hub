# Fix: Tool import "Find by code" finds the item but the list stays empty

## Root cause

The "Item Master" catalog has **14,985 active rows**. The catalog row the user found (`FIX-MNT-000-0003` — "Generator | Weichai - 500KVA") sorts at **position 5,714** alphabetically.

The dialog fetches candidates via the `get_tool_catalog_candidates` RPC with `p_limit=20000`. The server-side function does have `LIMIT 20000`, but the RPC response delivered to the browser is being truncated well before that — only the first ~1,000 rows make it into `items`. Anything past that point is invisible to the dialog regardless of search term, scope, or category filter.

Result: `find_catalog_item_by_code` correctly tells the user "Item found", `setSearchTerm(row.item_code)` runs, the highlight is set, the virtualizer is asked to scroll — but `filteredItems` is empty because the matched catalog row was never in `items` to begin with. The toast lies; the list is empty.

The previous bin/code/scope-broadening fixes were all correct but they all assume the row exists in the candidate set. It doesn't.

## Fix

Two complementary changes — one immediate, one structural.

### 1. Inject the found row directly into the candidate cache (immediate fix)

When `runFinder` gets a server-confirmed importable row back from `find_catalog_item_by_code`, write that single row into the active `["tool-catalog-candidates", ...]` query cache(s) via `queryClient.setQueryData`, prepending it if it isn't already present. The lookup RPC already returns every field the candidate row needs (`id`, `item_code`, `name`, `description`, `category_id`, `unit_id`, `unit_cost`, `category_name`, `category_code`, `unit_abbreviation`, `status`). Map it to the `CandidateItem` shape with `inventory_item_id: null`, `current_stock: null`, `inventory_location_id: null` — the inventory snapshot is optional and never filters visibility (per `tool-promotion-source-of-truth` memory).

This guarantees that any item the server confirms exists is visible immediately, regardless of how many rows the bulk fetch dropped. The existing `scrollWhenReady` poll then succeeds on the first tick.

### 2. Paginate the candidates RPC to actually fetch the full catalog (structural fix)

Add `p_offset integer DEFAULT 0` to `get_tool_catalog_candidates` and update the client to fetch the catalog in 1,000-row pages until a short page is returned, concatenating into one array before resolving the React Query result. This restores the dialog's promise of "showing every active Item Master entry" — without it, scope counts say `14,985` but only the first ~1,000 are actually selectable by scrolling/searching.

Keep the server-side `LIMIT` clause as a safety upper bound (`LIMIT LEAST(p_limit, 20000) OFFSET p_offset`).

## Files

- **DB migration**: alter `get_tool_catalog_candidates` to accept `p_offset`. No behavior change when caller omits it.
- **`src/components/warehouse/tools/ImportFromItemMasterDialog.tsx`**:
  - In the `useQuery` `queryFn`, loop with `p_offset += 1000` until a page returns `< 1000` rows.
  - In `runFinder`, after the validation toasts pass and before `scrollWhenReady`, write the matched row into every cached `["tool-catalog-candidates", ...]` entry that doesn't already contain it (prepend, dedup by `id`).
  - No UI/copy changes; the behavior is now "Item found" → row visible.

## Out of scope

- No change to `find_catalog_item_by_code`, no change to dedup logic, no change to bin allocation, no change to import payload. The issue is strictly visibility of the matched row in the candidate list.
