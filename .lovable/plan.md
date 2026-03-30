
## Fix: CSV Stock Upload Still Fails

### What I found
The current failure is not the generated-column issue anymore. The latest console logs show:

```text
new row violates row-level security policy for table "warehouse_bin_allocations"
```

I checked the live RLS policy on `warehouse_bin_allocations` and the current upload code:

- **INSERT policy** requires:
  - user is authenticated
  - `created_by = auth.uid()`
- In `BulkStockUploadDialog.tsx`, the `.upsert()` into `warehouse_bin_allocations` sends:
  - `warehouse_item_id`
  - `bin_id`
  - `allocated_quantity`
  - `company_id`
- It does **not** send `created_by`

So every insert path inside the upsert fails RLS.

There is also a second correctness issue:
- the current `.upsert()` uses `allocated_quantity: row.quantity`
- with a conflict update, that behaves like **replace**, not **add**
- for stock uploads, the expected behavior is **increment existing bin stock**, not overwrite it

### Best solution
Use a proper server-side stock allocation path and align RLS with the warehouse multi-company model.

### Implementation plan

#### 1. Fix `warehouse_bin_allocations` RLS policies
Create a migration to replace the old allocation policies with company-aware warehouse policies:

- **SELECT**: allow users who can access the company
- **INSERT**: require:
  - `can_access_company(company_id)`
  - warehouse/manager/admin access
  - `created_by = auth.uid()`
- **UPDATE**: same company-aware access rules, with both `USING` and `WITH CHECK`
- **DELETE**: admin only, company-scoped

This removes the current mismatch where allocations still use an old “owner-only” policy while the warehouse module already works with cross-company visibility plus company-scoped writes.

#### 2. Fix the upload write payload
Update `src/components/warehouse/BulkStockUploadDialog.tsx` so every allocation insert includes:

- `created_by: user.id`
- `company_id: selectedCompany.id`

This fixes the immediate RLS failure.

#### 3. Replace overwrite-style upsert with additive allocation logic
Change the current allocation write flow from “blind upsert quantity” to:

1. read existing allocation for `(warehouse_item_id, bin_id, company_id)`
2. if found, update to:
   - `allocated_quantity = existing + row.quantity`
3. if not found, insert a new allocation row with:
   - `allocated_quantity = row.quantity`
   - `created_by = user.id`

This preserves opening stock accumulation correctly.

#### 4. Keep stock movement history aligned
Retain the existing `stock_transactions` insert for each uploaded row, but make sure it uses:

- stock before allocation update
- stock after allocation update
- `created_by = user.id`
- `company_id = selectedCompany.id`

That keeps upload activity visible in stock movement history as opening stock/import activity.

#### 5. Improve failure visibility in the dialog
Update the import error handling so row failures surface the real database reason in the UI summary, especially for:

- RLS denial
- missing company
- missing authenticated user
- duplicate/constraint issues

This will make future upload failures diagnosable without reading console logs.

### Files to change
- `src/components/warehouse/BulkStockUploadDialog.tsx`
- new migration under `supabase/migrations/` for `warehouse_bin_allocations` RLS policy replacement

### Technical notes
- `available_quantity` should still remain excluded from writes; it is a generated column
- the unique constraint on `(warehouse_item_id, bin_id, company_id)` is already present, so the additive logic should target that exact key
- the current `warehouse_bin_allocations` schema allows nullable `company_id` and `created_by`; the app should always populate both for new rows
- the warehouse architecture already uses:
  - cross-company visibility for reads
  - selected-company scoping for writes  
  so the allocation RLS should match that same standard

### Optional hardening after this fix
If you want the most robust long-term approach, I would next move the bulk stock import write path into a **single database RPC / security-definer function** so the client sends validated rows once and the database performs the allocation + stock transaction writes atomically. That would be faster and safer for large CSV uploads than many client-side round trips.
