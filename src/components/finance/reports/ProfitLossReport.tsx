import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CalendarIcon, Download, Printer, Loader2 } from "lucide-react";
import { format, startOfYear, endOfYear, subYears } from "date-fns";
import { cn, formatCurrency } from "@/lib/utils";
import { useFinancialReports, ProfitLossRow } from "@/hooks/useFinancialReports";
import { useCompany } from "@/contexts/CompanyContext";
import { ReportErrorMessage } from "./ReportErrorMessage";

export function ProfitLossReport() {
  const { selectedCompany } = useCompany();
  const { getProfitLossReport } = useFinancialReports();
  
  const [startDate, setStartDate] = useState<Date>(startOfYear(new Date()));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [showComparison, setShowComparison] = useState(false);
  
  // Comparison period (previous year same range)
  const comparisonStart = subYears(startDate, 1);
  const comparisonEnd = subYears(endDate, 1);
  
  const { data: reportData, isLoading, error, refetch } = getProfitLossReport(
    format(startDate, "yyyy-MM-dd"),
    format(endDate, "yyyy-MM-dd"),
    showComparison ? format(comparisonStart, "yyyy-MM-dd") : null,
    showComparison ? format(comparisonEnd, "yyyy-MM-dd") : null
  );

  // Group data by account type
  const revenueAccounts = reportData?.filter(r => r.account_type === 'Revenue' || r.account_type === 'Income') || [];
  const cogsAccounts = reportData?.filter(r => r.account_type === 'Cost of Goods Sold') || [];
  const expenseAccounts = reportData?.filter(r => r.account_type === 'Expense') || [];

  const totalRevenue = revenueAccounts.reduce((sum, r) => sum + Number(r.current_period_amount || 0), 0);
  const totalCogs = cogsAccounts.reduce((sum, r) => sum + Number(r.current_period_amount || 0), 0);
  const grossProfit = totalRevenue - totalCogs;
  const totalExpenses = expenseAccounts.reduce((sum, r) => sum + Number(r.current_period_amount || 0), 0);
  const netIncome = grossProfit - totalExpenses;

  // Comparison totals
  const compTotalRevenue = revenueAccounts.reduce((sum, r) => sum + Number(r.comparison_period_amount || 0), 0);
  const compTotalCogs = cogsAccounts.reduce((sum, r) => sum + Number(r.comparison_period_amount || 0), 0);
  const compGrossProfit = compTotalRevenue - compTotalCogs;
  const compTotalExpenses = expenseAccounts.reduce((sum, r) => sum + Number(r.comparison_period_amount || 0), 0);
  const compNetIncome = compGrossProfit - compTotalExpenses;

  const handleExport = () => {
    console.log("Export P&L", reportData);
  };

  const handlePrint = () => {
    window.print();
  };

  const renderAccountRows = (accounts: ProfitLossRow[], indent = false) => {
    return accounts.map((account) => (
      <TableRow key={account.account_id}>
        <TableCell className={cn(indent && "pl-8")}>{account.account_name}</TableCell>
        <TableCell className="text-right font-mono">
          {formatCurrency(Number(account.current_period_amount || 0))}
        </TableCell>
        {showComparison && (
          <>
            <TableCell className="text-right font-mono">
              {formatCurrency(Number(account.comparison_period_amount || 0))}
            </TableCell>
            <TableCell className={cn(
              "text-right font-mono",
              Number(account.variance_amount) > 0 ? "text-green-600" : Number(account.variance_amount) < 0 ? "text-destructive" : ""
            )}>
              {formatCurrency(Number(account.variance_amount || 0))}
            </TableCell>
          </>
        )}
      </TableRow>
    ));
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">From Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={(date) => date && setStartDate(date)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">To Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(endDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={(date) => date && setEndDate(date)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Switch id="comparison" checked={showComparison} onCheckedChange={setShowComparison} />
              <Label htmlFor="comparison">Show Prior Year Comparison</Label>
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
      <Card>
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl">{selectedCompany?.name || 'Company Name'}</CardTitle>
          <p className="text-lg font-semibold">Profit & Loss Statement</p>
          <p className="text-sm text-muted-foreground">
            For the period {format(startDate, "MMMM d, yyyy")} to {format(endDate, "MMMM d, yyyy")}
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <ReportErrorMessage error={error} onRetry={() => refetch()} />
          ) : !reportData || reportData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found for this period. Post journal entries to generate the P&L report.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Current Period</TableHead>
                  {showComparison && (
                    <>
                      <TableHead className="text-right">Prior Period</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Revenue Section */}
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={showComparison ? 4 : 2} className="font-bold">Revenue</TableCell>
                </TableRow>
                {renderAccountRows(revenueAccounts, true)}
                <TableRow className="font-semibold">
                  <TableCell className="pl-4">Total Revenue</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(totalRevenue)}</TableCell>
                  {showComparison && (
                    <>
                      <TableCell className="text-right font-mono">{formatCurrency(compTotalRevenue)}</TableCell>
                      <TableCell className={cn("text-right font-mono", totalRevenue - compTotalRevenue > 0 ? "text-green-600" : "text-destructive")}>
                        {formatCurrency(totalRevenue - compTotalRevenue)}
                      </TableCell>
                    </>
                  )}
                </TableRow>

                {/* COGS Section */}
                {cogsAccounts.length > 0 && (
                  <>
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={showComparison ? 4 : 2} className="font-bold">Cost of Goods Sold</TableCell>
                    </TableRow>
                    {renderAccountRows(cogsAccounts, true)}
                    <TableRow className="font-semibold">
                      <TableCell className="pl-4">Total COGS</TableCell>
                      <TableCell className="text-right font-mono">({formatCurrency(totalCogs)})</TableCell>
                      {showComparison && (
                        <>
                          <TableCell className="text-right font-mono">({formatCurrency(compTotalCogs)})</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(compTotalCogs - totalCogs)}</TableCell>
                        </>
                      )}
                    </TableRow>
                  </>
                )}

                {/* Gross Profit */}
                <TableRow className="bg-primary/10 font-bold">
                  <TableCell>Gross Profit</TableCell>
                  <TableCell className={cn("text-right font-mono", grossProfit >= 0 ? "text-green-600" : "text-destructive")}>
                    {formatCurrency(grossProfit)}
                  </TableCell>
                  {showComparison && (
                    <>
                      <TableCell className={cn("text-right font-mono", compGrossProfit >= 0 ? "text-green-600" : "text-destructive")}>
                        {formatCurrency(compGrossProfit)}
                      </TableCell>
                      <TableCell className={cn("text-right font-mono", grossProfit - compGrossProfit > 0 ? "text-green-600" : "text-destructive")}>
                        {formatCurrency(grossProfit - compGrossProfit)}
                      </TableCell>
                    </>
                  )}
                </TableRow>

                {/* Operating Expenses */}
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={showComparison ? 4 : 2} className="font-bold">Operating Expenses</TableCell>
                </TableRow>
                {renderAccountRows(expenseAccounts, true)}
                <TableRow className="font-semibold">
                  <TableCell className="pl-4">Total Operating Expenses</TableCell>
                  <TableCell className="text-right font-mono">({formatCurrency(totalExpenses)})</TableCell>
                  {showComparison && (
                    <>
                      <TableCell className="text-right font-mono">({formatCurrency(compTotalExpenses)})</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(compTotalExpenses - totalExpenses)}</TableCell>
                    </>
                  )}
                </TableRow>

                {/* Net Income */}
                <TableRow className="bg-primary/20 font-bold text-lg">
                  <TableCell>Net Income</TableCell>
                  <TableCell className={cn("text-right font-mono", netIncome >= 0 ? "text-green-600" : "text-destructive")}>
                    {formatCurrency(netIncome)}
                  </TableCell>
                  {showComparison && (
                    <>
                      <TableCell className={cn("text-right font-mono", compNetIncome >= 0 ? "text-green-600" : "text-destructive")}>
                        {formatCurrency(compNetIncome)}
                      </TableCell>
                      <TableCell className={cn("text-right font-mono", netIncome - compNetIncome > 0 ? "text-green-600" : "text-destructive")}>
                        {formatCurrency(netIncome - compNetIncome)}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
