import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileDown, X, Cloud, Thermometer, Users, AlertTriangle, Shield, Package, Warehouse, ArrowRightLeft, RefreshCw, Send } from "lucide-react";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DailySiteReport, DAILY_REPORT_STATUSES } from "@/types/construction";
import { useDailyMaterialsActivity, CurrentStockBalance } from "@/hooks/construction/useDailyMaterialsActivity";
import { exportSiteReportToPdf, generateSiteReportPdfBase64 } from "@/utils/siteReportPdfExport";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { cn } from "@/lib/utils";
interface ViewSiteReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: DailySiteReport | null;
}
const REPORT_TYPE_CONFIG = {
  daily: {
    label: "Daily",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
  },
  weekly: {
    label: "Weekly",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
  },
  monthly: {
    label: "Monthly",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
  }
};

const getTransactionTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    adjustment: "Adjustment",
    goods_receipt: "Goods Receipt",
    opening_stock: "Opening Stock",
    transfer_in: "Transfer In",
    transfer_out: "Transfer Out",
    project_issue: "Project Issue",
    project_return: "Project Return",
    sublocation_issue: "Sub-Location Issue",
  };
  return labels[type] || type.replace(/_/g, ' ');
};

const getTransactionTypeBadgeColor = (type: string): string => {
  const colors: Record<string, string> = {
    adjustment: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    goods_receipt: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    opening_stock: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    transfer_in: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
    transfer_out: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300",
    project_issue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    project_return: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300",
    sublocation_issue: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
  };
  return colors[type] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
};

