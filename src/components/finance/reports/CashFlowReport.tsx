import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download, Printer, Loader2, Settings } from "lucide-react";
import { format, startOfYear } from "date-fns";
import { cn, formatCurrency } from "@/lib/utils";
import { useFinancialReports, CashFlowRow } from "@/hooks/useFinancialReports";
import { useCompany } from "@/contexts/CompanyContext";
import { ReportErrorMessage } from "./ReportErrorMessage";

export function CashFlowReport() {
  const { selectedCompany } = useCompany();
  const { getCashFlowStatement } = useFinancialReports();
  
  const [startDate, setStartDate] = useState<Date>(startOfYear(new Date()));
  const [endDate, setEndDate] = useState<Date>(new Date());
  
  const { data: reportData, isLoading, error, refetch } = getCashFlowStatement(
    format(startDate, "yyyy-MM-dd"),
    format(endDate, "yyyy-MM-dd")
  );

  // Group data by category
  const operatingItems = reportData?.filter(r => r.category === 'Operating Activities') || [];
  const investingItems = reportData?.filter(r => r.category === 'Investing Activities') || [];
  const financingItems = reportData?.filter(r => r.category === 'Financing Activities') || [];

  const netOperating = operatingItems.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const netInvesting = investingItems.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const netFinancing = financingItems.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const netChange = netOperating + netInvesting + netFinancing;

  const handleExport = () => {
    console.log("Export Cash Flow", reportData);
  };

  const handlePrint = () => {
    window.print();
  };

  const renderCategoryRows = (items: CashFlowRow[]) => {
    return items.map((item, idx) => (
      <TableRow key={`${item.activity_type}-${idx}`}>
        <TableCell className="pl-6">{item.account_name}</TableCell>
        <TableCell className={cn(
          "text-right font-mono",
          Number(item.amount) < 0 ? "text-destructive" : ""
        )}>
          {formatCurrency(Number(item.amount || 0))}
        </TableCell>
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
          <p className="text-lg font-semibold">Statement of Cash Flows</p>
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
            <div className="text-center py-8 text-muted-foreground space-y-4">
              <p>No cash flow data found for this period.</p>
              <p className="text-sm">
                Configure cash flow account mappings in Finance Settings to generate this report.
              </p>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Configure Cash Flow Mappings
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Operating Activities */}
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={2} className="font-bold">Cash Flows from Operating Activities</TableCell>
                </TableRow>
                {renderCategoryRows(operatingItems)}
                <TableRow className="font-semibold bg-primary/10">
                  <TableCell className="pl-4">Net Cash from Operating Activities</TableCell>
                  <TableCell className={cn(
                    "text-right font-mono",
                    netOperating < 0 ? "text-destructive" : "text-green-600"
                  )}>
                    {formatCurrency(netOperating)}
                  </TableCell>
                </TableRow>

                {/* Investing Activities */}
                {investingItems.length > 0 && (
                  <>
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={2} className="font-bold">Cash Flows from Investing Activities</TableCell>
                    </TableRow>
                    {renderCategoryRows(investingItems)}
                    <TableRow className="font-semibold bg-primary/10">
                      <TableCell className="pl-4">Net Cash from Investing Activities</TableCell>
                      <TableCell className={cn(
                        "text-right font-mono",
                        netInvesting < 0 ? "text-destructive" : "text-green-600"
                      )}>
                        {formatCurrency(netInvesting)}
                      </TableCell>
                    </TableRow>
                  </>
                )}

                {/* Financing Activities */}
                {financingItems.length > 0 && (
                  <>
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={2} className="font-bold">Cash Flows from Financing Activities</TableCell>
                    </TableRow>
                    {renderCategoryRows(financingItems)}
                    <TableRow className="font-semibold bg-primary/10">
                      <TableCell className="pl-4">Net Cash from Financing Activities</TableCell>
                      <TableCell className={cn(
                        "text-right font-mono",
                        netFinancing < 0 ? "text-destructive" : "text-green-600"
                      )}>
                        {formatCurrency(netFinancing)}
                      </TableCell>
                    </TableRow>
                  </>
                )}

                {/* Summary */}
                <TableRow className="bg-primary/20 font-bold text-lg">
                  <TableCell>Net Change in Cash</TableCell>
                  <TableCell className={cn(
                    "text-right font-mono",
                    netChange < 0 ? "text-destructive" : "text-green-600"
                  )}>
                    {formatCurrency(netChange)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
