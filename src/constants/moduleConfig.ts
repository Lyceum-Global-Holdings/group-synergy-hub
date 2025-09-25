import {
  Calculator,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  Building2,
  ClipboardList
} from "lucide-react";

export interface ModuleConfig {
  key: string;
  name: string;
  description: string;
  icon: any;
  subModules: {
    key: string;
    name: string;
    description: string;
    url: string;
  }[];
}

export const moduleConfig: Record<string, ModuleConfig> = {
  finance: {
    key: 'finance',
    name: 'Finance',
    description: 'Financial management and reporting',
    icon: Calculator,
    subModules: [
      { key: 'general-ledger', name: 'General Ledger', description: 'Chart of accounts and journal entries', url: '/finance/general-ledger' },
      { key: 'accounts-payable', name: 'Accounts Payable', description: 'Supplier invoices and payments', url: '/finance/accounts-payable' },
      { key: 'accounts-receivable', name: 'Accounts Receivable', description: 'Customer invoices and receipts', url: '/finance/accounts-receivable' },
      { key: 'cash-bank', name: 'Cash & Bank', description: 'Bank accounts and cash management', url: '/finance/cash-bank' },
      { key: 'fixed-assets', name: 'Fixed Assets', description: 'Asset register and depreciation', url: '/finance/fixed-assets' },
      { key: 'budgeting', name: 'Budgeting', description: 'Budget planning and analysis', url: '/finance/budgeting' },
      { key: 'cost-centers', name: 'Cost Centers', description: 'Cost allocation and tracking', url: '/finance/cost-centers' },
      { key: 'payments', name: 'Payments', description: 'Payment processing and tracking', url: '/finance/payments' },
      { key: 'bank-reconciliation', name: 'Bank Reconciliation', description: 'Reconcile bank statements', url: '/finance/bank-reconciliation' },
      { key: 'financial-reporting', name: 'Financial Reporting', description: 'P&L, balance sheet, and reports', url: '/finance/reporting' }
    ]
  },
  warehouse: {
    key: 'warehouse',
    name: 'Warehouse',
    description: 'Inventory and asset management',
    icon: Package,
    subModules: [
      { key: 'item-bin-master', name: 'Item & Bin Master', description: 'Item and location management', url: '/warehouse/item-bin-master' },
      { key: 'grn', name: 'Goods Receipt Note', description: 'Receive goods into inventory', url: '/warehouse/grn' },
      { key: 'putaway', name: 'Putaway / Bin Transfer', description: 'Move items to storage locations', url: '/warehouse/putaway' },
      { key: 'pick-pack', name: 'Pick / Pack / Dispatch', description: 'Order fulfillment process', url: '/warehouse/pick-pack' },
      { key: 'material-issue', name: 'Material Issue / Return', description: 'Issue and return materials', url: '/warehouse/material-issue' },
      { key: 'stock-transfer', name: 'Stock Transfer', description: 'Transfer between locations', url: '/warehouse/stock-transfer' },
      { key: 'cycle-count', name: 'Cycle Count', description: 'Regular inventory counting', url: '/warehouse/cycle-count' },
      { key: 'stock-adjustment', name: 'Stock Adjustment', description: 'Adjust inventory levels', url: '/warehouse/stock-adjustment' },
      { key: 'delivery-order', name: 'Delivery Order', description: 'Outbound delivery management', url: '/warehouse/delivery-order' },
      { key: 'inventory-valuation', name: 'Inventory Valuation', description: 'Stock value calculations', url: '/warehouse/inventory-valuation' },
      { key: 'asset-management', name: 'Asset Management', description: 'Track and manage assets', url: '/warehouse/asset-management' },
      { key: 'finished-goods', name: 'Finished Goods', description: 'Finished goods inventory management', url: '/warehouse/finished-goods' }
    ]
  },
  sourcing: {
    key: 'sourcing',
    name: 'Sourcing',
    description: 'Supplier and vendor management',
    icon: Users,
    subModules: [
      { key: 'supplier-master', name: 'Supplier Master', description: 'Supplier database and profiles', url: '/sourcing/supplier-master' },
      { key: 'supplier-registration', name: 'Supplier Registration', description: 'New supplier onboarding', url: '/sourcing/supplier-registration' },
      { key: 'supplier-evaluation', name: 'Supplier Evaluation', description: 'Performance assessment', url: '/sourcing/supplier-evaluation' },
      { key: 'rfq-management', name: 'RFQ / RFP Management', description: 'Request for quotes process', url: '/sourcing/rfq-management' },
      { key: 'quotation-comparison', name: 'Quotation Comparison', description: 'Compare supplier quotes', url: '/sourcing/quotation-comparison' },
      { key: 'vendor-scorecards', name: 'Vendor Scorecards', description: 'Supplier performance metrics', url: '/sourcing/vendor-scorecards' },
      { key: 'contracts', name: 'Contract Repository', description: 'Contract management', url: '/sourcing/contracts' },
      { key: 'blacklist', name: 'Blacklist / Risk Flags', description: 'Manage supplier risks', url: '/sourcing/blacklist' }
    ]
  },
  procurement: {
    key: 'procurement',
    name: 'Procurement',
    description: 'Purchase orders and requisitions',
    icon: ShoppingCart,
    subModules: [
      { key: 'purchase-requisition', name: 'Purchase Requisition', description: 'Internal purchase requests', url: '/procurement/purchase-requisition' },
      { key: 'purchase-order', name: 'Purchase Order', description: 'Supplier purchase orders', url: '/procurement/purchase-order' },
      { key: 'material-demand', name: 'Material Demand Planning', description: 'MRP and material requirement planning', url: '/procurement/material-demand' },
      { key: 'blanket-po', name: 'Blanket/Contract PO', description: 'Long-term purchase agreements', url: '/procurement/blanket-po' },
      { key: 'po-amendment', name: 'PO Amendment', description: 'Modify existing orders', url: '/procurement/po-amendment' },
      { key: 'three-way-match', name: '3-way Match Review', description: 'PO, receipt, and invoice matching', url: '/procurement/three-way-match' },
      { key: 'catalogs', name: 'Category Catalogs', description: 'Product and service catalogs', url: '/procurement/catalogs' },
      { key: 'price-lists', name: 'Price Lists', description: 'Supplier pricing management', url: '/procurement/price-lists' }
    ]
  },
  'tuh-modules': {
    key: 'tuh-modules',
    name: 'TUH Modules',
    description: 'The Uniform Hub specific modules',
    icon: Building2,
    subModules: [
      { key: 'customer-po', name: 'Customer PO', description: 'Customer purchase order management', url: '/tuh-modules/customer-po' },
      { key: 'bom-management', name: 'BOM Management', description: 'Product structure and components', url: '/tuh-modules/bill-of-materials' }
    ]
  },
  management: {
    key: 'management',
    name: 'Management',
    description: 'User and role management',
    icon: BarChart3,
    subModules: [
      { key: 'dashboards', name: 'Dashboards & KPIs', description: 'Executive dashboards', url: '/management/dashboards' },
      { key: 'approvals', name: 'Approval Console', description: 'Workflow approvals', url: '/management/approvals' },
      { key: 'audit-logs', name: 'Audit Logs', description: 'System activity tracking', url: '/management/audit-logs' },
      { key: 'budget-actual', name: 'Budget vs Actual', description: 'Budget variance analysis', url: '/management/budget-actual' },
      { key: 'exceptions', name: 'Exception Overrides', description: 'Handle system exceptions', url: '/management/exceptions' }
    ]
  }
};

