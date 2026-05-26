# Material Issue stock deduction fix

## Diagnosis (verified against DB)

Recent MINs were marked `completed` but stock was not reduced. Two concrete failure modes:

1. **Location/bin hierarchy mismatch** — The RPC `process_material_issue_stock_update` only deducts from bins whose `warehouse_bins.location_id` **exactly equals** the MIN's `location_id`. But MINs are commonly issued at a **parent warehouse / sub-location** (e.g. `de0c4bd9…`), while the item's bins sit at **child sub-locations** (e.g. `0630cfec…`, `735ddaab…`). Result: RPC raises *"Insufficient stock at selected location"* → frontend just shows a toast.

   Example — `MIN-20260525-002` at `de0c4bd9…` deducted **0** of 15 lines (master stock 316/5/45/34/… untouched; zero `stock_transactions` rows).

2. **Non-atomic write** — `useMaterialIssueItems` inserts `material_issue_items` first, then calls the RPC in a separate request. When the RPC throws, the MIN/items remain and the MIN is later marked `completed/issued` even though no stock moved.

## Fix

### A. DB — make RPC location-hierarchy aware

Update `process_material_issue_stock_update` (both overloads) so the location filter resolves the **subtree** of `p_location_id` instead of an exact match:

```text
WITH RECURSIVE loc_tree AS (
  SELECT id FROM warehouse_locations WHERE id = p_location_id
  UNION ALL
  SELECT wl.id FROM warehouse_locations wl
  JOIN loc_tree t ON wl.parent_id = t.id
)
… WHERE wb.location_id IN (SELECT id FROM loc_tree)
```

Applies to: availability check, bin-validation check, FIFO loop. `stock_transactions.location_id` records the actual bin's location (real storage), not the parent.

If `p_bin_allocation_id` is provided, still require that bin's location ∈ subtree.

### B. DB — atomic wrapper RPC for full issue

Add `process_material_issue_full(p_min_id uuid, p_items jsonb)` that, in a single transaction:
1. Inserts each `material_issue_items` row.
2. Calls the stock-update logic inline per line (same FIFO/hierarchy logic).
3. Updates reservation rows (`update_reservation_on_issue`) when `from_reservation`.
4. Sets `material_issue_notes.status = 'issued'` only on success.
5. On any exception: full rollback, surface error.

### C. Frontend — call the wrapper, fail loudly

`src/hooks/useMaterialIssueItems.ts`:
- Replace the current "insert → loop RPC with try/catch toasting" pattern with a single `supabase.rpc('process_material_issue_full', { p_min_id, p_items })`.
- On error, **throw** so the mutation rejects, the dialog stays open, and the MIN is not advanced.
- Keep the same query invalidations on success.

No UI/copy changes; same caller surface (`createItems`).

### D. Reconciliation for already-completed MINs

One-off migration: for every `material_issue_items` row whose parent MIN is `completed`/`issued` and has **zero** matching `stock_transactions` rows, replay the (now hierarchy-aware) deduction. Items whose total subtree stock is still insufficient are reported via a `min_issue_reconciliation_log` table (id, min_id, item_id, reason) rather than silently skipped.

## Files

- `supabase/migrations/<ts>_material_issue_hierarchy_and_atomic.sql`
  - Replace both `process_material_issue_stock_update` overloads with hierarchy-aware versions.
  - Add `process_material_issue_full` RPC.
  - Create `min_issue_reconciliation_log` table (+ RLS: super_admin/admin select).
  - Replay backfill block for pending unreduced MIN lines.
- `src/hooks/useMaterialIssueItems.ts` — switch to `process_material_issue_full`, surface errors.

## Out of scope

- No UI redesign, no changes to MaterialIssueDialog fields.
- No changes to material returns / GRN flows.
- Multi-tenant `company_id` scoping unchanged (RPC keeps SECURITY DEFINER + company resolution from MIN).
