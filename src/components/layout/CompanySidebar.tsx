import { NavLink, useLocation } from "react-router-dom";
import {
  Building2,
  Calculator,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  Settings,
  ChevronDown,
  FileText
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useCompany } from "@/contexts/CompanyContext";
import { Badge } from "@/components/ui/badge";
import { Company } from "@/types/company";

type ModuleWithCompanies = {
  title: string;
  icon: any;
  items: { title: string; url: string }[];
  companiesUsing?: Company[];
};

const moduleConfig = {
  finance: {
    title: "Finance",
    icon: Calculator,
    items: [
      { title: "General Ledger", url: "/finance/general-ledger" },
      { title: "Accounts Payable", url: "/finance/accounts-payable" },
      { title: "Accounts Receivable", url: "/finance/accounts-receivable" },
      { title: "Cash & Bank", url: "/finance/cash-bank" },
      { title: "Fixed Assets", url: "/finance/fixed-assets" },
      { title: "Budgeting", url: "/finance/budgeting" },
      { title: "Cost Centers", url: "/finance/cost-centers" },
      { title: "Payments", url: "/finance/payments" },
      { title: "Bank Reconciliation", url: "/finance/bank-reconciliation" },
      { title: "Financial Reporting", url: "/finance/reporting" },
    ],
  },
  warehouse: {
    title: "Warehouse",
    icon: Package,
    items: [
      { title: "Item & Bin Master", url: "/warehouse/item-bin-master" },
      { title: "Goods Receipt Note", url: "/warehouse/grn" },
      { title: "Putaway / Bin Transfer", url: "/warehouse/putaway" },
      { title: "Pick / Pack / Dispatch", url: "/warehouse/pick-pack" },
      { title: "Material Issue / Return", url: "/warehouse/material-issue" },
      { title: "Stock Transfer", url: "/warehouse/stock-transfer" },
      { title: "Cycle Count", url: "/warehouse/cycle-count" },
      { title: "Stock Adjustment", url: "/warehouse/stock-adjustment" },
      { title: "Delivery Order", url: "/warehouse/delivery-order" },
      { title: "Inventory Valuation", url: "/warehouse/inventory-valuation" },
      { title: "Asset Management", url: "/warehouse/asset-management" },
    ],
  },
  sourcing: {
    title: "Sourcing",
    icon: Users,
    items: [
      { title: "Supplier Master", url: "/sourcing/supplier-master" },
      { title: "Supplier Registration", url: "/sourcing/supplier-registration" },
      { title: "Supplier Evaluation", url: "/sourcing/supplier-evaluation" },
      { title: "RFQ / RFP Management", url: "/sourcing/rfq-management" },
      { title: "Quotation Comparison", url: "/sourcing/quotation-comparison" },
      { title: "Vendor Scorecards", url: "/sourcing/vendor-scorecards" },
      { title: "Contract Repository", url: "/sourcing/contracts" },
      { title: "Blacklist / Risk Flags", url: "/sourcing/blacklist" },
    ],
  },
  procurement: {
    title: "Procurement",
    icon: ShoppingCart,
    items: [
      { title: "Purchase Requisition", url: "/procurement/purchase-requisition" },
      { title: "Purchase Order", url: "/procurement/purchase-order" },
      { title: "Blanket/Contract PO", url: "/procurement/blanket-po" },
      { title: "PO Amendment", url: "/procurement/po-amendment" },
      { title: "3-way Match Review", url: "/procurement/three-way-match" },
      { title: "Category Catalogs", url: "/procurement/catalogs" },
      { title: "Price Lists", url: "/procurement/price-lists" },
    ],
  },
  bom: {
    title: "Bill of Materials",
    icon: FileText,
    items: [
      { title: "BOM Management", url: "/procurement/bill-of-materials" },
    ],
  },
  management: {
    title: "Management",
    icon: BarChart3,
    items: [
      { title: "Dashboards & KPIs", url: "/management/dashboards" },
      { title: "Approval Console", url: "/management/approvals" },
      { title: "Audit Logs", url: "/management/audit-logs" },
      { title: "Budget vs Actual", url: "/management/budget-actual" },
      { title: "Exception Overrides", url: "/management/exceptions" },
    ],
  },
};

