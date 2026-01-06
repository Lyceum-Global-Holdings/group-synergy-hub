-- Create warehouse_tools table for tool inventory
CREATE TABLE public.warehouse_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES asset_categories(id),
  location_id UUID REFERENCES warehouse_locations(id),
  total_quantity INTEGER NOT NULL DEFAULT 1,
  available_quantity INTEGER NOT NULL DEFAULT 1,
  issued_quantity INTEGER NOT NULL DEFAULT 0,
  condition TEXT NOT NULL DEFAULT 'good',
  unit_cost NUMERIC,
  image_url TEXT,
  notes TEXT,
  company_id UUID REFERENCES companies(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create tool_issues table for tracking tool issuances
CREATE TABLE public.tool_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_number TEXT NOT NULL UNIQUE,
  tool_id UUID NOT NULL REFERENCES warehouse_tools(id) ON DELETE CASCADE,
  issued_to UUID,
  issued_to_name TEXT NOT NULL,
  department TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_return_date DATE,
  quantity_issued INTEGER NOT NULL DEFAULT 1,
  quantity_returned INTEGER NOT NULL DEFAULT 0,
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'issued',
  notes TEXT,
  approved_by UUID,
  company_id UUID REFERENCES companies(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create tool_returns table for tracking tool returns
CREATE TABLE public.tool_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number TEXT NOT NULL UNIQUE,
  issue_id UUID NOT NULL REFERENCES tool_issues(id) ON DELETE CASCADE,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity_returned INTEGER NOT NULL,
  condition TEXT NOT NULL DEFAULT 'good',
  condition_notes TEXT,
  returned_by_name TEXT,
  received_by UUID,
  status TEXT NOT NULL DEFAULT 'completed',
  notes TEXT,
  company_id UUID REFERENCES companies(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.warehouse_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_returns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for warehouse_tools
CREATE POLICY "Users can view warehouse tools" ON public.warehouse_tools
  FOR SELECT USING (true);

CREATE POLICY "Users can create warehouse tools" ON public.warehouse_tools
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update warehouse tools" ON public.warehouse_tools
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete warehouse tools" ON public.warehouse_tools
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS Policies for tool_issues
CREATE POLICY "Users can view tool issues" ON public.tool_issues
  FOR SELECT USING (true);

CREATE POLICY "Users can create tool issues" ON public.tool_issues
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update tool issues" ON public.tool_issues
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete tool issues" ON public.tool_issues
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS Policies for tool_returns
CREATE POLICY "Users can view tool returns" ON public.tool_returns
  FOR SELECT USING (true);

CREATE POLICY "Users can create tool returns" ON public.tool_returns
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update tool returns" ON public.tool_returns
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete tool returns" ON public.tool_returns
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create indexes for better performance
CREATE INDEX idx_warehouse_tools_company ON public.warehouse_tools(company_id);
CREATE INDEX idx_warehouse_tools_category ON public.warehouse_tools(category_id);
CREATE INDEX idx_warehouse_tools_location ON public.warehouse_tools(location_id);
CREATE INDEX idx_tool_issues_tool ON public.tool_issues(tool_id);
CREATE INDEX idx_tool_issues_status ON public.tool_issues(status);
CREATE INDEX idx_tool_issues_company ON public.tool_issues(company_id);
CREATE INDEX idx_tool_returns_issue ON public.tool_returns(issue_id);
CREATE INDEX idx_tool_returns_company ON public.tool_returns(company_id);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_warehouse_tools_updated_at
  BEFORE UPDATE ON public.warehouse_tools
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tool_issues_updated_at
  BEFORE UPDATE ON public.tool_issues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tool_returns_updated_at
  BEFORE UPDATE ON public.tool_returns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();