-- Create enum for PO amendment types
CREATE TYPE po_amendment_type AS ENUM (
  'price_change',
  'quantity_change',
  'delivery_date_change',
  'terms_change',
  'item_addition',
  'item_removal',
  'other'
);

-- Create po_amendments table
CREATE TABLE po_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amendment_number TEXT NOT NULL UNIQUE,
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  amendment_type po_amendment_type NOT NULL,
  amendment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL,
  notes TEXT,
  previous_value JSONB,
  new_value JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by UUID REFERENCES auth.users(id),
  approved_date TIMESTAMPTZ,
  CONSTRAINT valid_approval CHECK (
    (approved_by IS NULL AND approved_date IS NULL) OR
    (approved_by IS NOT NULL AND approved_date IS NOT NULL)
  )
);

-- Create index for performance
CREATE INDEX idx_po_amendments_po_id ON po_amendments(po_id);
CREATE INDEX idx_po_amendments_created_by ON po_amendments(created_by);
CREATE INDEX idx_po_amendments_approved_by ON po_amendments(approved_by);

-- Enable RLS
ALTER TABLE po_amendments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view PO amendments"
  ON po_amendments FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create amendments for their POs"
  ON po_amendments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchase_orders
      WHERE id = po_amendments.po_id
      AND (created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

CREATE POLICY "Admins can manage amendments"
  ON po_amendments FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

-- Function to generate amendment number
CREATE OR REPLACE FUNCTION generate_po_amendment_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_amendment_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(amendment_number FROM 'POAMD-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM po_amendments
  WHERE amendment_number LIKE 'POAMD-%';
  
  new_amendment_number := 'POAMD-' || LPAD(next_number::TEXT, 4, '0');
  RETURN new_amendment_number;
END;
$$;