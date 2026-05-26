## Problem

Clicking **Create Transfer** fails because the insert into `stock_transfer_requests` is missing required scoping fields:

- `company_id` is never sent (the dialog passes `undefined`), even though the project rule is "company_id is mandatory for all writes" and Postgres logs show prior `new row violates row-level security policy for table "stock_transfer_requests"` failures from this exact code path.
- `from_location_id` / `to_location_id` are also never sent. Later, `useCompleteStockTransfer` derives `sourceLocationId` / `destinationLocationId` from these fields — so even if create succeeded today, completion would write `stock_transactions` and bin allocations with `location_id = null`, breaking the location-scoped stock model (per the *Stock Tx Location Scope* rule).

## Fix

Resolve `company_id` and the source/destination `location_id` from the bins the user already picked, and pass them into the insert. No schema changes needed.

### 1. `src/components/warehouse/CreateStockTransferDialog.tsx`

- After the user picks `from_bin_id` / `to_bin_id`, look up the bin rows from `useWarehouseBins()`.
- Derive `company_id` as: source bin's `company_id` → fall back to active company from `useCompany()`.
- Derive `from_location_id` = source bin's `location_id`; `to_location_id` = destination bin's `location_id`.
- Add them to `transferData` passed to `createTransfer.mutateAsync(...)`.
- If `company_id` cannot be resolved (shared bin with no active company), show the existing form error and abort — do not call the mutation.

### 2. `src/types/stockTransfer.ts`

Extend `CreateStockTransferData` with optional `from_location_id?: string` and `to_location_id?: string` so TypeScript accepts the new fields.

### 3. `src/hooks/useStockTransfer.ts` — `useCreateStockTransfer`

- Include `company_id`, `from_location_id`, `to_location_id` in the insert payload.
- Improve the error toast to surface `error.message` instead of the generic "Failed to create transfer request." so future failures are diagnosable in one shot.

### 4. Verify

- Re-open the dialog, pick a source + destination bin, add an item, submit, and confirm:
  - Toast says "Transfer Created".
  - New row in `stock_transfer_requests` has non-null `company_id`, `from_location_id`, `to_location_id`.
  - Subsequent **Complete** writes `stock_transactions` and `warehouse_bin_allocations` with the correct `location_id`.

## Out of scope (separate issues, flag only)

- The list query in `useStockTransferRequests` does 6 joins on `warehouse_locations` and is causing recurring `statement timeout` errors on the page. Worth migrating to a `list_stock_transfers` RPC per the *List RPC Pattern* memory — call out as a follow-up, not part of this fix.
