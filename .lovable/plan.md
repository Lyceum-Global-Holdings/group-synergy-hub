# Fix "Bulk add from catalog" name-phrase search

## Root cause

`CatalogItemCell` in the Bulk add from catalog dialog calls the `list_warehouse_catalog` RPC, which currently does a single-substring `ILIKE '%search%'` on `item_code`, `name`, `sku`, `barcode`.

That means a query like `steel rod 12mm` only matches if those exact characters appear contiguously in one column. Real catalog names use different word orders or have extra words in between (`12mm steel reinforcement rod`), so the search returns nothing even though items exist.

There is also no debounce — every keystroke fires a new RPC, which hides the lag and makes the empty state look like "no results" while a later request is still in flight.

## Solution

Switch the catalog search to a token-based match: split the query on whitespace, and require every token to match `item_code`, `name`, `sku`, `barcode`, `brand`, or `manufacturer` (any column). This is what users intuitively expect from a free-text picker.

Add a small debounce on the client so we stop firing one RPC per keystroke.

## Changes

### 1. DB migration — upgrade `list_warehouse_catalog` search

Replace the single `ILIKE` block with token-AND logic:

```sql
-- pseudo
WITH tokens AS (
  SELECT unnest(
    string_to_array(regexp_replace(trim(_search), '\s+', ' ', 'g'), ' ')
  ) AS tok
  WHERE _search IS NOT NULL AND _search <> ''
)
-- in WHERE:
AND (
  _search IS NULL OR _search = '' OR NOT EXISTS (
    SELECT 1 FROM tokens t
    WHERE NOT (
      c.item_code    ILIKE '%' || t.tok || '%' OR
      c.name         ILIKE '%' || t.tok || '%' OR
      c.sku          ILIKE '%' || t.tok || '%' OR
      c.barcode      ILIKE '%' || t.tok || '%' OR
      c.brand        ILIKE '%' || t.tok || '%' OR
      c.manufacturer ILIKE '%' || t.tok || '%'
    )
  )
)
```

- Each whitespace-separated token must hit at least one searchable column. Order-insensitive, phrase-friendly.
- Empty / whitespace-only input behaves as "no filter" (unchanged).
- Per the Search Special Chars memory, escape `%`, `_`, and `\` in each token before substitution.
- `brand` and `manufacturer` are added to the searchable set so phrases like `tata 12mm` work.

Function signature, return columns, ordering, and cursor logic are unchanged — no client type changes needed beyond what the hook already returns.

### 2. Client debounce in `CatalogItemCell.tsx`

- Add a 200 ms debounce on `search` before passing it to `useWarehouseCatalogPage`. Prevents the "Searching… / No items found" flicker mid-typing.
- Keep `shouldFilter={false}` and the existing `Load more` infinite-scroll behavior.
- Keep `CommandEmpty` text reactive to `isFetching` so users see `Searching…` until the debounced query resolves.

### 3. Verification

- Manual: open `/warehouse/inventory` → Bulk add from catalog → pick item → type a multi-word phrase that exists in any item name (e.g. `rod 12mm`, `steel reinforcement`). Items should appear regardless of word order.
- Spot-check single-token queries (`ITM-001`, `barcode digits`) still work.
- Confirm pagination cursor still advances on `Load more` after a filtered query.

## Out of scope

- No schema or RLS changes on `warehouse_item_catalog`.
- No changes to other catalog pickers that don't use `list_warehouse_catalog`.
- No full-text search index — token ILIKE is sufficient for current catalog size and keeps behavior predictable.
