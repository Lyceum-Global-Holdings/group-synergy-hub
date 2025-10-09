import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrialBalanceReport } from "./TrialBalanceReport";

export function FinancialReportsTab() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="trial-balance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
          <TabsTrigger value="pl">Profit & Loss</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
        </TabsList>

        <TabsContent value="trial-balance">
          <TrialBalanceReport />
        </TabsContent>

        <TabsContent value="pl">
          <div className="text-center p-12 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">Profit & Loss Statement - Coming Soon</p>
          </div>
        </TabsContent>

        <TabsContent value="balance-sheet">
          <div className="text-center p-12 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">Balance Sheet - Coming Soon</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
