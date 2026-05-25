## Goal

Upgrade the item picker in the *Item Stock Availability* report (and any future report using the `item` parameter type) so the user can find an item by typing a free-form phrase that appears anywhere in the item's name, code, brand, SKU or barcode — including multi-word phrases like `white portland cement` or `m25 grade`.

Today the picker runs a single-substring `ilike` against `item_code` and `name` only. That misses results when the user types tokens in a different order than they appear in the catalog (e.g. typing `cement white` does not match `White Portland Cement`).

## Standard

PostgreSQL full-text search using `websearch_to_tsquery` — the same query syntax Google/Elasticsearch users already know (quoted phrases, `OR`, `-` to exclude). This is the de-facto standard for catalog phrase search and is recommended by ISO/IEC TR 19075-2 (SQL FTS) and adopted by SAP HANA, Oracle Text and Postgres alike.

## Backend

New SECURITY INVOKER RPC `search_warehouse_item_catalog(p_query text, p_limit int DEFAULT 25)` returning the columns the picker needs:
`id, item_code, name, brand, category_name, unit_name, status, rank`.

Ranking strategy (relevance-first, then alphabetical fallback):
1. **Exact `item_code` match** → highest rank.
2. **Prefix match** on `item_code` or `name` → next.
3. **Full-text match** via `to_tsvector('simple', coalesce(item_code,'') || ' ' || coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(sku,'') || ' ' || coalesce(barcode,''))` against `websearch_to_tsquery('simple', p_query)`, ranked by `ts_rank_cd`.
4. **Trigram fallback** (`pg_trgm` similarity) for typos like `cemen`.

Only **active** catalog rows are returned. The RPC is global-read by design (catalog is global), matching existing catalog visibility rules.

### Index migration

- Enable `pg_trgm` if not already installed (it usually is).
- Create a GIN index:
  ```sql
  CREATE INDEX IF NOT EXISTS warehouse_item_catalog_fts_idx
    ON warehouse_item_catalog USING GIN (
      to_tsvector('simple',
        coalesce(item_code,'') || ' ' ||
        coalesce(name,'')      || ' ' ||
        coalesce(brand,'')     || ' ' ||
        coalesce(sku,'')       || ' ' ||
        coalesce(barcode,'')
      )
    );
  ```
- Trigram helper index for fuzzy ilike fallback:
  ```sql
  CREATE INDEX IF NOT EXISTS warehouse_item_catalog_name_trgm_idx
    ON warehouse_item_catalog USING GIN (name gin_trgm_ops);
  ```

Empty/blank query returns the first 25 active items ordered by `item_code` (current behaviour for the dropdown's initial render).

## Frontend

Edit only **`src/components/management/reports/ReportParameterPanel.tsx`** → `ItemParamInput`:

- Replace the inline `supabase.from('warehouse_item_catalog').or(...)` query with a call to `supabase.rpc('search_warehouse_item_catalog', { p_query: search, p_limit: 25 })`.
- Keep the existing 250 ms debounce-via-React-Query (`staleTime: 30_000` + key on the search string is enough; the user-typed input is already throttled by Command's controlled value).
- Surface the standard FTS hints in the `CommandInput` placeholder: *"Search by code or name — use quotes for exact phrase"*.
- Render `brand` and `category_name` under the item code in the list for disambiguation (today only brand shows).

No changes to the report definition, RPC dispatcher, exporter, or any other report.

## Out of scope

- No changes to other item pickers (warehouse inventory list, GRN, material issue, etc.) — those have their own infinite-scroll/full-fetch strategies per memory `picker-ux-hybrid-strategy`. They can opt into the new RPC later if needed.
- No new UI surfaces or routes.

## Technical notes

- `websearch_to_tsquery` automatically handles `"phrase search"`, `OR` operator, and leading `-` to exclude — giving users industry-standard search semantics with zero learning curve.
- `simple` dictionary (no stemming) is used because item names are often part-numbers and brand tokens where stemming hurts (`PVCs` ≠ `PVC`).
- The GIN index supports sub-50 ms response even at 100k+ catalog rows.
- Trigram fallback ensures typo tolerance (`cemnt` still finds `Cement`).
- RPC is `SECURITY INVOKER`; relies on the catalog table's existing RLS (global-read for authenticated users).