## Goal
Add a one-click "Repair" action for historical empty Material Return Notes (MRN-20260617-001…009 and any other MRN where `material_return_items` is empty) that clones line items from a user-chosen reference MRN.

## How it works (user flow)
1. On `/warehouse/material-issue` → Material Returns tab, every MRN row whose item count is 0 shows a new **Repair** button (icon + tooltip) next to the existing actions.
2. Clicking Repair opens a **Repair Material Return** dialog:
   - Header shows the empty MRN's number, date, returned_by, notes, size/job parsed from notes.
   - A searchable picker lists candidate **reference MRNs** in the same company that have ≥1 item, sorted by most recent. Search by MRN number, job/site text in notes, or size. Default filter: same Size string parsed from notes (e.g. "5kwhA").
   - Selecting one previews the items table (item code, name, qty, condition, unit cost) read-only.
   - **Adjust before saving** toggle: when on, qtys/condition/notes are editable inline; when off, lines are cloned as-is.
   - Confirm button calls one RPC that atomically inserts the cloned items into the empty MRN.
3. On success: toast, dialog closes, list refreshes, the Repair button disappears (item count is now > 0).
4. If the empty MRN is already in `returned` status, the repair also triggers stock movement reconciliation so the new items post the stock-out transactions that should have happened on approval (so stock ledger matches reality going forward — past balances are not retroactively rewritten).

## Bulk variant
Top of the Material Returns tab gets a **Repair empty returns** button (visible only when ≥1 empty MRN exists). Opens a wizard that:
- Lists every empty MRN with parsed Size.
- Lets the user pick one reference MRN per Size (or one global reference).
- Shows a dry-run preview (N MRNs × M items).
- One confirm runs all clones in a single transaction.

## Technical details

### Database (single migration)
- New RPC `repair_material_return_from_reference(p_target_mrn_id uuid, p_source_mrn_id uuid, p_overrides jsonb default null)`:
  - `SECURITY DEFINER`, `search_path=public`.
  - Validates `can_access_company` for both MRNs and that target.company_id = source.company_id.
  - Fails if target already has ≥1 item, or if source has 0 items.
  - Inserts cloned rows into `material_return_items` (item_id, quantity_returned, unit_cost, total_cost, condition, notes, secondary_*), applying `p_overrides` (array of `{source_item_id, quantity_returned?, condition?, notes?}`) when provided.
  - If target.status = 'returned', calls the existing stock-update helper used by `approve_material_return` for the newly inserted items only (idempotent guard: skip items whose stock txn already exists for this mrn_id).
  - Returns the inserted row count.
- New read-only RPC `list_repair_candidate_mrns(p_target_mrn_id uuid, p_size_hint text default null, p_search text default null, p_limit int default 25)` returning candidate source MRNs with item counts, for the picker.
- The existing `add_missing_material_return_items` RPC is kept as the underlying manual path.
- The deferred `constraint_material_return_has_items` trigger is left in place — repair runs inside the same transaction so the constraint is satisfied at commit.

### Frontend
- `src/hooks/useMaterialReturnRepair.ts` — wraps both RPCs with React Query, invalidates `material-returns`, `material-return-items`, `warehouse-items`, `stock-transactions`, `item-bin-allocations`.
- `src/components/warehouse/RepairMaterialReturnDialog.tsx` — single-MRN repair UI (picker + preview + optional edit grid + confirm).
- `src/components/warehouse/BulkRepairMaterialReturnsDialog.tsx` — wizard for the bulk path.
- `src/pages/warehouse/MaterialIssue.tsx` (or whichever component renders the Returns tab table — to be confirmed during implementation): add the per-row Repair button (only when `item_count === 0`) and the tab-level "Repair empty returns" button.
- Parse Size/Job/Site from `notes` with a small helper `src/lib/materialReturn/parseLegacyNotes.ts` so the picker can prefilter by size.

### Safety / scope
- Repair never creates a new MRN, never changes MRN status (except the stock-posting step for already-returned ones).
- Anything not in the original `material_return_items` schema is ignored.
- All access stays company-scoped via `can_access_company`; no anon access added.
- No edits to `src/integrations/supabase/types.ts`.

## Out of scope
- Reconstructing the original (lost) item lists automatically — impossible, no source data exists.
- Backfilling historical stock_transactions for the period before repair; only forward-posting from the repair moment.
