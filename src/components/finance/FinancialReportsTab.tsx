import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, TrendingUp, BarChart3, DollarSign } from "lucide-react";

export function FinancialReportsTab() {
  const reports = [
    {
      title: "Trial Balance",
      description: "View account balances as of a specific date",
      icon: BarChart3,
      color: "text-blue-600",
    },
    {
      title: "Profit & Loss Statement",
      description: "Revenue and expenses for a period",
      icon: TrendingUp,
      color: "text-green-600",
    },
    {
      title: "Balance Sheet",
      description: "Assets, liabilities, and equity snapshot",
      icon: DollarSign,
      color: "text-purple-600",
    },
    {
      title: "General Ledger Report",
      description: "Detailed transaction list by account",
      icon: FileText,
      color: "text-orange-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Financial Reports</h2>
        <p className="text-muted-foreground mt-1">
          Generate and view comprehensive financial reports
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((report) => (
          <Card key={report.title} className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-lg bg-muted ${report.color}`}>
                <report.icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{report.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{report.description}</p>
                <Button variant="outline" size="sm" className="mt-4">
                  Generate Report
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
