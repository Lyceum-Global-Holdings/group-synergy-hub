## Plan: Make “Bulk add from catalog” search by item name phrase reliable

### Root cause
The picker is calling `list_warehouse_catalog`, but name-phrase searches still time out for common terms like `test`. The current RPC still evaluates broad `ILIKE '%phrase%'` and `similarity(...)` predicates across active catalog rows, so PostgreSQL can fall back to expensive scans before returning the first 25 rows.

### Fix
1. **Rewrite `list_warehouse_catalog` with a bounded search pipeline**
   - Keep the same RPC signature and returned columns so the UI stays compatible.
   - Normalize the input phrase once: lowercase, trim spaces, escape wildcard characters.
   - Tokenize the phrase into meaningful words.
   - Build a small candidate set from indexed branches instead of scanning the full catalog.

2. **Use international-standard ranking**
   - Exact item code / SKU / barcode matches first.
   - Prefix matches next.
   - Exact name phrase containment next.
   - Full-text token/phrase matches next.
   - Trigram fuzzy matches last.
   - Return results ordered by relevance first, then `created_at DESC, id DESC` for deterministic pagination.

3. **Add the missing optimized indexes**
   - Functional GIN full-text index for item code, name, brand, manufacturer, SKU, barcode, and description.
   - Lowercase trigram indexes for `name`, `item_code`, `sku`, `barcode`, `brand`, and `manufacturer`.
   - Existing keyset index for `status, created_at DESC, id DESC` remains.

4. **Avoid slow fallback behavior**
   - Remove unbounded `similarity()` scans from the main `WHERE` clause.
   - Use trigram operator/index-backed candidate selection with a capped candidate pool.
   - For very short searches, use prefix/contains matching and avoid costly fuzzy ranking.

5. **Improve picker behavior only where needed**
   - Keep debounce and infinite scroll.
   - Do not show “No items found” while a debounced search is still loading.
   - Keep RPC error text visible if the backend fails.

6. **Verify after implementation**
   - Test RPC responses for:
     - no search
     - short search: `te`
     - common word: `test`
     - multi-word phrase: `computer science notes`
     - partial item phrase: `cable lug`
   - Confirm no statement timeout and that active item master rows appear in the bulk-add picker.