-- Costume rental: allow a rental order line to pre-select a specific physical
-- unit (preferred unit) chosen in the catalog/bucket. It's a preference carried
-- from the bucket onto the order; the actual assignment is still confirmed at
-- checkout (rental_unit_assignments). Nullable — quick size/qty lines leave it null.

ALTER TABLE public.rental_order_items
  ADD COLUMN IF NOT EXISTS preferred_unit_id uuid REFERENCES public.rental_costume_units(id);

CREATE INDEX IF NOT EXISTS idx_rental_items_preferred_unit
  ON public.rental_order_items(preferred_unit_id);
