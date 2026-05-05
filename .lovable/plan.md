## Problem

Material Requests, Material Issue Notes (MIN), and Material Return Notes (MRN) lists currently show records across **all companies and all locations** the user has access to. RLS (`can_access_company`) correctly allows multi-company access at the database layer, but the UI hooks do not narrow the result set by the **currently selected company** or the **globally selected location** in the header.

International stores-management standard (ISO 9001 / SAP MM behaviour): a stores user operates within one **Plant (Company) + Storage Location** scope at a time. Cross-company visibility must be an explicit choice, not the default.

## Fix

Apply company + location scoping at the data-fetch layer in the three hooks driving the Material Issue & Return module.

### 1. `src/hooks/useMaterialRequests.ts`
- Read `selectedCompany` from `useCompany()` and `globalLocationId` from `useLocationFilter()`.
- Update `useQuery`:
  - `queryKey: ['material-requests', selectedCompany?.id, globalLocationId]`
  - `enabled: !!selectedCompany?.id`
  - Add `.eq('company_id', selectedCompany.id)`
  - If `globalLocationId` is set, add `.eq('location_id', globalLocationId)`

### 2. `src/hooks/useMaterialIssues.ts`
- Same pattern on `material_issue_notes` query (`['material-issues', companyId, locationId]`).

### 3. `src/hooks/useMaterialReturns.ts`
- Same pattern on `material_return_notes` query (`['material-returns', companyId, locationId]`).

### 4. Create-side safety
- In all three `create...Mutation` calls, ensure `company_id: selectedCompany.id` is passed (it currently relies on the form value). Add a guard that throws if no company is selected.
- Invalidate queries with the new compound query keys (`['material-requests']` prefix invalidation still works via React Query's partial-match).

### 5. UI feedback
- In `src/pages/warehouse/MaterialIssueReturn.tsx`, when no company is selected show an empty-state: "Select a company in the header to view material documents."
- The existing global Location selector in the header already drives `globalLocationId`; the lists will now react to it automatically.

## Why not change RLS

RLS already enforces company-membership correctly. The bug is purely **client-side scoping**. Tightening RLS further would break legitimate cross-company admin views (Approval Console, Reports). Scoping at the hook layer keeps the lists context-aware while preserving admin capabilities elsewhere.

## Files to edit

- `src/hooks/useMaterialRequests.ts`
- `src/hooks/useMaterialIssues.ts`
- `src/hooks/useMaterialReturns.ts`
- `src/pages/warehouse/MaterialIssueReturn.tsx` (empty-state guard)

No DB migration required.