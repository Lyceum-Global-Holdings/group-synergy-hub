import { useState } from "react";
import { Settings, Building2, Package, Calculator, Users, ShoppingCart, BarChart3, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const departments = [
  {
    id: "finance",
    name: "Finance Department",
    icon: Calculator,
    color: "text-blue-600",
    modules: [
      { id: "gl", name: "General Ledger", description: "Chart of accounts and journal entries" },
      { id: "ap", name: "Accounts Payable", description: "Vendor invoice processing and payments" },
      { id: "ar", name: "Accounts Receivable", description: "Customer invoicing and collections" },
      { id: "cash", name: "Cash & Bank", description: "Cash flow and bank account management" },
      { id: "fa", name: "Fixed Assets", description: "Asset tracking and depreciation" },
      { id: "budget", name: "Budgeting", description: "Budget planning and control" },
      { id: "cost", name: "Cost Centers", description: "Cost allocation and tracking" },
      { id: "payments", name: "Payments", description: "Payment processing and approval" },
      { id: "recon", name: "Bank Reconciliation", description: "Automated bank statement reconciliation" },
      { id: "reports", name: "Financial Reporting", description: "Financial statements and analytics" }
    ]
  },
  {
    id: "warehouse",
    name: "Warehouse/Operations",
    icon: Package,
    color: "text-green-600",
    modules: [
      { id: "item-master", name: "Item & Bin Master", description: "Product catalog and location management" },
      { id: "grn", name: "Goods Receipt Note", description: "Incoming goods processing" },
      { id: "putaway", name: "Putaway / Bin Transfer", description: "Inventory placement and movement" },
      { id: "pick-pack", name: "Pick / Pack / Dispatch", description: "Order fulfillment process" },
      { id: "material-issue", name: "Material Issue / Return", description: "Inventory consumption tracking" },
      { id: "stock-transfer", name: "Stock Transfer", description: "Inter-location inventory movement" },
      { id: "cycle-count", name: "Cycle Count", description: "Regular inventory verification" },
      { id: "adjustment", name: "Stock Adjustment", description: "Inventory corrections and adjustments" },
      { id: "delivery", name: "Delivery Order", description: "Outbound shipment management" },
      { id: "valuation", name: "Inventory Valuation", description: "Stock value reporting" }
    ]
  },
  {
    id: "sourcing",
    name: "Sourcing Department",
    icon: Users,
    color: "text-purple-600",
    modules: [
      { id: "supplier-master", name: "Supplier Master", description: "Vendor database management" },
      { id: "registration", name: "Supplier Registration", description: "New supplier onboarding" },
      { id: "evaluation", name: "Supplier Evaluation", description: "Performance assessment and scoring" },
      { id: "rfq", name: "RFQ / RFP Management", description: "Quote and proposal management" },
      { id: "comparison", name: "Quotation Comparison", description: "Bid analysis and L1 review" },
      { id: "scorecards", name: "Vendor Scorecards", description: "Performance metrics and KPIs" },
      { id: "contracts", name: "Contract Repository", description: "Agreement management and tracking" },
      { id: "blacklist", name: "Blacklist / Risk Flags", description: "Risk management and compliance" }
    ]
  },
  {
    id: "procurement",
    name: "Procurement Department",
    icon: ShoppingCart,
    color: "text-orange-600",
    modules: [
      { id: "pr", name: "Purchase Requisition", description: "Internal purchase requests" },
      { id: "po", name: "Purchase Order", description: "Supplier order management" },
      { id: "blanket-po", name: "Blanket/Contract PO", description: "Long-term purchase agreements" },
      { id: "amendment", name: "PO Amendment / Close", description: "Order modifications and closure" },
      { id: "three-way", name: "3-way Match Review", description: "PO-GRN-Invoice verification" },
      { id: "catalogs", name: "Category Catalogs", description: "Product categorization and catalogs" },
      { id: "price-lists", name: "Price Lists", description: "Supplier pricing management" }
    ]
  },
  {
    id: "management",
    name: "Management/Operations",
    icon: BarChart3,
    color: "text-indigo-600",
    modules: [
      { id: "dashboards", name: "Dashboards & KPIs", description: "Executive reporting and analytics" },
      { id: "approvals", name: "Approval Console", description: "Workflow approval management" },
      { id: "audit", name: "Audit Logs", description: "System activity tracking" },
      { id: "budget-actual", name: "Budget vs Actual", description: "Budget performance analysis" },
      { id: "exceptions", name: "Exception Overrides", description: "Authority-based overrides" }
    ]
  }
];

const companies = [
  { id: "1", name: "Acme Corporation", code: "ACME" },
  { id: "2", name: "Global Industries", code: "GLOB" },
  { id: "3", name: "Tech Solutions Ltd", code: "TECH" },
  { id: "4", name: "Manufacturing Co", code: "MFG" }
];

export default function ModuleAllocation() {
  const [selectedCompany, setSelectedCompany] = useState("1");
  const [moduleStates, setModuleStates] = useState<Record<string, boolean>>({});

  const handleModuleToggle = (moduleId: string) => {
    setModuleStates(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  const currentCompany = companies.find(c => c.id === selectedCompany);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Module Allocation</h1>
          <p className="text-muted-foreground">Configure module access for each company</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button>
            <Check className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Company Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {currentCompany?.name} - Module Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {departments.map((dept) => {
              const enabledModules = dept.modules.filter(module => 
                moduleStates[`${selectedCompany}-${dept.id}-${module.id}`]
              ).length;
              
              return (
                <div key={dept.id} className="text-center p-4 bg-muted/50 rounded-lg">
                  <dept.icon className={`h-8 w-8 mx-auto mb-2 ${dept.color}`} />
                  <h3 className="font-medium text-sm">{dept.name}</h3>
                  <div className="text-xs text-muted-foreground mt-1">
                    {enabledModules}/{dept.modules.length} modules
                  </div>
                  <div className="w-full bg-background rounded-full h-2 mt-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all" 
                      style={{ width: `${(enabledModules / dept.modules.length) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Module Configuration */}
      <div className="grid gap-6">
        {departments.map((department) => (
          <Card key={department.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <department.icon className={`h-5 w-5 ${department.color}`} />
                {department.name}
                <Badge variant="outline" className="ml-auto">
                  {department.modules.filter(module => 
                    moduleStates[`${selectedCompany}-${department.id}-${module.id}`]
                  ).length}/{department.modules.length} enabled
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {department.modules.map((module) => {
                  const moduleKey = `${selectedCompany}-${department.id}-${module.id}`;
                  const isEnabled = moduleStates[moduleKey] || false;
                  
                  return (
                    <div key={module.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <div className="font-medium">{module.name}</div>
                        <div className="text-sm text-muted-foreground">{module.description}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={isEnabled ? "default" : "secondary"}>
                          {isEnabled ? "Enabled" : "Disabled"}
                        </Badge>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => handleModuleToggle(moduleKey)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}