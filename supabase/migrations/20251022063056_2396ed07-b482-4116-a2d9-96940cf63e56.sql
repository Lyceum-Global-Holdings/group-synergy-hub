-- Create role_modules table for role-based module access
CREATE TABLE public.role_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  submodules TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(role_id, module_key)
);

CREATE INDEX idx_role_modules_role_id ON role_modules(role_id);

-- Create user_modules table for user-specific overrides
CREATE TABLE public.user_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  submodules TEXT[] DEFAULT '{}',
  access_type TEXT NOT NULL CHECK (access_type IN ('grant', 'deny')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, module_key)
);

CREATE INDEX idx_user_modules_user_id ON user_modules(user_id);

-- Enable RLS
ALTER TABLE public.role_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_modules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for role_modules
CREATE POLICY "Super admins can view all role modules"
ON public.role_modules FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.app_role = 'super_admin'
  )
);

CREATE POLICY "Admins can view role modules for their company"
ON public.role_modules FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.app_role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Super admins can manage all role modules"
ON public.role_modules FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.app_role = 'super_admin'
  )
);

-- RLS Policies for user_modules
CREATE POLICY "Super admins can view all user modules"
ON public.user_modules FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.app_role = 'super_admin'
  )
);

CREATE POLICY "Admins can view user modules"
ON public.user_modules FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.app_role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Users can view their own modules"
ON public.user_modules FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Super admins can manage all user modules"
ON public.user_modules FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.app_role = 'super_admin'
  )
);

-- Grant all modules to all existing roles for backward compatibility
INSERT INTO role_modules (role_id, module_key, submodules)
SELECT r.id, m.key, m.submodules
FROM roles r
CROSS JOIN (
  VALUES 
    ('warehouse', ARRAY['stock-transfer', 'cycle-count', 'inventory-valuation', 'locations', 'kpis']::TEXT[]),
    ('procurement', ARRAY['purchase-requisitions', 'purchase-orders', 'goods-receipt', 'supplier-evaluation', 'rfq-rfp', 'blanket-purchase-orders']::TEXT[]),
    ('suppliers', ARRAY['supplier-list', 'supplier-details']::TEXT[]),
    ('production', ARRAY['bill-of-materials', 'production-batches', 'material-issue', 'material-return']::TEXT[]),
    ('sales', ARRAY['customer-orders', 'sales-orders', 'pick-lists', 'delivery-orders']::TEXT[]),
    ('finance', ARRAY['accounts', 'journal-entries', 'reports']::TEXT[]),
    ('assets', ARRAY['asset-master', 'asset-requests', 'maintenance']::TEXT[]),
    ('admin', ARRAY['users-roles', 'companies', 'settings']::TEXT[])
) AS m(key, submodules)
ON CONFLICT (role_id, module_key) DO NOTHING;