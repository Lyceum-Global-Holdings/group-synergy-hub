BEGIN;

-- ===== warehouse_items =====
ALTER TABLE public.warehouse_items DROP COLUMN IF EXISTS available_quantity;
ALTER TABLE public.warehouse_items
  ALTER COLUMN current_stock TYPE numeric(18,3),
  ALTER COLUMN reserved_quantity TYPE numeric(18,3);
ALTER TABLE public.warehouse_items
  ADD COLUMN available_quantity numeric(18,3)
  GENERATED ALWAYS AS (current_stock - COALESCE(reserved_quantity, (0)::numeric)) STORED;

-- ===== warehouse_bin_allocations =====
ALTER TABLE public.warehouse_bin_allocations DROP COLUMN IF EXISTS available_quantity;
ALTER TABLE public.warehouse_bin_allocations
  ALTER COLUMN allocated_quantity TYPE numeric(18,3),
  ALTER COLUMN reserved_quantity TYPE numeric(18,3);
ALTER TABLE public.warehouse_bin_allocations
  ADD COLUMN available_quantity numeric(18,3)
  GENERATED ALWAYS AS (allocated_quantity - reserved_quantity) STORED;

-- ===== warehouse_item_reservations (has generated quantity_remaining) =====
ALTER TABLE public.warehouse_item_reservations DROP COLUMN IF EXISTS quantity_remaining;
ALTER TABLE public.warehouse_item_reservations
  ALTER COLUMN reserved_quantity TYPE numeric(18,3),
  ALTER COLUMN quantity_issued TYPE numeric(18,3);
ALTER TABLE public.warehouse_item_reservations
  ADD COLUMN quantity_remaining numeric(18,3)
  GENERATED ALWAYS AS (reserved_quantity - quantity_issued) STORED;

-- ===== finished_goods (has generated available_stock) =====
ALTER TABLE public.finished_goods DROP COLUMN IF EXISTS available_stock;
ALTER TABLE public.finished_goods
  ALTER COLUMN current_stock TYPE numeric(18,3),
  ALTER COLUMN reserved_stock TYPE numeric(18,3);
ALTER TABLE public.finished_goods
  ADD COLUMN available_stock numeric(18,3)
  GENERATED ALWAYS AS (current_stock - reserved_stock) STORED;

-- ===== finished_goods_batches / movements / reservations =====
ALTER TABLE public.finished_goods_batches
  ALTER COLUMN quantity TYPE numeric(18,3);
ALTER TABLE public.finished_goods_movements
  ALTER COLUMN quantity_change TYPE numeric(18,3),
  ALTER COLUMN quantity_before TYPE numeric(18,3),
  ALTER COLUMN quantity_after TYPE numeric(18,3);
ALTER TABLE public.finished_goods_reservations
  ALTER COLUMN reserved_quantity TYPE numeric(18,3);

-- ===== construction inventory =====
ALTER TABLE public.construction_inventory_stock
  ALTER COLUMN quantity TYPE numeric(18,3),
  ALTER COLUMN reserved_quantity TYPE numeric(18,3);
ALTER TABLE public.construction_inventory_master
  ALTER COLUMN quantity TYPE numeric(18,3);
ALTER TABLE public.construction_inventory_transactions
  ALTER COLUMN quantity_change TYPE numeric(18,3);
ALTER TABLE public.construction_repair_records
  ALTER COLUMN quantity TYPE numeric(18,3);
ALTER TABLE public.construction_transfer_items
  ALTER COLUMN quantity TYPE numeric(18,3);

-- ===== procurement / sourcing / BOM line quantities =====
ALTER TABLE public.pr_items
  ALTER COLUMN quantity TYPE numeric(18,3);
ALTER TABLE public.rfq_rfp_items
  ALTER COLUMN quantity TYPE numeric(18,3);
ALTER TABLE public.bom_items
  ALTER COLUMN quantity TYPE numeric(18,3);
ALTER TABLE public.project_budget_items
  ALTER COLUMN quantity TYPE numeric(18,3);

COMMIT;