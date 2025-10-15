-- Phase 1: Database Schema Updates for Enhanced Asset Request Workflow

-- 1.1 Extend Enums with new statuses
DO $$ 
BEGIN
  -- Add new asset_request_status values
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'purchased' AND enumtypid = 'asset_request_status'::regtype) THEN
    ALTER TYPE asset_request_status ADD VALUE 'purchased';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'returned' AND enumtypid = 'asset_request_status'::regtype) THEN
    ALTER TYPE asset_request_status ADD VALUE 'returned';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'partially_returned' AND enumtypid = 'asset_request_status'::regtype) THEN
    ALTER TYPE asset_request_status ADD VALUE 'partially_returned';
  END IF;
  
  -- Add new workflow_stage values
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'purchased' AND enumtypid = 'workflow_stage'::regtype) THEN
    ALTER TYPE workflow_stage ADD VALUE 'purchased';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'returned' AND enumtypid = 'workflow_stage'::regtype) THEN
    ALTER TYPE workflow_stage ADD VALUE 'returned';
  END IF;
  
  -- Add new asset_request_item_status values
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'purchased' AND enumtypid = 'asset_request_item_status'::regtype) THEN
    ALTER TYPE asset_request_item_status ADD VALUE 'purchased';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'returned' AND enumtypid = 'asset_request_item_status'::regtype) THEN
    ALTER TYPE asset_request_item_status ADD VALUE 'returned';
  END IF;
END $$;

-- 1.2 Add Main Warehouse Location Field to Companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS main_warehouse_location_id UUID REFERENCES public.warehouse_locations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.companies.main_warehouse_location_id IS 'Default warehouse location where purchased assets are initially stored before department transfer';

-- 1.3 Create Asset Returns Table
CREATE TABLE IF NOT EXISTS public.asset_request_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.asset_requests(id) ON DELETE CASCADE,
  delivery_id UUID NOT NULL REFERENCES public.asset_request_deliveries(id) ON DELETE CASCADE,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  returned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  return_reason TEXT NOT NULL,
  return_notes TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.asset_request_returns IS 'Tracks returned items from asset request deliveries';
COMMENT ON COLUMN public.asset_request_returns.items IS 'JSON array of returned items: [{item_id, quantity_returned, reason}]';
COMMENT ON COLUMN public.asset_request_returns.status IS 'Return status: pending, acknowledged, resolved';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_asset_request_returns_request_id ON public.asset_request_returns(request_id);
CREATE INDEX IF NOT EXISTS idx_asset_request_returns_delivery_id ON public.asset_request_returns(delivery_id);

-- Enable RLS on asset_request_returns
ALTER TABLE public.asset_request_returns ENABLE ROW LEVEL SECURITY;

-- 1.4 Create RLS Policies for asset_request_returns

-- Policy: Users can view returns for their requests
CREATE POLICY "Users can view returns for their requests"
  ON public.asset_request_returns 
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.asset_requests
      WHERE asset_requests.id = asset_request_returns.request_id
      AND (
        asset_requests.created_by = auth.uid() 
        OR asset_requests.requested_by = auth.uid() 
        OR is_admin(auth.uid())
      )
    )
  );

-- Policy: Requesters can create returns
CREATE POLICY "Requesters can create returns"
  ON public.asset_request_returns 
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.asset_requests
      WHERE asset_requests.id = asset_request_returns.request_id
      AND (
        asset_requests.created_by = auth.uid() 
        OR asset_requests.requested_by = auth.uid()
      )
    )
    AND auth.uid() = returned_by
  );

-- Policy: Procurement/Admins can update returns
CREATE POLICY "Procurement can update returns"
  ON public.asset_request_returns 
  FOR UPDATE
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Policy: Admins can delete returns
CREATE POLICY "Admins can delete returns"
  ON public.asset_request_returns 
  FOR DELETE
  USING (is_admin(auth.uid()));