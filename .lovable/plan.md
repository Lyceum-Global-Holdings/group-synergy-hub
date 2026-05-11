## Goal
Let an authenticated user with edit rights adjust the **scanned** bin's stock directly from the public `/b/:id` page, with reason codes and an audit trail aligned to ISO 9001 §8.5.4 and GS1 EPCIS / CBV inventory bizSteps.

## Flow

```text
Scan QR → /b/:id (public)
  ├─ logged out → "Sign in to adjust" → /auth?redirect=/b/:id
  └─ logged in
       ├─ has access to allocation.company_id → "Adjust stock" button
       └─ no access → button hidden, info banner
Click Adjust → ScannedBinAdjustmentDialog (locked to this item × bin × location)
  → atomic RPC adjust_bin_allocation_from_scan()
  → success toast + refreshed quantities on the same page
```

## Changes

### 1. DB migration — atomic, server-authorized RPC
New `public.adjust_bin_allocation_from_scan(p_allocation_id uuid, p_delta numeric, p_reason_code text, p_notes text) returns jsonb`:
- `SECURITY INVOKER`, `SET search_path = public`.
- Loads the allocation row + parent item/bin/location/company.
- Authorizes via `can_access_company(allocation.company_id)`; rejects with `permission denied` otherwise.
- Validates `p_reason_code` against an allow-list (`cycle_count`, `damage`, `loss`, `found`, `correction`, `transfer_in`, `transfer_out`) — these map to GS1 CBV bizSteps (`cycle_counting`, `inventory_check`, `corrective_action`).
- Validates `p_delta` non-zero; for negative deltas ensures `allocated_quantity + p_delta >= 0`.
- Updates `warehouse_bin_allocations.allocated_quantity` (excluding the generated `available_quantity` column per project rule).
- Inserts one `stock_transactions` row with `transaction_type='adjustment'`, `reference_type='adjustment'`, `bin_id`, `location_id`, `company_id`, `adjustment_reason = p_reason_code`, `notes = '[QR scan] ' || p_notes`, `created_by = auth.uid()`.
- Returns `{ ok: true, new_quantity, transaction_id }`.
- `GRANT EXECUTE … TO authenticated;` (anon excluded).

No schema additions needed — `stock_transactions.adjustment_reason`, `bin_id`, `location_id` already exist.

### 2. Frontend — `src/pages/PublicBinAllocation.tsx`
- Use `useAuth()` to detect session.
- Add a footer action area:
  - Logged out → primary button "Sign in to adjust stock" → `/auth?redirect=/b/{id}`.
  - Logged in → primary button "Adjust stock" opens the new dialog.
- After a successful adjustment, re-fetch via the existing `public-bin-qr` edge function (cache busted with `?ts=`) so the page reflects the new quantities.

### 3. New component `src/components/warehouse/ScannedBinAdjustmentDialog.tsx`
- Read-only header: item code/name · bin · location · current allocated/available.
- Inputs: adjustment direction (Increase / Decrease), quantity (>0), reason code (Select), optional notes.
- Submits via a new hook `useScannedBinAdjustment` calling the RPC.
- Disables submit while pending; surfaces RPC errors verbatim (already sanitized by RPC).

### 4. Auth redirect
`src/pages/Auth.tsx` already honors `?redirect=` (verified). No change beyond confirming `/b/:id` is whitelisted by the existing redirect logic (it is — any same-origin path is accepted).

### 5. Memory
Append a new memory `mem://features/warehouse/scanned-bin-adjustment` documenting:
- Reason-code allow-list and CBV mapping.
- RPC name + auth model (server-side `can_access_company` check, never trust the client).
- "All scanned adjustments must include a reason code" rule.
Index updated.

## Standards alignment
- **ISO 9001 §8.5.4 / ISO 55001** — every quantity change has user, timestamp, location, reason.
- **GS1 EPCIS 2.0 / CBV** — reason codes map to standardized bizSteps (`cycle_counting`, `inventory_check`, `corrective_action`).
- **OWASP ASVS L2** — server-side authorization (RPC), input allow-list, generic errors on the public surface, no client-supplied authority.

## Out of scope
- Emitting EPCIS XML/JSON events (data is captured to support future emission).
- Multi-bin / batch scanning sessions.
- Editing item master fields from the QR page.
- Approval workflow for large adjustments (existing approval console handles that separately).

## Verification
1. Logged out: `/b/<valid-uuid>` shows "Sign in to adjust stock" → `/auth?redirect=/b/<id>` → after sign-in, lands back on the page with the "Adjust stock" button.
2. Logged-in user **with** company access: increase by 3 with reason `cycle_count` → page refreshes, allocated and available both +3, one `stock_transactions` row appended with `adjustment_reason='cycle_count'`, `bin_id`, `location_id`, `created_by` set.
3. Logged-in user **without** company access: RPC returns `permission denied`; UI shows generic error.
4. Decrease larger than current → RPC rejects with `insufficient_quantity`; no rows mutated.
5. Invalid reason code via crafted RPC call → rejected.
6. Public RPC `get_public_bin_allocation_qr` and the new RPC both stay scoped to the single allocation; no cross-tenant leakage.
