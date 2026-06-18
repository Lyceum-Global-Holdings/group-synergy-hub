## Goal
Scope Material Return Note visibility per warehouse location, not just per company. A user only sees MRNs for locations they have been assigned to, mirroring the existing pattern used for labour and inventory.

## Database changes (single migration)

1. **Add column** `location_id uuid REFERENCES public.warehouse_locations(id)` on `public.material_return_notes`. Nullable to preserve historical rows.
2. **Backfill historical rows** where possible:
   - When `reference_type = 'material_issue'` and `reference_id` matches a `material_issue_notes.id`, copy `material_issue_notes.location_id` into the MRN.
   - Other historical rows stay NULL (no source of truth) and remain visible to anyone with company access — see RLS rule below.
3. **Index** `CREATE INDEX ON public.material_return_notes (company_id, location_id, created_at DESC);` to keep list queries fast.
4. **Replace the SELECT RLS policy** `Users can view material return notes in their company` with:
   ```
   USING (
     public.can_access_company(company_id)
     AND (
       location_id IS NULL                                   -- legacy / unscoped
       OR public.is_admin(auth.uid())                        -- admins see all
       OR public.user_has_location_access(auth.uid(), location_id)
     )
   )
   ```
   This is the international ISO-style "least privilege + need-to-know" pattern: company tenancy + per-location authorisation. Admin override is kept so super-admins/audit roles retain full visibility.
5. **Tighten INSERT policy** so non-admin creators must set `location_id` to a location they actually have access to:
   ```
   WITH CHECK (
     auth.uid() = created_by
     AND (
       public.is_admin(auth.uid())
       OR (location_id IS NOT NULL AND public.user_has_location_access(auth.uid(), location_id))
     )
   )
   ```
6. **UPDATE policy** unchanged in behaviour but extended with the same location check so users can't move a draft into a location they don't own.
7. The `material_return_items` SELECT policy already piggybacks on `can_access_company(mrn.company_id)`; update it to also require visibility of the parent MRN by checking the parent's `location_id` with the same rule, so item rows can't leak through item-side queries.

## Frontend changes

1. **`src/types/materialIssueReturn.ts`** — add `location_id: string | null` to `MaterialReturnNote` and to `CreateMaterialReturnData`.
2. **`CreateMaterialReturnDialog.tsx`** — add a required **Location** picker (locations the current user has access to in the active company), defaulting to the current `globalLocationId` from `LocationFilterContext` and locking when the source MIN already implies a location. Submission blocked until a location is set. Send `location_id` to the existing `create_material_return_with_items` RPC (RPC signature extended to accept it).
3. **`useMaterialReturns.ts`** — pass `globalLocationId` from `LocationFilterContext` into the query key, and apply `.eq('location_id', globalLocationId)` (plus `.is('location_id', null)` for legacy when no global filter) so the list reacts to the global header location selector.
4. **`MaterialIssueReturn.tsx`** (Returns tab) — add a **Location** column showing `warehouse_locations.name` via a small lookup; list automatically narrows as the user changes the global location filter.
5. **`MaterialReturnDetailsDialog.tsx`** — show the location in the header.

## Backend RPC update

Extend `public.create_material_return_with_items` to accept `p_location_id uuid` and persist it on the inserted row, validating with `user_has_location_access` (admin bypass) so a malicious client can't insert into a foreign location.

## Out of scope

- Re-assigning historical MRNs to locations — they remain visible company-wide until an admin manually edits each (or runs a future repair).
- Changing the existing `material_issue_notes` location semantics.
- Removing the admin override on returns visibility.

## Standards alignment

The chosen model — company tenancy + role/location need-to-know + admin override + immutable audit trail — matches ISO/IEC 27001 A.9.4 (access control to information), GS1 EPCIS "what/where/who" event scoping, and SAP WM's storage-location-based authorisation object M_MSEG_LGO. No public access is opened; reads/writes remain authenticated.
