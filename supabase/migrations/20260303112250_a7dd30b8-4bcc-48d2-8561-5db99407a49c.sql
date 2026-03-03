ALTER TABLE public.construction_item_master
  ADD COLUMN IF NOT EXISTS sub_category text,
  ADD COLUMN IF NOT EXISTS color text;