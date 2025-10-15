-- Phase 1: Asset Request Workflow - Database Schema and Backend Functions

-- =====================================================
-- 1. EXTEND EXISTING ENUMS
-- =====================================================

-- Add new statuses to asset_request_status
ALTER TYPE asset_request_status ADD VALUE IF NOT EXISTS 'pending_delivery';
ALTER TYPE asset_request_status ADD VALUE IF NOT EXISTS 'pending_receipt';

-- Add new statuses to asset_request_item_status  
ALTER TYPE asset_request_item_status ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE asset_request_item_status ADD VALUE IF NOT EXISTS 'received';

-- Create workflow stage enum
DO $$ BEGIN
  CREATE TYPE workflow_stage AS ENUM (
    'submitted',
    'hod_approved',
    'hod_rejected',
    'procurement_approved',
    'procurement_rejected',
    'delivered',
    'received',
    'fulfilled',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create delivery status enum
DO $$ BEGIN
  CREATE TYPE delivery_status AS ENUM (
    'pending_receipt',
    'partially_received',
    'fully_received'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 2. CREATE NEW TABLES
-- =====================================================

-- Workflow History Table
CREATE TABLE IF NOT EXISTS public.asset_request_workflow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.asset_requests(id) ON DELETE CASCADE,
  workflow_stage workflow_stage NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  comments TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_history_request ON public.asset_request_workflow_history(request_id);
CREATE INDEX IF NOT EXISTS idx_workflow_history_stage ON public.asset_request_workflow_history(workflow_stage);

-- Deliveries Table
CREATE TABLE IF NOT EXISTS public.asset_request_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.asset_requests(id) ON DELETE CASCADE,
  delivered_by UUID REFERENCES auth.users(id),
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_location TEXT,
  delivery_notes TEXT,
  status delivery_status NOT NULL DEFAULT 'pending_receipt',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_request ON public.asset_request_deliveries(request_id);

-- Delivery Items Table
CREATE TABLE IF NOT EXISTS public.asset_request_delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.asset_request_deliveries(id) ON DELETE CASCADE,
  request_item_id UUID NOT NULL REFERENCES public.asset_request_items(id) ON DELETE CASCADE,
  quantity_delivered INTEGER NOT NULL DEFAULT 0,
  quantity_received INTEGER DEFAULT 0,
  delivery_notes TEXT,
  receipt_notes TEXT,
  received_at TIMESTAMP WITH TIME ZONE,
  received_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery ON public.asset_request_delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_request_item ON public.asset_request_delivery_items(request_item_id);

-- =====================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.asset_request_workflow_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_request_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_request_delivery_items ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. CREATE RLS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view workflow history for their requests" ON public.asset_request_workflow_history;
CREATE POLICY "Users can view workflow history for their requests"
  ON public.asset_request_workflow_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.asset_requests
      WHERE asset_requests.id = asset_request_workflow_history.request_id
        AND (asset_requests.created_by = auth.uid() OR asset_requests.requested_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "System can create workflow history" ON public.asset_request_workflow_history;
CREATE POLICY "System can create workflow history"
  ON public.asset_request_workflow_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view deliveries for their requests" ON public.asset_request_deliveries;
CREATE POLICY "Users can view deliveries for their requests"
  ON public.asset_request_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.asset_requests
      WHERE asset_requests.id = asset_request_deliveries.request_id
        AND (asset_requests.created_by = auth.uid() OR asset_requests.requested_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Procurement can create deliveries" ON public.asset_request_deliveries;
CREATE POLICY "Procurement can create deliveries"
  ON public.asset_request_deliveries FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = delivered_by);

DROP POLICY IF EXISTS "Procurement can update their deliveries" ON public.asset_request_deliveries;
CREATE POLICY "Procurement can update their deliveries"
  ON public.asset_request_deliveries FOR UPDATE
  USING (auth.uid() = delivered_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view delivery items for their requests" ON public.asset_request_delivery_items;
CREATE POLICY "Users can view delivery items for their requests"
  ON public.asset_request_delivery_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.asset_request_deliveries d
      JOIN public.asset_requests r ON d.request_id = r.id
      WHERE d.id = asset_request_delivery_items.delivery_id
        AND (r.created_by = auth.uid() OR r.requested_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Procurement can create delivery items" ON public.asset_request_delivery_items;
CREATE POLICY "Procurement can create delivery items"
  ON public.asset_request_delivery_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.asset_request_deliveries
      WHERE id = delivery_id AND delivered_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update delivery items for receipt" ON public.asset_request_delivery_items;
CREATE POLICY "Users can update delivery items for receipt"
  ON public.asset_request_delivery_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.asset_request_deliveries d
      JOIN public.asset_requests r ON d.request_id = r.id
      WHERE d.id = asset_request_delivery_items.delivery_id
        AND (r.created_by = auth.uid() OR r.requested_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

-- =====================================================
-- 5. CREATE BACKEND FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION public.record_workflow_action(
  p_request_id UUID,
  p_stage TEXT,
  p_comments TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.asset_request_workflow_history (
    request_id, workflow_stage, performed_by, comments, metadata
  ) VALUES (
    p_request_id, p_stage::workflow_stage, auth.uid(), p_comments, COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_assets_from_request(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_asset_master_id UUID;
  v_request RECORD;
  v_counter INTEGER;
BEGIN
  SELECT * INTO v_request FROM public.asset_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Asset request not found'; END IF;
  
  FOR v_item IN SELECT * FROM public.asset_request_items WHERE request_id = p_request_id AND quantity_fulfilled > 0
  LOOP
    IF v_item.asset_master_id IS NOT NULL THEN
      v_counter := 1;
      WHILE v_counter <= v_item.quantity_fulfilled LOOP
        INSERT INTO public.warehouse_assets (asset_master_id, asset_tag, status, department_id, notes, company_id, created_by)
        VALUES (v_item.asset_master_id, 'AR-' || v_request.request_number || '-' || v_counter, 'in_use', v_request.department, 'Created from Asset Request: ' || v_request.request_number, v_request.company_id, v_request.fulfilled_by);
        v_counter := v_counter + 1;
      END LOOP;
    ELSE
      INSERT INTO public.asset_master (asset_name, description, brand, category_id, company_id, created_by, status)
      VALUES (v_item.item_name, v_item.item_description, v_item.brand, v_item.category_id, v_request.company_id, v_request.fulfilled_by, 'active')
      RETURNING id INTO v_asset_master_id;
      
      v_counter := 1;
      WHILE v_counter <= v_item.quantity_fulfilled LOOP
        INSERT INTO public.warehouse_assets (asset_master_id, asset_tag, status, department_id, notes, company_id, created_by)
        VALUES (v_asset_master_id, 'AR-' || v_request.request_number || '-NEW-' || v_counter, 'in_use', v_request.department, 'New asset from request: ' || v_request.request_number, v_request.company_id, v_request.fulfilled_by);
        v_counter := v_counter + 1;
      END LOOP;
    END IF;
  END LOOP;
  
  PERFORM public.record_workflow_action(p_request_id, 'fulfilled', 'Assets automatically created', jsonb_build_object('auto_created', true));
END;
$$;

-- =====================================================
-- 6. CREATE TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION public.trigger_create_assets_on_fulfillment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'fulfilled' AND (OLD.status IS NULL OR OLD.status != 'fulfilled') THEN
    PERFORM public.create_assets_from_request(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_create_assets_on_fulfillment ON public.asset_requests;
CREATE TRIGGER auto_create_assets_on_fulfillment
  AFTER UPDATE ON public.asset_requests
  FOR EACH ROW EXECUTE FUNCTION public.trigger_create_assets_on_fulfillment();

CREATE OR REPLACE FUNCTION public.trigger_record_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    PERFORM public.record_workflow_action(
      NEW.id,
      CASE NEW.status
        WHEN 'pending_hod_approval' THEN 'submitted'
        WHEN 'pending_procurement_approval' THEN 'hod_approved'
        WHEN 'approved' THEN 'procurement_approved'
        WHEN 'rejected' THEN CASE WHEN OLD.status = 'pending_hod_approval' THEN 'hod_rejected' ELSE 'procurement_rejected' END
        WHEN 'cancelled' THEN 'cancelled'
        ELSE NEW.status::text
      END,
      'Status changed from ' || OLD.status || ' to ' || NEW.status,
      jsonb_build_object('previous_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_status_change ON public.asset_requests;
CREATE TRIGGER record_status_change
  AFTER UPDATE ON public.asset_requests
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.trigger_record_status_change();