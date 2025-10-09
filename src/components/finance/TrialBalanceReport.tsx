import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download, Printer } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useFinancialReports } from "@/hooks/useFinancialReports";
import { useCompany } from "@/contexts/CompanyContext";

export function TrialBalanceReport() {
  const [asOfDate, setAsOfDate] = useState<Date>(new Date());
  const { getTrialBalance } = useFinancialReports();
  const { selectedCompany } = useCompany();

  const { data: trialBalance, isLoading } = getTrialBalance(format(asOfDate, "yyyy-MM-dd"));

  const totalDebit = trialBalance?.reduce((sum, row) => sum + Number(row.debit_balance || 0), 0) || 0;
  const totalCredit = trialBalance?.reduce((sum, row) => sum + Number(row.credit_balance || 0), 0) || 0;

  const handleExport = () => {
    // Placeholder for export functionality
    console.log("Export trial balance", trialBalance);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">As of Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !asOfDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {asOfDate ? format(asOfDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={asOfDate} onSelect={(date) => date && setAsOfDate(date)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </Card>

      {/* Report Content */}
      <Card className="p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold">{selectedCompany?.name || 'Company Name'}</h2>
          <h3 className="text-lg font-semibold">Trial Balance</h3>
          <p className="text-sm text-muted-foreground">As of {format(asOfDate, "MMMM dd, yyyy")}</p>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading trial balance...</div>
        ) : !trialBalance || trialBalance.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No accounts found. Create accounts in the Chart of Accounts to generate a trial balance.
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-semibold">Account Code</th>
                  <th className="text-left p-3 font-semibold">Account Name</th>
                  <th className="text-left p-3 font-semibold">Type</th>
                  <th className="text-right p-3 font-semibold">Debit Balance</th>
                  <th className="text-right p-3 font-semibold">Credit Balance</th>
                </tr>
              </thead>
              <tbody>
                {trialBalance.map((row, index) => (
                  <tr key={index} className="border-t hover:bg-muted/50 transition-colors">
                    <td className="p-3 font-mono">{row.account_code}</td>
                    <td className="p-3">{row.account_name}</td>
                    <td className="p-3 capitalize">{row.account_type}</td>
                    <td className="text-right p-3 font-mono">
                      {row.debit_balance > 0 ? Number(row.debit_balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="text-right p-3 font-mono">
                      {row.credit_balance > 0 ? Number(row.credit_balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-primary bg-muted font-bold">
                  <td colSpan={3} className="p-3">TOTAL</td>
                  <td className="text-right p-3 font-mono">
                    {totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="text-right p-3 font-mono">
                    {totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {trialBalance && trialBalance.length > 0 && (
          <div className="mt-4 flex justify-end">
            <div className={cn("text-sm font-semibold", totalDebit === totalCredit ? "text-green-600" : "text-destructive")}>
              {totalDebit === totalCredit ? "✓ Trial Balance is Balanced" : "⚠ Trial Balance is NOT Balanced"}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
