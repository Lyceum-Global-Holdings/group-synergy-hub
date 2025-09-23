-- Update companies table to support hierarchical module structure
-- Change modules column from text[] to jsonb to support hierarchical structure
ALTER TABLE public.companies 
ALTER COLUMN modules TYPE jsonb USING 
CASE 
  WHEN modules IS NULL THEN '{}'::jsonb
  WHEN array_length(modules, 1) IS NULL THEN '{}'::jsonb
  ELSE (
    SELECT jsonb_object_agg(module_name, 
      CASE module_name
        WHEN 'finance' THEN '["general-ledger", "accounts-payable", "accounts-receivable", "cash-bank", "fixed-assets", "budgeting", "cost-centers", "payments", "bank-reconciliation", "financial-reporting"]'::jsonb
        WHEN 'warehouse' THEN '["item-bin-master", "grn", "putaway", "pick-pack", "material-issue", "stock-transfer", "cycle-count", "stock-adjustment", "delivery-order", "inventory-valuation", "asset-management"]'::jsonb
        WHEN 'sourcing' THEN '["supplier-master", "supplier-registration", "supplier-evaluation", "rfq-management", "quotation-comparison", "vendor-scorecards", "contracts", "blacklist"]'::jsonb
        WHEN 'procurement' THEN '["purchase-requisition", "purchase-order", "blanket-po", "po-amendment", "three-way-match", "catalogs", "price-lists"]'::jsonb
        WHEN 'bom' THEN '["bom-management"]'::jsonb
        WHEN 'management' THEN '["dashboards", "approvals", "audit-logs", "budget-actual", "exceptions"]'::jsonb
        ELSE '[]'::jsonb
      END
    )
    FROM unnest(modules) AS module_name
  )
END;

-- Update the default value
ALTER TABLE public.companies 
ALTER COLUMN modules SET DEFAULT '{}'::jsonb;