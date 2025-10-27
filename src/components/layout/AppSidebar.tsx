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
  GraduationCap,
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

const departments = [
  {
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
  {
    title: "Warehouse",
    icon: Package,
    items: [
      { title: "Item & Bin Master", url: "/warehouse/item-bin-master" },
      { title: "Putaway / Bin Transfer", url: "/warehouse/putaway" },
      { title: "Pick / Pack / Dispatch", url: "/warehouse/pick-pack" },
      { title: "Material Issue / Return", url: "/warehouse/material-issue" },
      { title: "Stock Transfer", url: "/warehouse/stock-transfer" },
      { title: "Cycle Count", url: "/warehouse/cycle-count" },
      { title: "Stock Adjustment", url: "/warehouse/stock-adjustment" },
      { title: "Goods Receipt Note", url: "/warehouse/grn" },
      { title: "Delivery Order", url: "/warehouse/delivery-order" },
      { title: "Inventory Valuation", url: "/warehouse/inventory-valuation" },
      { title: "Asset Management", url: "/warehouse/asset-management" },
    ],
  },
  {
    title: "Sourcing",
    icon: Users,
    items: [
      { title: "Supplier Master", url: "/sourcing/supplier-master" },
      { title: "Supplier Allocation", url: "/sourcing/supplier-allocation" },
      { title: "Supplier Registration", url: "/sourcing/supplier-registration" },
      { title: "Supplier Evaluation", url: "/sourcing/supplier-evaluation" },
      { title: "RFQ / RFP Management", url: "/sourcing/rfq-management" },
      { title: "Quotation Comparison", url: "/sourcing/quotation-comparison" },
      { title: "Supplier Scorecard", url: "/sourcing/supplier-scorecard" },
      { title: "Contract Repository", url: "/sourcing/contracts" },
      { title: "Blacklist / Risk Flags", url: "/sourcing/blacklist" },
    ],
  },
  {
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
  {
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
];

const adminItems = [
  { title: "Company Management", url: "/admin/companies", icon: Building2 },
  { title: "User & Role Management", url: "/admin/users-roles", icon: Users },
  { title: "Module Allocation", url: "/admin/modules", icon: Settings },
  { title: "Warehouse Management", url: "/admin/warehouse-management", icon: Package },
  { title: "Training", url: "/admin/training", icon: GraduationCap },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const isGroupActive = (items: { url: string }[]) =>
    items.some((item) => currentPath.startsWith(item.url));

  return (
    <Sidebar className="border-r">
      <SidebarContent>
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

        {/* Departments */}
        <SidebarGroup>
          <SidebarGroupLabel>Departments</SidebarGroupLabel>
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
                        <span>{dept.title}</span>
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
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

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