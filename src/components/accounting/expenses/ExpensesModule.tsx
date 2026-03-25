import { TabsContent } from "@/components/ui/tabs";
import { ModuleSubTabs } from "../ModuleSubTabs";
import { KPICard } from "../KPICard";
import { PlaceholderContent } from "../PlaceholderContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Receipt, Wallet, CreditCard, TrendingUp } from "lucide-react";

interface ExpensesModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

const subTabs = [
  { id: "dashboard", label: "Dashboard" },
  { id: "all", label: "All Expenses" },
  { id: "bills", label: "Company Bills" },
  { id: "petty", label: "Petty Cash" },
  { id: "advances", label: "Staff Advances" },
];

export default function ExpensesModule({ activeSubTab, onSubTabChange }: ExpensesModuleProps) {
  const effectiveTab = activeSubTab || "dashboard";

  return (
    <ModuleSubTabs tabs={subTabs} activeTab={effectiveTab} onTabChange={onSubTabChange}>
      <TabsContent value="dashboard"><ExpensesDashboard /></TabsContent>
      <TabsContent value="all">
        <PlaceholderContent title="All Expenses" description="Consolidated view of all company expenses across categories. Requires expense tracking tables. Coming soon." />
      </TabsContent>
      <TabsContent value="bills">
        <PlaceholderContent title="Company Bills" description="Manage recurring company bills and utility payments. Can be linked to Accounts Payable invoices. Coming soon." />
      </TabsContent>
      <TabsContent value="petty">
        <PlaceholderContent title="Petty Cash" description="Manage petty cash funds, vouchers, and replenishments. Requires petty_cash_funds and petty_cash_vouchers tables. Coming soon." />
      </TabsContent>
      <TabsContent value="advances">
        <PlaceholderContent title="Staff Advances" description="Track employee advance requests, approvals, and settlements. Requires staff_advances table. Coming soon." />
      </TabsContent>
    </ModuleSubTabs>
  );
}

function ExpensesDashboard() {
  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard label="Total Expenses (MTD)" value="—" icon={DollarSign} />
        <KPICard label="Pending Approvals" value="—" icon={Receipt} variant="warning" />
        <KPICard label="Petty Cash Balance" value="—" icon={Wallet} variant="primary" />
        <KPICard label="Outstanding Advances" value="—" icon={CreditCard} variant="destructive" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expenses by Category</CardTitle>
            <CardDescription>Monthly breakdown by expense type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              <div className="text-center">
                <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Chart will appear when expense data is available</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Cost Centers</CardTitle>
            <CardDescription>Highest spending departments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              <div className="text-center">
                <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Chart will appear when expense data is available</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
