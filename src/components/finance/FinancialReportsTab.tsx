import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrialBalanceReport } from "./TrialBalanceReport";
import { ProfitLossReport } from "./reports/ProfitLossReport";
import { BalanceSheetReport } from "./reports/BalanceSheetReport";
import { CashFlowReport } from "./reports/CashFlowReport";
import { AgingReport } from "./reports/AgingReport";
import { ReportErrorBoundary } from "./reports/ReportErrorBoundary";
import { FileText, BarChart3, Scale, TrendingUp, Clock } from "lucide-react";

export function FinancialReportsTab() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="trial-balance" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="trial-balance" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Trial Balance
          </TabsTrigger>
          <TabsTrigger value="pl" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Profit & Loss
          </TabsTrigger>
          <TabsTrigger value="balance-sheet" className="flex items-center gap-2">
            <Scale className="h-4 w-4" />
            Balance Sheet
          </TabsTrigger>
          <TabsTrigger value="cash-flow" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Cash Flow
          </TabsTrigger>
          <TabsTrigger value="aging" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Aging Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trial-balance">
          <ReportErrorBoundary>
            <TrialBalanceReport />
          </ReportErrorBoundary>
        </TabsContent>

        <TabsContent value="pl">
          <ReportErrorBoundary>
            <ProfitLossReport />
          </ReportErrorBoundary>
        </TabsContent>

        <TabsContent value="balance-sheet">
          <ReportErrorBoundary>
            <BalanceSheetReport />
          </ReportErrorBoundary>
        </TabsContent>

        <TabsContent value="cash-flow">
          <ReportErrorBoundary>
            <CashFlowReport />
          </ReportErrorBoundary>
        </TabsContent>

        <TabsContent value="aging">
          <ReportErrorBoundary>
            <AgingReport />
          </ReportErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}