const adminItems = [
  { title: "Company Management", url: "/admin/companies", icon: Building2 },
  { title: "User & Role Management", url: "/admin/users-roles", icon: Users },
  { title: "Module Allocation", url: "/admin/modules", icon: Settings },
];

export function CompanySidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { selectedCompany, companies, isViewingAllCompanies } = useCompany();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const isGroupActive = (items: { url: string }[]) =>
    items.some((item) => currentPath.startsWith(item.url));

  // Get all unique modules when viewing all companies
  const getAllUniqueModules = () => {
    const allModules = new Set<string>();
    companies.forEach(company => {
      company.modules?.forEach(module => allModules.add(module));
    });
    return Array.from(allModules);
  };

  // Get companies that use a specific module
  const getCompaniesUsingModule = (moduleKey: string) => {
    return companies.filter(company => 
      company.modules?.includes(moduleKey)
    );
  };

  // Filter modules based on selected company or show all when viewing all companies
  const availableModules = isViewingAllCompanies 
    ? getAllUniqueModules()
    : (selectedCompany?.modules || []);
    
  const departments: ModuleWithCompanies[] = availableModules
    .map(moduleKey => {
      const module = moduleConfig[moduleKey as keyof typeof moduleConfig];
      if (!module) return null;
      
      // Add companies using this module when viewing all companies
      if (isViewingAllCompanies) {
        return {
          ...module,
          companiesUsing: getCompaniesUsingModule(moduleKey)
        };
      }
      
      return module;
    })
    .filter(Boolean) as ModuleWithCompanies[];

  // Debug logging
  console.log('CompanySidebar Debug:', {
    selectedCompany: selectedCompany?.name,
    isViewingAllCompanies,
    companyModules: selectedCompany?.modules,
    availableModules,
    departments: departments.map(d => d.title),
    moduleConfigKeys: Object.keys(moduleConfig)
  });

  return (
    <Sidebar className="border-r">
      <SidebarContent>
        {/* Company Header */}
        <SidebarGroup className="pb-2">
          <div className="px-3 py-2 bg-muted/50 rounded-lg mx-2 mb-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {isViewingAllCompanies ? "All Companies" : selectedCompany?.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {isViewingAllCompanies 
                    ? `${companies.length} companies` 
                    : selectedCompany?.code
                  }
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">
                {availableModules.length}
              </Badge>
            </div>
          </div>
        </SidebarGroup>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={currentPath === "/"}>
                  <NavLink to="/" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <span>Dashboard</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Company Modules */}
        {departments.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              {isViewingAllCompanies ? "All Available Modules" : `${selectedCompany?.name} Modules`}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {departments.map((dept) => (
                  <Collapsible
                    key={dept.title}
                    defaultOpen={isGroupActive(dept.items)}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          isActive={isGroupActive(dept.items)}
                          className="w-full"
                        >
                          <dept.icon className="h-4 w-4" />
                          <div className="flex-1 flex items-center justify-between">
                            <span>{dept.title}</span>
                            {isViewingAllCompanies && dept.companiesUsing && (
                              <Badge variant="outline" className="text-xs ml-2">
                                {dept.companiesUsing.length}
                              </Badge>
                            )}
                          </div>
                          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {dept.items.map((item) => (
                            <SidebarMenuSubItem key={item.url}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isActive(item.url)}
                              >
                                <NavLink to={item.url}>{item.title}</NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                          {isViewingAllCompanies && dept.companiesUsing && dept.companiesUsing.length > 0 && (
                            <SidebarMenuSubItem>
                              <div className="px-3 py-1">
                                <div className="text-xs text-muted-foreground mb-1">Used by:</div>
                                <div className="flex flex-wrap gap-1">
                                  {dept.companiesUsing.map((company) => (
                                    <Badge key={company.id} variant="secondary" className="text-xs">
                                      {company.code}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </SidebarMenuSubItem>
                          )}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Administration */}
        <SidebarGroup>
          <SidebarGroupLabel>Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}