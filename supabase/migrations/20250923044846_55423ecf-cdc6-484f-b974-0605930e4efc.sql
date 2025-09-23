-- Update companies table to support hierarchical module structure
-- First, alter the column type to jsonb
ALTER TABLE public.companies 
ALTER COLUMN modules TYPE jsonb USING 
CASE 
  WHEN modules IS NULL THEN '{}'::jsonb
  WHEN array_length(modules, 1) IS NULL THEN '{}'::jsonb
  ELSE (
    SELECT json_object_agg(elem, 
      CASE elem
        WHEN 'finance' THEN '["general-ledger", "accounts-payable", "accounts-receivable", "cash-bank", "fixed-assets", "budgeting", "cost-centers", "payments", "bank-reconciliation", "financial-reporting"]'::json
        WHEN 'warehouse' THEN '["item-bin-master", "grn", "putaway", "pick-pack", "material-issue", "stock-transfer", "cycle-count", "stock-adjustment", "delivery-order", "inventory-valuation", "asset-management"]'::json
        WHEN 'sourcing' THEN '["supplier-master", "supplier-registration", "supplier-evaluation", "rfq-management", "quotation-comparison", "vendor-scorecards", "contracts", "blacklist"]'::json
        WHEN 'procurement' THEN '["purchase-requisition", "purchase-order", "blanket-po", "po-amendment", "three-way-match", "catalogs", "price-lists"]'::json
        WHEN 'bom' THEN '["bom-management"]'::json
        WHEN 'management' THEN '["dashboards", "approvals", "audit-logs", "budget-actual", "exceptions"]'::json
        ELSE '[]'::json
      END
    )::jsonb
    FROM unnest(modules) AS elem
  )
END;

-- Update the default value
ALTER TABLE public.companies 
ALTER COLUMN modules SET DEFAULT '{}'::jsonb;