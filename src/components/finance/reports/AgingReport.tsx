import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, Download, Printer, Loader2, Users, Building2 } from "lucide-react";
import { format } from "date-fns";
import { cn, formatCurrency } from "@/lib/utils";
import { useFinancialReports, AgingBucketRow } from "@/hooks/useFinancialReports";
import { useCompany } from "@/contexts/CompanyContext";
import { ReportErrorMessage } from "./ReportErrorMessage";

export function AgingReport() {
  const { selectedCompany } = useCompany();
  const { getAgingReport } = useFinancialReports();
  
  const [asOfDate, setAsOfDate] = useState<Date>(new Date());
  const [reportType, setReportType] = useState<"customer" | "supplier">("customer");
  
  const { data: reportData, isLoading, error, refetch } = getAgingReport(
    format(asOfDate, "yyyy-MM-dd"),
    reportType
  );

  // Calculate totals
  const totals = reportData?.reduce((acc, row) => ({
    current_bucket: acc.current_bucket + Number(row.current_bucket || 0),
    bucket_1_30: acc.bucket_1_30 + Number(row.bucket_1_30 || 0),
    bucket_31_60: acc.bucket_31_60 + Number(row.bucket_31_60 || 0),
    bucket_61_90: acc.bucket_61_90 + Number(row.bucket_61_90 || 0),
    bucket_over_90: acc.bucket_over_90 + Number(row.bucket_over_90 || 0),
    total_outstanding: acc.total_outstanding + Number(row.total_outstanding || 0),
  }), {
    current_bucket: 0,
    bucket_1_30: 0,
    bucket_31_60: 0,
    bucket_61_90: 0,
    bucket_over_90: 0,
    total_outstanding: 0,
  }) || { current_bucket: 0, bucket_1_30: 0, bucket_31_60: 0, bucket_61_90: 0, bucket_over_90: 0, total_outstanding: 0 };

  const handleExport = () => {
    console.log("Export Aging Report", reportData);
  };

  const handlePrint = () => {
    window.print();
  };

  const renderAgingRow = (row: AgingBucketRow) => (
    <TableRow key={row.entity_id}>
      <TableCell className="font-medium">{row.entity_name}</TableCell>
      <TableCell className="text-right font-mono">
        {Number(row.current_bucket) > 0 ? formatCurrency(Number(row.current_bucket)) : '-'}
      </TableCell>
      <TableCell className="text-right font-mono">
        {Number(row.bucket_1_30) > 0 ? formatCurrency(Number(row.bucket_1_30)) : '-'}
      </TableCell>
      <TableCell className={cn("text-right font-mono", Number(row.bucket_31_60) > 0 && "text-amber-600")}>
        {Number(row.bucket_31_60) > 0 ? formatCurrency(Number(row.bucket_31_60)) : '-'}
      </TableCell>
      <TableCell className={cn("text-right font-mono", Number(row.bucket_61_90) > 0 && "text-orange-600")}>
        {Number(row.bucket_61_90) > 0 ? formatCurrency(Number(row.bucket_61_90)) : '-'}
      </TableCell>
      <TableCell className={cn("text-right font-mono", Number(row.bucket_over_90) > 0 && "text-destructive font-semibold")}>
        {Number(row.bucket_over_90) > 0 ? formatCurrency(Number(row.bucket_over_90)) : '-'}
      </TableCell>
      <TableCell className="text-right font-mono font-semibold">
        {formatCurrency(Number(row.total_outstanding))}
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
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
          <p className="text-lg font-semibold">
            {reportType === "customer" ? "Accounts Receivable" : "Accounts Payable"} Aging Report
          </p>
          <p className="text-sm text-muted-foreground">As of {format(asOfDate, "MMMM d, yyyy")}</p>
        </CardHeader>
        <CardContent>
          <Tabs value={reportType} onValueChange={(v) => setReportType(v as "customer" | "supplier")} className="mb-6">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
              <TabsTrigger value="customer" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Receivables (AR)
              </TabsTrigger>
              <TabsTrigger value="supplier" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Payables (AP)
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <ReportErrorMessage error={error} onRetry={() => refetch()} />
          ) : !reportData || reportData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No outstanding {reportType === "customer" ? "receivables" : "payables"} found.
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="min-w-[200px]">
                      {reportType === "customer" ? "Customer" : "Supplier"}
                    </TableHead>
                    <TableHead className="text-right min-w-[100px]">Current</TableHead>
                    <TableHead className="text-right min-w-[100px]">1-30 Days</TableHead>
                    <TableHead className="text-right min-w-[100px]">31-60 Days</TableHead>
                    <TableHead className="text-right min-w-[100px]">61-90 Days</TableHead>
                    <TableHead className="text-right min-w-[100px]">Over 90 Days</TableHead>
                    <TableHead className="text-right min-w-[120px]">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map(renderAgingRow)}
                  
                  {/* Totals Row */}
                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right font-mono">
                      {totals.current_bucket > 0 ? formatCurrency(totals.current_bucket) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {totals.bucket_1_30 > 0 ? formatCurrency(totals.bucket_1_30) : '-'}
                    </TableCell>
                    <TableCell className={cn("text-right font-mono", totals.bucket_31_60 > 0 && "text-amber-600")}>
                      {totals.bucket_31_60 > 0 ? formatCurrency(totals.bucket_31_60) : '-'}
                    </TableCell>
                    <TableCell className={cn("text-right font-mono", totals.bucket_61_90 > 0 && "text-orange-600")}>
                      {totals.bucket_61_90 > 0 ? formatCurrency(totals.bucket_61_90) : '-'}
                    </TableCell>
                    <TableCell className={cn("text-right font-mono", totals.bucket_over_90 > 0 && "text-destructive")}>
                      {totals.bucket_over_90 > 0 ? formatCurrency(totals.bucket_over_90) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(totals.total_outstanding)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          {/* Summary Cards */}
          {reportData && reportData.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Current (Not Due)</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(totals.current_bucket)}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">1-30 Days Past Due</p>
                <p className="text-xl font-bold">
                  {formatCurrency(totals.bucket_1_30)}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">31-90 Days Past Due</p>
                <p className="text-xl font-bold text-amber-600">
                  {formatCurrency(totals.bucket_31_60 + totals.bucket_61_90)}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Over 90 Days</p>
                <p className="text-xl font-bold text-destructive">
                  {formatCurrency(totals.bucket_over_90)}
                </p>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
