## Plan

1. **Fix the root cause in the database RPC**
   - Update `create_material_return_with_items` so it validates item IDs against the current catalog/inventory source-of-truth instead of relying on stale `warehouse_items` assumptions.
   - Insert item rows atomically with the MRN header and verify the inserted row count before returning.
   - If the header is created but items cannot be inserted, the entire transaction will fail so empty drafts cannot be created again.

2. **Fix item visibility after draft creation**
   - Replace the detail dialog’s direct `material_return_items` query with a company-safe RPC/query path that returns return lines plus item code/name in one result.
   - This avoids RLS/view/catalog join issues where item rows exist but display as empty or fail to load.

3. **Harden the frontend save flow**
   - Block submission unless the outgoing item payload is non-empty after filtering.
   - After creating a draft, invalidate both the MRN list and the exact `material-return-items` query for the new MRN.
   - Surface the real backend error if item insertion fails instead of silently leaving an empty draft.

4. **Permanent safety guard**
   - Add/replace a DB trigger guard so a draft MRN cannot be inserted or updated into a persisted empty state when created through normal app flows.
   - Keep the existing repair path only for historical broken MRNs.

## Technical details

- Database changes will be done through a Supabase migration, not manual migration file edits.
- No public access will be opened; reads/writes stay authenticated and company-scoped via `can_access_company`.
- I will not edit `src/integrations/supabase/types.ts`.