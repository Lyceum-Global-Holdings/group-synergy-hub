---
name: scanned-bin-adjustment
description: Adjust stock for a scanned bin allocation via /b/:id with reason codes mapped to GS1 CBV bizSteps
type: feature
---

After scanning a bin QR (`/b/:id`), an authenticated user with company access can adjust the stock for that exact (item × bin × location) tuple.

- Logged-out users see a "Sign in to adjust stock" CTA → `/auth?redirect=/b/:id`. The Auth page already honors `?redirect=`.
- Logged-in users see "Adjust stock" → `ScannedBinAdjustmentDialog` (read-only header, direction, qty, reason, notes).
- Submission calls atomic RPC `public.adjust_bin_allocation_from_scan(p_allocation_id, p_delta, p_reason_code, p_notes)`:
  - `SECURITY INVOKER`, `search_path = public`. Granted to `authenticated` only (anon revoked).
  - Authorizes via `can_access_company(allocation.company_id)` server-side. Never trust client.
  - Validates reason code against allow-list: `cycle_count`, `correction`, `found`, `damage`, `loss`, `transfer_in`, `transfer_out`. These map to GS1 CBV bizSteps (`cycle_counting`, `inventory_check`, `corrective_action`, `receiving`, `shipping`).
  - Locks the allocation row, updates `allocated_quantity` (excluding the generated `available_quantity` column), inserts one `stock_transactions` row with `transaction_type='adjustment'`, `bin_id`, `location_id`, `adjustment_reason`, notes prefixed `[QR scan] `.
  - Errors are stable string codes (`permission_denied`, `insufficient_quantity`, `invalid_reason_code`, `invalid_delta`, `allocation_not_found`, `authentication_required`) — UI maps them to friendly text.
- Standards: ISO 9001 §8.5.4 / ISO 55001 (auditable change with user, time, location, reason); GS1 EPCIS 2.0 / CBV reason mapping; OWASP ASVS L2 (server-side authorization, input allow-list, generic public errors).
