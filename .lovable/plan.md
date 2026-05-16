## Plan

Fix the Add Partial Piece parent-item dropdown so it can access the full `warehouse_item_catalog` Item Master instead of only the first REST page of results.

### 1. Add server-side paged search for the picker
- Update `list_partial_piece_items` to support safe pagination/search parameters:
  - `p_search`
  - `p_limit`
  - `p_offset`
- Keep it sourced from `warehouse_item_catalog` with a `LEFT JOIN` to company-scoped `warehouse_items`.
- Preserve on-demand inventory provisioning via `ensure_partial_piece_parent_item`.
- Use stable ordering by cleaned item code/name so whitespace-prefixed codes do not distort results.
- Keep access constrained through the existing company/RLS model.

### 2. Update the picker hook to bypass the 1,000-row cap
- Replace the single RPC call in `usePartialPieceItems` with a paged fetch loop for full-list use cases, or expose query-driven pagination for the dialog.
- Ensure the parent item picker can reach all ~15,000 active catalog items, not just the first Supabase REST page.
- Keep React Query keys scoped by company and global location filter.

### 3. Make the dialog picker scalable
- Update `PartialPieceItemPicker` to search against server-backed catalog results rather than rendering all 15k rows into `cmdk` at once.
- Keep selected values by `catalog_item_id`.
- Show item code/name and piece count exactly as today.
- Ensure selecting a catalog-only item still creates the missing company `warehouse_items` row at submit time.

### 4. Preserve page filter behavior
- Keep the Partial Quantities page parent-item filter compatible with existing partial pieces.
- Avoid changing create/update/delete behavior outside this picker flow.

### 5. Verify
- Confirm the database active catalog count matches the picker’s searchable item universe.
- Confirm known missing catalog-only items can be searched and selected in Add Partial Piece.
- Confirm submission still resolves/creates the real `parent_item_id` before saving the partial piece.