
## Fix sub-location company assignment with hierarchical inheritance and admin-safe writes

### Outcome

Sub-locations and departments will be correctly assigned to the selected companies, remain visible in warehouse management, and follow a consistent hierarchy model:

- Top-level `location` keeps an explicit company allocation.
- Child `sublocation` / `department` defaults to **inherit parent companies**.
- Admins can still make a child explicit when needed.
- Existing orphaned child records with no mappings but mapped parents are backfilled safely.

### Root cause

The current implementation has three gaps:

1. `useLocationCompanies.ts` writes directly to `warehouse_location_companies` under company-scoped RLS, which is not reliable for admin master-data maintenance across all mapped companies.
2. Child locations have **no canonical inheritance model**. Many sub-locations/departments have zero direct mappings while their parent has valid company mappings.
3. Create/edit flows treat company assignment as a flat picker, but warehouse locations are hierarchical master data.

Verified examples:
- `Lyceum Anuradhapura` already has direct `LIS + NWS` mappings.
- Many other children (e.g. `LNQ-1F` … `LNQ-5F`) have **no direct mapping** even though the parent has company assignments.

## Best-practice solution

Adopt a **hierarchical master-data allocation model** aligned with SAP EWM / warehouse hierarchy governance and ISO 8000 master-data quality:

- Use **explicit vs inherited** allocation mode.
- Resolve effective companies server-side.
- Use admin-gated `SECURITY DEFINER` RPCs for master-data reads/writes.
- Backfill only children with no direct mappings so existing explicit overrides are preserved.

## Changes to implement

### 1) Database: add allocation mode and effective-assignment RPCs

Create a migration that:

- Adds `company_assignment_mode` to `warehouse_locations`
  - `explicit`
  - `inherit_parent`
- Backfills:
  - `location` rows → `explicit`
  - child rows with direct mappings → `explicit`
  - child rows with no direct mappings and mapped parent → `inherit_parent`

Add admin-safe RPCs:

- `get_location_company_assignments_admin()`
  - returns direct + effective company assignments plus mode and inheritance source
- `set_location_company_assignments_admin(location_id uuid, company_ids uuid[], assignment_mode text)`
  - validates admin/super-admin role
  - writes direct mappings atomically
  - for `inherit_parent`, clears direct child rows and relies on parent resolution
  - for `explicit`, replaces direct rows with the submitted set

Add a reusable resolver function:

- `get_effective_location_company_ids(location_id uuid)`
  - returns direct companies for `explicit`
  - returns parent-resolved companies for `inherit_parent`

This keeps master-data writes consistent and avoids partial client-side delete/insert behavior.

### 2) Data repair migration for existing child locations

In the same migration, backfill existing records:

- Insert missing inherited mappings only for reporting if needed, or rely on the resolver function for effective reads.
- Preserve children that already have explicit direct mappings.
- Do not overwrite cases like `Lyceum Anuradhapura` that already carry a deliberate multi-company assignment.

If the codebase continues to rely on raw junction-table queries in some places, add a compatibility backfill for children with zero mappings and mapped parents.

### 3) Frontend: replace raw junction-table edits with admin RPCs

Update `src/hooks/useLocationCompanies.ts`:

- stop reading/writing `warehouse_location_companies` directly for admin maintenance
- load:
  - direct company IDs
  - effective company IDs
  - assignment mode
  - inheritance source
- save through `set_location_company_assignments_admin(...)`

This makes admin edits deterministic and RLS-safe.

### 4) Warehouse Management: make child assignment mode visible and controllable

Update `src/pages/admin/WarehouseManagement.tsx`:

- in the edit dialog, add:
  - assignment mode selector:
    - `Inherit parent companies`
    - `Use explicit companies`
- when a parent is selected for a sub-location/department:
  - default mode to `inherit_parent`
  - prefill the effective parent companies
- show visual badges in the table:
  - explicit company chips
  - inherited chips with `via {parent}`
- keep fallback chip logic for unknown companies

This gives admins a clear, auditable hierarchy model.

### 5) Location Management dialog: enforce hierarchical defaults

Update `src/components/warehouse/LocationManagementDialog.tsx`:

- when creating a `sublocation` or `department`:
  - if a parent is chosen, default to `inherit_parent`
  - show inherited companies immediately
  - only expose manual company picking when switched to `explicit`
- on submit, save mode + companies through the new hook/RPC

This prevents child locations from being created without a valid company scope.

### 6) Normalize all location-creation entry points

Update any location creation flows that currently bypass company assignment logic:

- `src/components/warehouse/ImportLocationsDialog.tsx`
- `src/components/warehouse/LocationTemplateDialog.tsx`

Behavior:
- top-level locations must have explicit companies
- child locations created under a parent default to `inherit_parent`
- no more child rows with empty effective company assignment

### 7) Read-side consistency for company-scoped location fetches

Review and update location fetches that currently read raw `warehouse_location_companies`:

- `src/components/common/LocationSelector.tsx`
- `src/hooks/useWarehouseLocations.ts`
- `src/pages/construction/resources/InventoryItems.tsx`
- `src/components/warehouse/AssignLocationDialog.tsx`

Use the effective-assignment source so company-scoped views honor inherited child mappings consistently.

## Files to modify

- New migration in `supabase/migrations/`
- `src/hooks/useLocationCompanies.ts`
- `src/pages/admin/WarehouseManagement.tsx`
- `src/components/warehouse/LocationManagementDialog.tsx`
- `src/components/warehouse/ImportLocationsDialog.tsx`
- `src/components/warehouse/LocationTemplateDialog.tsx`
- `src/components/common/LocationSelector.tsx`
- `src/hooks/useWarehouseLocations.ts`
- `src/pages/construction/resources/InventoryItems.tsx`
- `src/components/warehouse/AssignLocationDialog.tsx`

## Standards alignment

- **ISO 8000**: master-data quality, completeness, and controlled inheritance
- **ISO/IEC 27001 A.9**: admin metadata management separated from transactional RLS
- **SAP EWM / WM hierarchy practice**: child storage entities inherit from parent by default, with explicit override only when justified

## Verification

After implementation:

1. Edit `Lyceum Anuradhapura`:
   - `LIS` and `NWS` remain visible and save correctly.
2. Create a new sub-location under a mapped parent:
   - it automatically inherits the parent company set.
3. Existing children like `LNQ-1F` to `LNQ-5F` resolve to the parent’s companies without manual repair per row.
4. Company-scoped location selectors and warehouse flows return the same effective company visibility as the admin master-data screen.
5. No broad RLS relaxation is introduced; admin master-data writes go only through gated server-side RPCs.

## Technical notes

- Do not relax table RLS on `warehouse_location_companies`.
- Do not overwrite explicit child mappings during backfill.
- Prefer a resolver/RPC model over duplicated client-side inheritance logic.
- Keep `company_id` on `warehouse_locations` as legacy compatibility only until all consumers are migrated to effective-assignment reads.
