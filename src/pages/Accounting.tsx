import { Suspense, lazy } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BookOpen,
  Users,
  FileText,
  Package,
  ShoppingCart,
  Building2,
  Box,
  BarChart3,
  Settings,
  Receipt,
  Store,
  ClipboardCheck,
  Zap,
  Loader2,
} from "lucide-react";

// Lazy-load every finance sub-module so opening Finance only fetches the
// active tab's chunk + data, not all 13 modules at once.
const GLModule = lazy(() => import("@/components/accounting/gl/GLModule"));
const ARModule = lazy(() => import("@/components/accounting/ar/ARModule"));
const APModule = lazy(() => import("@/components/accounting/ap/APModule"));
const SellingModule = lazy(() => import("@/components/accounting/selling/SellingModule"));
const InventoryModule = lazy(() => import("@/components/accounting/inventory/InventoryModule"));
const ProcurementModule = lazy(() => import("@/components/accounting/procurement/ProcurementModule"));
const BankingModule = lazy(() => import("@/components/accounting/banking/BankingModule"));
const FixedAssetsModule = lazy(() => import("@/components/accounting/assets/FixedAssetsModule"));
const ReportsModule = lazy(() => import("@/components/accounting/reports/ReportsModule"));
const SettingsModule = lazy(() => import("@/components/accounting/settings/SettingsModule"));
const ExpensesModule = lazy(() => import("@/components/accounting/expenses/ExpensesModule"));
const QualityModule = lazy(() => import("@/components/accounting/quality/QualityModule"));
const AutomationModule = lazy(() => import("@/components/accounting/automation/AutomationModule"));

const primaryTabs = [
  { id: "gl", label: "General Ledger", icon: BookOpen, Component: GLModule },
  { id: "ar", label: "AR", icon: Users, Component: ARModule },
  { id: "ap", label: "AP", icon: FileText, Component: APModule },
  { id: "selling", label: "Selling", icon: Store, Component: SellingModule },
  { id: "expenses", label: "Expenses", icon: Receipt, Component: ExpensesModule },
  { id: "inventory", label: "Inventory", icon: Package, Component: InventoryModule },
  { id: "procurement", label: "Procurement", icon: ShoppingCart, Component: ProcurementModule },
  { id: "banking", label: "Banking", icon: Building2, Component: BankingModule },
  { id: "assets", label: "Fixed Assets", icon: Box, Component: FixedAssetsModule },
  { id: "quality", label: "Quality", icon: ClipboardCheck, Component: QualityModule },
  { id: "automation", label: "Automation", icon: Zap, Component: AutomationModule },
  { id: "reports", label: "Reports", icon: BarChart3, Component: ReportsModule },
  { id: "settings", label: "Settings", icon: Settings, Component: SettingsModule },
] as const;

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" />
      Loading…
    </div>
  );
}

export default function Accounting() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "gl";
  const activeSubTab = searchParams.get("sub") || "";

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  const handleSubTabChange = (sub: string) => {
    setSearchParams({ tab: activeTab, sub });
  };

  const active = primaryTabs.find((t) => t.id === activeTab) ?? primaryTabs[0];
  const ActiveComponent = active.Component;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Finance & Accounting</h1>
        <p className="text-muted-foreground">Enterprise Accounting Module</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="h-auto p-1 bg-muted/50 flex flex-wrap gap-1 justify-start w-full">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Render only the active tab to avoid mounting all 13 finance modules at once */}
        <TabsContent value={activeTab} className="mt-6" forceMount>
          <Suspense fallback={<TabFallback />}>
            <ActiveComponent
              activeSubTab={activeSubTab}
              onSubTabChange={handleSubTabChange}
            />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
