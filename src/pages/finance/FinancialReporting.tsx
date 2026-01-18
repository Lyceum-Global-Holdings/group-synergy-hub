import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, FileText, TrendingUp, BarChart2, Wallet, Calculator } from "lucide-react";
import { ProfitLossReport } from "@/components/finance/reports/ProfitLossReport";
import { BalanceSheetReport } from "@/components/finance/reports/BalanceSheetReport";
import { CashFlowReport } from "@/components/finance/reports/CashFlowReport";
import { GeneralLedgerReport } from "@/components/finance/reports/GeneralLedgerReport";
import { TaxSummaryReport } from "@/components/finance/reports/TaxSummaryReport";

export default function FinancialReporting() {
  const [activeTab, setActiveTab] = useState("profit-loss");

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Reports</h1>
          <p className="text-muted-foreground">
            Generate and analyze financial statements and reports
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export All
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profit-loss" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Profit & Loss
          </TabsTrigger>
          <TabsTrigger value="balance-sheet" className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            Balance Sheet
          </TabsTrigger>
          <TabsTrigger value="cash-flow" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Cash Flow
          </TabsTrigger>
          <TabsTrigger value="general-ledger" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            General Ledger
          </TabsTrigger>
          <TabsTrigger value="tax" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Tax Summary
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profit-loss">
          <ProfitLossReport />
        </TabsContent>

        <TabsContent value="balance-sheet">
          <BalanceSheetReport />
        </TabsContent>

        <TabsContent value="cash-flow">
          <CashFlowReport />
        </TabsContent>

        <TabsContent value="general-ledger">
          <GeneralLedgerReport />
        </TabsContent>

        <TabsContent value="tax">
          <TaxSummaryReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
