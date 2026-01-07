-- Create tool_adjustments table for audit trail
CREATE TABLE tool_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES warehouse_tools(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('increase', 'decrease')),
  quantity_change INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reason TEXT,
  notes TEXT,
  company_id UUID REFERENCES companies(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE tool_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policy - match warehouse_tools pattern
CREATE POLICY "Users can manage tool adjustments"
  ON tool_adjustments FOR ALL
  USING (true);

-- Index for performance
CREATE INDEX idx_tool_adjustments_tool_id ON tool_adjustments(tool_id);
CREATE INDEX idx_tool_adjustments_created_at ON tool_adjustments(created_at DESC);