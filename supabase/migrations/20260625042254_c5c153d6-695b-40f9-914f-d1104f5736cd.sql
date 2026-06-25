-- Reconcile orphaned stock-increase for INV-RAW-000-0007 (company 39ff33f9-..., bin LFC-LKSB)
-- The 2026-06-25 04:19:12 ledger entry credited +2 but the matching bin allocation
-- update failed at the time due to a unique-constraint bug (now fixed in app code).
UPDATE public.warehouse_bin_allocations
SET allocated_quantity = allocated_quantity + 2,
    updated_at = now()
WHERE warehouse_item_id = '6a7e2ea5-71dc-4187-88fc-ed14b0daedde'
  AND bin_id = '870e84cb-f119-4f66-8599-a176bc03c9d1'
  AND allocated_quantity = 0;