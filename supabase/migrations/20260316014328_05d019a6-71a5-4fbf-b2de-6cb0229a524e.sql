
-- 1. Create the warehouse_item_catalog table (global definitions, no company_id)
CREATE TABLE public.warehouse_item_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES public.item_categories(id),
  unit_id uuid REFERENCES public.item_units(id),
  location_id uuid REFERENCES public.warehouse_locations(id),
  brand text,
  manufacturer text,
  supplier_id uuid REFERENCES public.suppliers(id),
  barcode text,
  sku text,
  unit_cost numeric,
  selling_price numeric,
  reorder_level numeric,
  min_stock_level numeric,
  max_stock_level numeric,
  image_url text,
  is_serialized boolean NOT NULL DEFAULT false,
  is_batch_tracked boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- 2. Populate from existing warehouse_items (deduplicate by item_code, keep newest)
INSERT INTO public.warehouse_item_catalog (
  id, item_code, name, description, category_id, unit_id, location_id,
  brand, manufacturer, supplier_id, barcode, sku, unit_cost, selling_price,
  reorder_level, min_stock_level, max_stock_level, image_url,
  is_serialized, is_batch_tracked, status, notes, created_at, updated_at, created_by
)
SELECT DISTINCT ON (item_code)
  gen_random_uuid(), item_code, name, description, category_id, unit_id, location_id,
  brand, manufacturer, supplier_id, barcode, sku, unit_cost, selling_price,
  reorder_level, min_stock_level, max_stock_level, image_url,
  is_serialized, is_batch_tracked, COALESCE(status, 'active'), notes, created_at, updated_at, created_by
FROM public.warehouse_items
ORDER BY item_code, created_at DESC;

-- 3. Add catalog_item_id FK to warehouse_items and backfill
ALTER TABLE public.warehouse_items
  ADD COLUMN catalog_item_id uuid REFERENCES public.warehouse_item_catalog(id);

UPDATE public.warehouse_items wi
SET catalog_item_id = wic.id
FROM public.warehouse_item_catalog wic
WHERE wi.item_code = wic.item_code;

-- 4. Enable RLS on the catalog table
ALTER TABLE public.warehouse_item_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_item_catalog FORCE ROW LEVEL SECURITY;

-- SELECT: warehouse/procurement/finance/admin roles
CREATE POLICY "Authorized roles can view catalog"
ON public.warehouse_item_catalog FOR SELECT TO authenticated
USING (
  public.has_warehouse_access(auth.uid())
  OR public.has_procurement_access(auth.uid())
  OR public.has_finance_access(auth.uid())
  OR public.has_manager_access(auth.uid())
);

-- INSERT: warehouse/admin
CREATE POLICY "Warehouse and admin can insert catalog items"
ON public.warehouse_item_catalog FOR INSERT TO authenticated
WITH CHECK (
  public.has_warehouse_access(auth.uid())
  OR public.has_manager_access(auth.uid())
);

-- UPDATE: warehouse/admin
CREATE POLICY "Warehouse and admin can update catalog items"
ON public.warehouse_item_catalog FOR UPDATE TO authenticated
USING (
  public.has_warehouse_access(auth.uid())
  OR public.has_manager_access(auth.uid())
)
WITH CHECK (
  public.has_warehouse_access(auth.uid())
  OR public.has_manager_access(auth.uid())
);

-- DELETE: admin only
CREATE POLICY "Admin can delete catalog items"
ON public.warehouse_item_catalog FOR DELETE TO authenticated
USING (
  public.has_manager_access(auth.uid())
);

-- 5. Updated_at trigger
CREATE TRIGGER update_warehouse_item_catalog_updated_at
  BEFORE UPDATE ON public.warehouse_item_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
