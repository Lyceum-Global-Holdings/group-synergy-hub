## Problem

In **Create Material Return Note → Internal Return**, selecting a source MIN shows *"This MIN has no returnable items"* even when the MIN has issued items (verified in DB: MIN `MIN-20260611-005` has 3 items, 0 previously returned).

Root cause analysis:

1. `CreateMaterialReturnDialog` calls RPC `get_min_returnable_lines(p_min_id)`. Any RPC failure (auth raise, transient error, network) is **silently swallowed** by React Query — `loadedLines` stays `undefined`, the `useEffect` never fires, and `lines` remains `[]`, so the UI shows the misleading "no items" message.
2. When the user switches between MINs, `lines` is **not reset** until the next successful fetch — stale rows from a previous MIN can linger.
3. The RPC itself is fragile: it joins `warehouse_items_full` for item code/name/UOM and reads `unit_cost`/`unit_of_measure` from issue lines. For this MIN both `unit_cost` and `unit_of_measure` on `material_issue_items` are `NULL`/empty in the DB, so even when rows load the user sees blank UOM and zero unit cost.
4. The "Not authorized for this MIN" raise inside the RPC kills the entire result instead of letting RLS filter, even though the calling user already passed RLS to see the MIN in the dropdown.

## Plan

Apply ISO 15489 / SAP-style robust document loading: fail loud, never silently empty, and enrich line data from authoritative master.

### Backend — migration

Update `public.get_min_returnable_lines(p_min_id uuid)`:

- Drop the explicit `RAISE 42501`. Rely on RLS: if `material_issue_notes` row is not visible to caller, the leading `SELECT company_id` returns `NULL` and the function returns 0 rows naturally (RLS-aligned, matches PostgREST conventions).
- Coalesce display fields so every returnable line has a usable `item_code`, `item_name`, `unit_of_measure`, and `unit_cost` even when `material_issue_items` columns are blank:
  - `item_code` ← `wif.item_code`, fallback to `'ITEM-' || substring(item_id::text,1,8)`
  - `item_name` ← `wif.name`, fallback to `'(Unnamed item)'`
  - `unit_of_measure` ← `NULLIF(mii.unit_of_measure,'')` → `wif.unit_of_measure` → `'EA'`
  - `unit_cost` ← `mii.unit_cost` → `wif.unit_cost` → `0`
- Keep `SECURITY DEFINER` + `search_path=public` (project standard) and existing grants.

### Frontend — `src/components/warehouse/CreateMaterialReturnDialog.tsx`

- Capture the React Query `error` from `useQuery(['min-returnable-lines', selectedMinId], …)` and:
  - Show an inline destructive `Alert` ("Could not load issued items: <message>. Try again.") with a Retry button (`refetch()`).
  - Fire a `toast.error(...)` once per failure.
- Reset `lines` to `[]` immediately when `selectedMinId` changes (before refetch resolves), so stale rows never bleed across MINs.
- Differentiate three empty states clearly:
  1. No MIN selected → "Select a MIN above to load its items."
  2. Loaded successfully but every line fully returned → "All items from this MIN have already been returned."
  3. MIN truly has no issue items → "This MIN has no issued items to return."
- Disable **Create Return** while `loadingLines` is true (prevents submitting before items load).

### Order of work

1. SQL migration: replace `get_min_returnable_lines` with the hardened version above.
2. Regenerate Supabase types.
3. Patch `CreateMaterialReturnDialog.tsx` for error surfacing, line reset, and empty-state messaging.
4. Smoke test: pick MIN-20260611-005 → expect 3 rows with item codes, UOM, and remaining qty populated.

### Out of scope

- No change to MRN business logic, stock movements, approvals, or PDF output.
- No change to the supplier-return branch.
