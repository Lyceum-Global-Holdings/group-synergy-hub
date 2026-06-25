# Issue materials from the location-scoped FIFO batches

## Why

The MIN issue dialog (and its `issue_material` / `process_fifo_batch_issue` RPCs) consumes batches globally for `(company, item)` — it ignores the MIN's location. When INV-PNT-000-0083 is issued from one warehouse, the FIFO preview/posting can pick batches whose physical stock sits in a bin at a *different* location. International convention (WMS/SAP, ISO 9001 §8.5.1, GS1) is that a goods issue movement (type 261) must consume the lot **at the same physical site/storage location** as the issue document. We already deduct bin allocations by location — batches must follow the same rule and the `batch_stock_allocations` row must be decremented in lockstep with the bin allocation.

## Plan

### 1. Migration — location-aware FIFO + batch/bin linkage

Replace `process_fifo_batch_issue` with a new signature that takes `p_location_id`:

```text
process_fifo_batch_issue(p_issue_item_id, p_item_id, p_quantity_issued, p_company_id, p_location_id)
```

Behaviour:

- Recursive `loc_tree` from `p_location_id` (same pattern as `process_material_issue_stock_update`) so sub-locations roll up.
- Availability = `SUM(batch_stock_allocations.allocated_quantity)` joined to `item_batches` (active, `quantity_remaining > 0`, same company) and `warehouse_bins.location_id IN loc_tree`. Reject if < requested.
- FIFO loop iterates `batch_stock_allocations` (joined to `item_batches`) ordered by `item_batches.created_at ASC, expiry_date NULLS LAST` per row, taking `LEAST(bsa.allocated_quantity, batch.quantity_remaining, remaining)`. For each take:
  - `UPDATE batch_stock_allocations SET allocated_quantity = allocated_quantity - take` (per bin/location).
  - `UPDATE item_batches SET quantity_remaining = quantity_remaining - take`; flip `status='depleted'` when it reaches 0.
  - `INSERT batch_issue_details (issue_item_id, batch_id, quantity_from_batch, bin_id)` — adds a `bin_id` column (NULL-safe additive) for audit traceability.
- Backwards-compat shim: old 4-arg overload remains and raises a clear "location required" error so any forgotten caller fails loudly instead of silently going global.

Update `issue_material` to:

- Use the new location-scoped availability check (instead of the current global sum) so it only invokes FIFO when batched stock exists at the MIN's location.
- Pass `v_min.location_id` into `process_fifo_batch_issue`.

`process_material_issue_stock_update` is unchanged — it already deducts bins inside `loc_tree`. The two functions now match.

Add `bin_id uuid NULL REFERENCES warehouse_bins(id)` to `batch_issue_details` (additive).

### 2. UI — `IssueItemsDialog` preview

Fetch the MIN's `location_id` once, then for each line query batches joined to `batch_stock_allocations` and `warehouse_bins` filtered to that location tree (small RPC `get_location_fifo_preview(item_id, company_id, location_id, qty)` or a single PostgREST embed with `bin_allocations:batch_stock_allocations!inner(allocated_quantity, warehouse_bins!inner(bin_code, location_id, warehouse_locations(name)))` filtered by location). Show per row: `lot · bin · location · take · (available at bin)`. Insufficient badge fires only when location-scoped batched stock < qty.

### 3. Memory

Update `mem://architecture/warehouse-batch-fifo-logic` to record the rule: FIFO MUST scope by `(company, item, location_tree)` and decrement both `item_batches` and `batch_stock_allocations`.

## Technical details

- New migration `…_location_scoped_fifo_issue.sql` contains: `ALTER TABLE batch_issue_details ADD COLUMN bin_id`, drop+recreate `process_fifo_batch_issue` with the new signature, rewrite the body, recreate `issue_material` to pass the location. All wrapped in one transaction.
- No RLS changes; RPCs stay `SECURITY DEFINER`, `SET search_path = public`.
- Preview hook lives inside `IssueItemsDialog.tsx` — no new shared hook needed for one screen.

## Out of scope

- Cross-location stock transfers (separate STO/MIN flow).
- Manual lot selection in the dialog (FIFO stays automatic per the existing design).
- Changing how non-batched items are deducted (already location-scoped).