export function ViewSiteReportDialog({
  open,
  onOpenChange,
  report
}: ViewSiteReportDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);

  // Fetch fresh report data when dialog opens
  const {
    data: freshReport,
    isLoading: reportLoading,
    refetch: refetchReport,
    isFetching: isRefetching
  } = useQuery({
    queryKey: ["daily-site-report", report?.id],
    queryFn: async () => {
      if (!report?.id) return null;
      const {
        data,
        error
      } = await supabase.from("daily_site_reports").select(`
          *,
          project:construction_projects(id, project_name, project_code)
        `).eq("id", report.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!report?.id && open,
    staleTime: 0 // Always fetch fresh data
  });

  // Use fresh data if available, fallback to prop
  const displayReport = (freshReport || report) as DailySiteReport;

  // Determine date range based on report type
  const reportType = (displayReport as any)?.report_type || 'daily';
  const periodStartDate = reportType !== 'daily' && (displayReport as any)?.period_start_date ? (displayReport as any).period_start_date : displayReport?.report_date || null;
  const periodEndDate = reportType !== 'daily' && (displayReport as any)?.period_end_date ? (displayReport as any).period_end_date : undefined;
  const {
    adjustments,
    issues,
    stockBalances,
    isLoading
  } = useDailyMaterialsActivity(periodStartDate, periodEndDate);
  if (!report) return null;

  // Show loading state while fetching fresh data
  if (reportLoading) {
    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </DialogContent>
      </Dialog>;
  }
  const statusConfig = DAILY_REPORT_STATUSES.find(s => s.value === displayReport.status);
  const typeConfig = REPORT_TYPE_CONFIG[reportType as keyof typeof REPORT_TYPE_CONFIG] || REPORT_TYPE_CONFIG.daily;
  const formatPeriod = () => {
    if (reportType === 'daily') {
      return format(new Date(displayReport.report_date), "MMMM d, yyyy");
    }
    const periodStart = (displayReport as any).period_start_date;
    const periodEnd = (displayReport as any).period_end_date;
    if (periodStart && periodEnd) {
      return `${format(new Date(periodStart), "MMM d")} - ${format(new Date(periodEnd), "MMM d, yyyy")}`;
    }
    return format(new Date(displayReport.report_date), "MMMM d, yyyy");
  };

  const handleExportPdf = () => {
    exportSiteReportToPdf(displayReport as any, {
      adjustments,
      issues,
      stockBalances
    });
  };

  const handleSendTelegram = async () => {
    setIsSendingTelegram(true);
    try {
      const pdfBase64 = generateSiteReportPdfBase64(displayReport as any, {
        adjustments,
        issues,
        stockBalances
      });

      const { data, error } = await supabase.functions.invoke('send-telegram-report', {
        body: {
          pdf_base64: pdfBase64,
          filename: `${displayReport.report_number}.pdf`,
          report_number: displayReport.report_number,
          project_name: displayReport.project?.project_name || 'N/A',
          report_date: formatPeriod(),
          report_type: reportType
        }
      });

      if (error) throw error;

      toast({
        title: "Report sent!",
        description: "PDF sent to Telegram successfully."
      });
    } catch (error: any) {
      console.error("Telegram send error:", error);
      toast({
        title: "Failed to send",
        description: error.message || "Could not send report to Telegram.",
        variant: "destructive"
      });
    } finally {
      setIsSendingTelegram(false);
    }
  };

  const handleRefresh = async () => {
    try {
      // Refetch the report data
      await refetchReport();
      
      // Invalidate and refetch material activity queries using partial key matching
      // This matches ALL queries that start with these keys, regardless of parameters
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["daily-material-issues"] }),
        queryClient.invalidateQueries({ queryKey: ["daily-material-returns"] }),
        queryClient.invalidateQueries({ queryKey: ["daily-stock-adjustments"] }),
        queryClient.invalidateQueries({ queryKey: ["current-stock-balance"] }),
      ]);
      
      toast({ 
        title: "Data refreshed",
        description: "Report and material activity data have been updated."
      });
    } catch (error) {
      toast({ 
        title: "Refresh failed",
        description: "Could not refresh data. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Sort stock balances by item name first, then by warehouse
  const sortedStockBalances = [...stockBalances].sort((a, b) => {
    const nameA = a.item_name || "";
    const nameB = b.item_name || "";
    if (nameA !== nameB) {
      return nameA.localeCompare(nameB);
    }
    const warehouseA = a.warehouse_name || "Unassigned";
    const warehouseB = b.warehouse_name || "Unassigned";
    return warehouseA.localeCompare(warehouseB);
  });

  // Calculate total stock per item (across all warehouses)
  const itemTotals = stockBalances.reduce((acc, item) => {
    const itemCode = item.item_code || "unknown";
    if (!acc[itemCode]) {
      acc[itemCode] = 0;
    }
    acc[itemCode] += item.current_stock;
    return acc;
  }, {} as Record<string, number>);

  // Group sorted stock balances by warehouse
  const stockByWarehouse = sortedStockBalances.reduce((acc, item) => {
    const warehouseName = item.warehouse_name || "Unassigned";
    if (!acc[warehouseName]) {
      acc[warehouseName] = {
        items: [],
        totalStock: 0
      };
    }
    acc[warehouseName].items.push(item);
    acc[warehouseName].totalStock += item.current_stock;
    return acc;
  }, {} as Record<string, {
    items: CurrentStockBalance[];
    totalStock: number;
  }>);
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold">Site Report</DialogTitle>
              <p className="text-sm text-muted-foreground">{displayReport.report_number}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={typeConfig.color}>
                {typeConfig.label}
              </Badge>
              <Badge className={statusConfig?.color || "bg-muted"}>
                {statusConfig?.label || displayReport.status}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="p-6 space-y-6">
            {/* Header Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Project</p>
                <p className="font-medium">{displayReport.project?.project_name || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Period</p>
                <p className="font-medium">{formatPeriod()}</p>
              </div>
            </div>

            <Separator />

            {/* Weather & Labor */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Cloud className="h-4 w-4 text-blue-500" />
                    Weather
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">{displayReport.weather_conditions || "N/A"}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-orange-500" />
                    Temperature
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">
                    {displayReport.temperature_high && displayReport.temperature_low ? `${displayReport.temperature_high}°F / ${displayReport.temperature_low}°F` : "N/A"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-500" />
                    Labor
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Skilled:</span>
                    <span>{(displayReport as any).skilled_labor_count || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Non-Skilled:</span>
                    <span>{(displayReport as any).unskilled_labor_count || 0}</span>
                  </div>
                  <div className="flex justify-between font-medium pt-1 border-t">
                    <span>Total:</span>
                    <span>{((displayReport as any).skilled_labor_count || 0) + ((displayReport as any).unskilled_labor_count || 0)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Workforce</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subcontractors:</span>
                    <span>{(displayReport as any).subcontractor_count || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Visitors:</span>
                    <span>{(displayReport as any).visitor_count || 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Work Summary */}
            {displayReport.work_summary && <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Work Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{displayReport.work_summary}</p>
                </CardContent>
              </Card>}

            {/* Delays & Safety */}
            <div className="grid md:grid-cols-2 gap-4">
              {displayReport.delays_issues && <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      Delays/Issues
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{displayReport.delays_issues}</p>
                  </CardContent>
                </Card>}

              {displayReport.safety_observations && <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4 text-red-500" />
                      Safety Observations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{displayReport.safety_observations}</p>
                  </CardContent>
                </Card>}
            </div>

            {/* Materials Received */}
            {displayReport.materials_received}

            <Separator />

            {/* Material Activity Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                Material Activity
              </h3>

              {isLoading ? <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div> : <div className="space-y-4">
                  {/* Items Issued */}
                  

                  {/* Stock Transactions */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        Stock Transactions ({adjustments.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {adjustments.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">
                          No stock transactions for this period
                        </p> : <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Type</TableHead>
                              <TableHead>Code</TableHead>
                              <TableHead>Item</TableHead>
                              <TableHead>Change</TableHead>
                              <TableHead>Before</TableHead>
                              <TableHead>After</TableHead>
                              <TableHead>Notes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {adjustments.map((item, idx) => <TableRow key={idx}>
                                <TableCell>
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTransactionTypeBadgeColor(item.transaction_type)}`}>
                                    {getTransactionTypeLabel(item.transaction_type)}
                                  </span>
                                </TableCell>
                                <TableCell>{item.item_code || "-"}</TableCell>
                                <TableCell>{item.item_name}</TableCell>
                                <TableCell className={item.quantity_change > 0 ? "text-green-600" : "text-red-600"}>
                                  {item.quantity_change > 0 ? `+${item.quantity_change}` : item.quantity_change}
                                </TableCell>
                                <TableCell>{item.quantity_before}</TableCell>
                                <TableCell>{item.quantity_after}</TableCell>
                                <TableCell className="max-w-[200px] truncate">
                                  {item.issued_to_location_name 
                                    ? `To: ${item.issued_to_location_name}${item.adjustment_notes ? ` - ${item.adjustment_notes}` : ""}`
                                    : item.adjustment_notes || "-"}
                                </TableCell>
                              </TableRow>)}
                          </TableBody>
                        </Table>}
                    </CardContent>
                  </Card>
                </div>}
            </div>

            <Separator />

            {/* Current Stock Balances Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Warehouse className="h-5 w-5" />
                Current Stock Balances
              </h3>

              {isLoading ? <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div> : <div className="space-y-4">
                  {/* Warehouse Summary */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Stock by Warehouse</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {Object.keys(stockByWarehouse).length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">
                          No stock data available
                        </p> : <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Warehouse</TableHead>
                              <TableHead>Items Count</TableHead>
                              <TableHead>Total Stock</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(stockByWarehouse).map(([warehouse, data], idx) => <TableRow key={idx}>
                                <TableCell className="font-medium">{warehouse}</TableCell>
                                <TableCell>{data.items.length}</TableCell>
                                <TableCell>{data.totalStock}</TableCell>
                              </TableRow>)}
                          </TableBody>
                        </Table>}
                    </CardContent>
                  </Card>

                  {/* Detailed Stock Balances */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        Detailed Stock Balances ({sortedStockBalances.length} items)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {sortedStockBalances.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">
                          No stock data available
                        </p> : <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Code</TableHead>
                              <TableHead>Item</TableHead>
                              <TableHead>Current Stock</TableHead>
                              <TableHead>Warehouse</TableHead>
                              <TableHead>Total Stock</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedStockBalances.map((item, idx) => <TableRow key={`${item.item_code}-${item.warehouse_id}-${idx}`}>
                                <TableCell>{item.item_code || "-"}</TableCell>
                                <TableCell>{item.item_name}</TableCell>
                                <TableCell>{item.current_stock}</TableCell>
                                <TableCell>{item.warehouse_name || "Unassigned"}</TableCell>
                                <TableCell className="font-medium">{itemTotals[item.item_code || "unknown"] || 0}</TableCell>
                              </TableRow>)}
                          </TableBody>
                        </Table>}
                    </CardContent>
                  </Card>
                </div>}
            </div>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-muted/30">
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={isRefetching || isLoading}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", (isRefetching || isLoading) && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExportPdf}>
            <FileDown className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button 
            variant="outline" 
            onClick={handleSendTelegram}
            disabled={isSendingTelegram}
          >
            <Send className={cn("mr-2 h-4 w-4", isSendingTelegram && "animate-pulse")} />
            {isSendingTelegram ? "Sending..." : "Send via Telegram"}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>;
}