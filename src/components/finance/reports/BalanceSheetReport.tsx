import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download, Printer, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { cn, formatCurrency } from "@/lib/utils";
import { useFinancialReports, BalanceSheetRow } from "@/hooks/useFinancialReports";
import { useCompany } from "@/contexts/CompanyContext";
import { ReportErrorMessage } from "./ReportErrorMessage";

export function BalanceSheetReport() {
  const { selectedCompany } = useCompany();
  const { getBalanceSheet } = useFinancialReports();
  
  const [asOfDate, setAsOfDate] = useState<Date>(new Date());
  
  const { data: reportData, isLoading, error, refetch } = getBalanceSheet(format(asOfDate, "yyyy-MM-dd"));

  // Group data by category
  const assetAccounts = reportData?.filter(r => r.category === 'Assets') || [];
  const liabilityAccounts = reportData?.filter(r => r.category === 'Liabilities') || [];
  const equityAccounts = reportData?.filter(r => r.category === 'Equity') || [];

  // Further categorize assets
  const currentAssets = assetAccounts.filter(a => 
    ['Cash', 'Bank', 'Receivable', 'Asset'].includes(a.account_type) && 
    !['Fixed Asset'].includes(a.account_type)
  );
  const fixedAssets = assetAccounts.filter(a => a.account_type === 'Fixed Asset');

  const totalCurrentAssets = currentAssets.reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const totalFixedAssets = fixedAssets.reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const totalAssets = totalCurrentAssets + totalFixedAssets;

  const totalLiabilities = liabilityAccounts.reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const totalEquity = equityAccounts.reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

  const handleExport = () => {
    console.log("Export Balance Sheet", reportData);
  };

  const handlePrint = () => {
    window.print();
  };

  const renderAccountRows = (accounts: BalanceSheetRow[]) => {
    return accounts.map((account, idx) => (
      <TableRow key={account.account_id || `virtual-${idx}`}>
        <TableCell className="pl-6">{account.account_name}</TableCell>
        <TableCell className="text-right font-mono">
          {formatCurrency(Number(account.balance || 0))}
        </TableCell>
      </TableRow>
    ));
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">As of Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(asOfDate, "PPP")}
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
      <Card>
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl">{selectedCompany?.name || 'Company Name'}</CardTitle>
          <p className="text-lg font-semibold">Balance Sheet</p>
          <p className="text-sm text-muted-foreground">As of {format(asOfDate, "MMMM d, yyyy")}</p>
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
              No account balances found. Create accounts and post journal entries to generate the Balance Sheet.
            </div>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Assets */}
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead colSpan={2} className="text-lg font-bold">Assets</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentAssets.length > 0 && (
                        <>
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={2} className="font-semibold">Current Assets</TableCell>
                          </TableRow>
                          {renderAccountRows(currentAssets)}
                          <TableRow className="font-semibold">
                            <TableCell className="pl-4">Total Current Assets</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(totalCurrentAssets)}</TableCell>
                          </TableRow>
                        </>
                      )}

                      {fixedAssets.length > 0 && (
                        <>
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={2} className="font-semibold">Fixed Assets</TableCell>
                          </TableRow>
                          {renderAccountRows(fixedAssets)}
                          <TableRow className="font-semibold">
                            <TableCell className="pl-4">Total Fixed Assets</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(totalFixedAssets)}</TableCell>
                          </TableRow>
                        </>
                      )}

                      <TableRow className="bg-primary/20 font-bold text-lg">
                        <TableCell>Total Assets</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(totalAssets)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Liabilities & Equity */}
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead colSpan={2} className="text-lg font-bold">Liabilities & Equity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {liabilityAccounts.length > 0 && (
                        <>
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={2} className="font-semibold">Liabilities</TableCell>
                          </TableRow>
                          {renderAccountRows(liabilityAccounts)}
                          <TableRow className="font-semibold">
                            <TableCell className="pl-4">Total Liabilities</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(totalLiabilities)}</TableCell>
                          </TableRow>
                        </>
                      )}

                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={2} className="font-semibold">Shareholders' Equity</TableCell>
                      </TableRow>
                      {renderAccountRows(equityAccounts)}
                      <TableRow className="font-semibold">
                        <TableCell className="pl-4">Total Equity</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(totalEquity)}</TableCell>
                      </TableRow>

                      <TableRow className="bg-primary/20 font-bold text-lg">
                        <TableCell>Total Liabilities & Equity</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(totalLiabilitiesAndEquity)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Balance Validation */}
              <div className="mt-6 flex justify-center">
                <div className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  isBalanced ? "bg-green-100 text-green-700" : "bg-red-100 text-destructive"
                )}>
                  {isBalanced ? (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-semibold">Balance Sheet is Balanced</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-semibold">
                        Balance Sheet is NOT Balanced (Difference: {formatCurrency(Math.abs(totalAssets - totalLiabilitiesAndEquity))})
                      </span>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