export function normalizeCompanyModules(modules: Record<string, string[]> | string[] | null | undefined): Record<string, string[]> {
  try {
    if (!modules) return {};
    
    // If it's already the new format, return as-is
    if (typeof modules === 'object' && !Array.isArray(modules)) {
      return modules;
    }
    
    // Convert old format (string array) to new format
    if (Array.isArray(modules)) {
      const normalized: Record<string, string[]> = {};
      modules.forEach(moduleKey => {
        const config = moduleConfig[moduleKey];
        if (config) {
          normalized[moduleKey] = config.subModules.map(sub => sub.key);
        }
      });
      return normalized;
    }
    
    return {};
  } catch (error) {
    console.warn('Error normalizing company modules:', error, modules);
    return {};
  }
}

export function getAllEnabledSubModules(modules: Record<string, string[]> | string[] | null | undefined): string[] {
  const normalized = normalizeCompanyModules(modules);
  return Object.values(normalized).flat();
}

export function isModuleEnabled(modules: Record<string, string[]> | string[] | null | undefined, moduleKey: string): boolean {
  const normalized = normalizeCompanyModules(modules);
  return Object.hasOwnProperty.call(normalized, moduleKey);
}

export function isSubModuleEnabled(modules: Record<string, string[]> | string[] | null | undefined, moduleKey: string, subModuleKey: string): boolean {
  const normalized = normalizeCompanyModules(modules);
  return normalized[moduleKey]?.includes(subModuleKey) || false;
}

export function getModuleSelectionState(modules: Record<string, string[]> | string[] | null | undefined, moduleKey: string): 'none' | 'partial' | 'all' {
  const normalized = normalizeCompanyModules(modules);
  const config = moduleConfig[moduleKey];
  if (!config) return 'none';
  
  const enabledSubModules = normalized[moduleKey] || [];
  const totalSubModules = config.subModules.length;
  
  if (enabledSubModules.length === 0) return 'none';
  if (enabledSubModules.length === totalSubModules) return 'all';
  return 'partial';
}