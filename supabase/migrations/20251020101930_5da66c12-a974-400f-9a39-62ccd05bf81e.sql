-- Create BOM Versions Table
CREATE TABLE IF NOT EXISTS public.bom_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES public.bill_of_materials(id) ON DELETE CASCADE,
  version_number TEXT NOT NULL,
  version_notes TEXT,
  changes_summary JSONB DEFAULT '[]'::jsonb,
  previous_version_id UUID REFERENCES public.bom_versions(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  version_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(bom_id, version_number)
);

-- Create BOM Templates Table
CREATE TABLE IF NOT EXISTS public.bom_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  company_id UUID REFERENCES public.companies(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  template_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  usage_count INTEGER DEFAULT 0
);

-- Create BOM Item Substitutions Table
CREATE TABLE IF NOT EXISTS public.bom_item_substitutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_item_id UUID NOT NULL REFERENCES public.bom_items(id) ON DELETE CASCADE,
  substitute_item_id UUID NOT NULL REFERENCES public.warehouse_items(id),
  priority INTEGER DEFAULT 1,
  notes TEXT,
  cost_difference NUMERIC(15,2),
  availability_status TEXT DEFAULT 'available',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create BOM Approvals Table
CREATE TABLE IF NOT EXISTS public.bom_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES public.bill_of_materials(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES auth.users(id),
  approval_level INTEGER NOT NULL DEFAULT 1,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  comments TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bom_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_item_substitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bom_versions
CREATE POLICY "Authenticated users can view BOM versions"
  ON public.bom_versions FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create versions for their BOMs"
  ON public.bom_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bill_of_materials
      WHERE id = bom_id AND (created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

-- RLS Policies for bom_templates
CREATE POLICY "Users can view public templates or their own"
  ON public.bom_templates FOR SELECT
  TO authenticated
  USING (is_public = true OR created_by = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "Authenticated users can create templates"
  ON public.bom_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their own templates"
  ON public.bom_templates FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "Users can delete their own templates"
  ON public.bom_templates FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() OR is_admin(auth.uid()));

-- RLS Policies for bom_item_substitutions
CREATE POLICY "Authenticated users can view substitutions"
  ON public.bom_item_substitutions FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage substitutions"
  ON public.bom_item_substitutions FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for bom_approvals
CREATE POLICY "Users can view approvals for accessible BOMs"
  ON public.bom_approvals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bill_of_materials
      WHERE id = bom_id AND (created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

CREATE POLICY "Approvers can create approvals"
  ON public.bom_approvals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = approver_id);

CREATE POLICY "Approvers can update their approvals"
  ON public.bom_approvals FOR UPDATE
  TO authenticated
  USING (auth.uid() = approver_id);

-- Create indexes for performance
CREATE INDEX idx_bom_versions_bom_id ON public.bom_versions(bom_id);
CREATE INDEX idx_bom_templates_category ON public.bom_templates(category);
CREATE INDEX idx_bom_templates_company ON public.bom_templates(company_id);
CREATE INDEX idx_bom_item_substitutions_bom_item ON public.bom_item_substitutions(bom_item_id);
CREATE INDEX idx_bom_approvals_bom_id ON public.bom_approvals(bom_id);
CREATE INDEX idx_bom_approvals_approver ON public.bom_approvals(approver_id);