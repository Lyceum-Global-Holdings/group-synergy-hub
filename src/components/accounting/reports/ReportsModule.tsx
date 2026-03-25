import { TabsContent } from "@/components/ui/tabs";
import { ModuleSubTabs } from "../ModuleSubTabs";
import { QuickActions } from "../QuickActions";
import { ReportErrorBoundary } from "@/components/finance/reports/ReportErrorBoundary";
import { ProfitLossReport } from "@/components/finance/reports/ProfitLossReport";
import { BalanceSheetReport } from "@/components/finance/reports/BalanceSheetReport";
import { CashFlowReport } from "@/components/finance/reports/CashFlowReport";
import { GeneralLedgerReport } from "@/components/finance/reports/GeneralLedgerReport";
import { TaxSummaryReport } from "@/components/finance/reports/TaxSummaryReport";
import { TrialBalanceReport } from "@/components/finance/TrialBalanceReport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Download, Printer, FileText, TrendingUp, BarChart3, PieChart,
  Calculator, Shield, Wrench, Clock, LineChart, CalendarClock
} from "lucide-react";

const subTabs = [
  { id: "profit-loss", label: "Profit & Loss" },
  { id: "balance-sheet", label: "Balance Sheet" },
  { id: "trial-balance", label: "Trial Balance" },
  { id: "cash-flow", label: "Cash Flow" },
  { id: "general-ledger", label: "General Ledger" },
  { id: "tax", label: "Tax Summary" },
  { id: "variance", label: "Variance" },
  { id: "sales-performance", label: "Sales Performance" },
  { id: "segment", label: "Segment" },
  { id: "tax-returns", label: "Tax Returns" },
  { id: "audit", label: "Audit Log" },
  { id: "cash-forecast", label: "Cash Forecast" },
  { id: "report-builder", label: "Report Builder" },
  { id: "scheduled", label: "Scheduled" },
];

interface ReportsModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

export default function ReportsModule({ activeSubTab, onSubTabChange }: ReportsModuleProps) {
  const quickActions = [
    { label: "Generate Report", icon: FileText, onClick: () => {} },
    { label: "Export PDF", icon: Download, onClick: () => {} },
    { label: "Print", icon: Printer, onClick: () => window.print() },
  ];

  return (
    <ModuleSubTabs tabs={subTabs} activeTab={activeSubTab || "profit-loss"} onTabChange={onSubTabChange}>
      <TabsContent value="profit-loss" className="mt-4 space-y-6">
        <QuickActions actions={quickActions} />
        <ReportErrorBoundary>
          <ProfitLossReport />
        </ReportErrorBoundary>
      </TabsContent>

      <TabsContent value="balance-sheet" className="mt-4">
        <ReportErrorBoundary>
          <BalanceSheetReport />
        </ReportErrorBoundary>
      </TabsContent>

      <TabsContent value="trial-balance" className="mt-4">
        <ReportErrorBoundary>
          <TrialBalanceReport />
        </ReportErrorBoundary>
      </TabsContent>

      <TabsContent value="cash-flow" className="mt-4">
        <ReportErrorBoundary>
          <CashFlowReport />
        </ReportErrorBoundary>
      </TabsContent>

      <TabsContent value="general-ledger" className="mt-4">
        <ReportErrorBoundary>
          <GeneralLedgerReport />
        </ReportErrorBoundary>
      </TabsContent>

      <TabsContent value="tax" className="mt-4">
        <ReportErrorBoundary>
          <TaxSummaryReport />
        </ReportErrorBoundary>
      </TabsContent>

      <TabsContent value="variance" className="mt-4">
        <ReportPlaceholder
          icon={TrendingUp}
          title="Variance Analysis Report"
          description="Compare actual financial results against budgets and forecasts. Analyze variances by department, cost center, and GL account to identify areas requiring management attention."
          features={["Budget vs Actual comparison", "Period-over-period analysis", "Drill-down by cost center", "Favorable/unfavorable variance highlighting"]}
        />
      </TabsContent>

      <TabsContent value="sales-performance" className="mt-4">
        <ReportPlaceholder
          icon={BarChart3}
          title="Sales Performance Report"
          description="Track revenue performance across customers, products, and regions. Monitor sales trends, growth rates, and customer contribution analysis."
          features={["Revenue by customer/product", "Growth trend analysis", "Top customer rankings", "Sales pipeline metrics"]}
        />
      </TabsContent>

      <TabsContent value="segment" className="mt-4">
        <ReportPlaceholder
          icon={PieChart}
          title="Segment Reporting"
          description="Generate financial reports segmented by business unit, geographic region, or product line. Supports IFRS 8 Operating Segments disclosure requirements."
          features={["Multi-segment P&L", "Revenue/cost allocation", "Inter-segment eliminations", "IFRS 8 compliance"]}
        />
      </TabsContent>

      <TabsContent value="tax-returns" className="mt-4">
        <ReportPlaceholder
          icon={Calculator}
          title="Tax Returns & Compliance"
          description="Prepare and review tax return data including VAT/GST returns, withholding tax summaries, and statutory filing reports. Export in formats required by tax authorities."
          features={["VAT/GST return preparation", "WHT certificate summaries", "Statutory filing formats", "Tax period management"]}
        />
      </TabsContent>

      <TabsContent value="audit" className="mt-4">
        <ReportPlaceholder
          icon={Shield}
          title="Audit Trail & Log"
          description="View comprehensive audit logs of all financial transactions and system changes. Track who made changes, when, and what was modified for compliance and accountability."
          features={["Transaction change history", "User activity tracking", "Document approval trails", "Data export for auditors"]}
        />
      </TabsContent>

      <TabsContent value="cash-forecast" className="mt-4">
        <ReportPlaceholder
          icon={LineChart}
          title="Cash Flow Forecast"
          description="Project future cash positions based on outstanding receivables, payables, scheduled payments, and recurring transactions. Visualize cash runway and identify potential shortfalls."
          features={["30/60/90 day projections", "Scenario modeling", "AR/AP impact analysis", "Bank balance forecasting"]}
        />
      </TabsContent>

      <TabsContent value="report-builder" className="mt-4">
        <ReportPlaceholder
          icon={Wrench}
          title="Custom Report Builder"
          description="Create custom financial reports by selecting dimensions, measures, and filters. Save report templates for reuse and schedule automated generation."
          features={["Drag-and-drop column selection", "Custom filters and grouping", "Save and share templates", "Multiple export formats"]}
        />
      </TabsContent>

      <TabsContent value="scheduled" className="mt-4">
        <ReportPlaceholder
          icon={CalendarClock}
          title="Scheduled Reports"
          description="Configure automated report generation and distribution. Set up daily, weekly, or monthly schedules to deliver reports to stakeholders via email."
          features={["Frequency configuration", "Email distribution lists", "Multiple format support", "Delivery status tracking"]}
        />
      </TabsContent>
    </ModuleSubTabs>
  );
}

function ReportPlaceholder({ icon: Icon, title, description, features }: {
  icon: any; title: string; description: string; features: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5" /> {title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Icon className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground max-w-lg mt-2">{description}</p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-left max-w-md">
            {features.map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
