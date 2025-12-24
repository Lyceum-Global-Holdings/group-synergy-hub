import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Printer, FileDown, X, Cloud, Thermometer, Users, AlertTriangle, Shield, Package } from "lucide-react";
import { format } from "date-fns";
import { DailySiteReport, DAILY_REPORT_STATUSES } from "@/types/construction";
import { useDailyMaterialsActivity } from "@/hooks/construction/useDailyMaterialsActivity";
import { exportSiteReportToPdf } from "@/utils/siteReportPdfExport";

interface ViewSiteReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: DailySiteReport | null;
}

const REPORT_TYPE_CONFIG = {
  daily: { label: "Daily", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" },
  weekly: { label: "Weekly", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
  monthly: { label: "Monthly", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300" },
};

export function ViewSiteReportDialog({ open, onOpenChange, report }: ViewSiteReportDialogProps) {
  // Determine date range based on report type
  const reportType = (report as any)?.report_type || 'daily';
  const periodStartDate = reportType !== 'daily' && (report as any)?.period_start_date 
    ? (report as any).period_start_date 
    : report?.report_date || null;
  const periodEndDate = reportType !== 'daily' && (report as any)?.period_end_date 
    ? (report as any).period_end_date 
    : undefined;

  const { issues, returns, adjustments, isLoading } = useDailyMaterialsActivity(periodStartDate, periodEndDate);

  if (!report) return null;

  const statusConfig = DAILY_REPORT_STATUSES.find((s) => s.value === report.status);
  const typeConfig = REPORT_TYPE_CONFIG[reportType as keyof typeof REPORT_TYPE_CONFIG] || REPORT_TYPE_CONFIG.daily;

  const formatPeriod = () => {
    if (reportType === 'daily') {
      return format(new Date(report.report_date), "MMMM d, yyyy");
    }
    const periodStart = (report as any).period_start_date;
    const periodEnd = (report as any).period_end_date;
    if (periodStart && periodEnd) {
      return `${format(new Date(periodStart), "MMM d")} - ${format(new Date(periodEnd), "MMM d, yyyy")}`;
    }
    return format(new Date(report.report_date), "MMMM d, yyyy");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = () => {
    exportSiteReportToPdf(report as any, { issues, returns, adjustments });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold">Site Report</DialogTitle>
              <p className="text-sm text-muted-foreground">{report.report_number}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={typeConfig.color}>
                {typeConfig.label}
              </Badge>
              <Badge className={statusConfig?.color || "bg-muted"}>
                {statusConfig?.label || report.status}
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
                <p className="font-medium">{report.project?.project_name || "N/A"}</p>
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
                  <p className="text-lg font-semibold">{report.weather_conditions || "N/A"}</p>
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
                    {report.temperature_high && report.temperature_low
                      ? `${report.temperature_high}°F / ${report.temperature_low}°F`
                      : "N/A"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-500" />
                    Total Labor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">{report.labor_count || 0}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Workforce</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subcontractors:</span>
                    <span>{report.subcontractor_count || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Visitors:</span>
                    <span>{report.visitor_count || 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Work Summary */}
            {report.work_summary && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Work Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{report.work_summary}</p>
                </CardContent>
              </Card>
            )}

            {/* Delays & Safety */}
            <div className="grid md:grid-cols-2 gap-4">
              {report.delays_issues && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      Delays/Issues
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{report.delays_issues}</p>
                  </CardContent>
                </Card>
              )}

              {report.safety_observations && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4 text-red-500" />
                      Safety Observations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{report.safety_observations}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Materials Received */}
            {report.materials_received && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4 text-purple-500" />
                    Materials Received
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{report.materials_received}</p>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Material Activity Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Material Activity</h3>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : (
                <>
                  {/* Items Issued */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        Items Issued ({issues.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {issues.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No items issued on this date
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Issue #</TableHead>
                              <TableHead>Code</TableHead>
                              <TableHead>Item</TableHead>
                              <TableHead>Qty</TableHead>
                              <TableHead>Issued To</TableHead>
                              <TableHead>Notes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {issues.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono text-xs">{item.min_number}</TableCell>
                                <TableCell>{item.item_code || "-"}</TableCell>
                                <TableCell>{item.item_name}</TableCell>
                                <TableCell>{item.quantity_issued}</TableCell>
                                <TableCell>{item.issued_to || "-"}</TableCell>
                                <TableCell className="max-w-[150px] truncate">{item.item_notes || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>

                  {/* Items Returned */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        Items Returned ({returns.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {returns.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No items returned on this date
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Return #</TableHead>
                              <TableHead>Code</TableHead>
                              <TableHead>Item</TableHead>
                              <TableHead>Qty</TableHead>
                              <TableHead>By</TableHead>
                              <TableHead>Condition</TableHead>
                              <TableHead>Notes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {returns.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono text-xs">{item.mrn_number}</TableCell>
                                <TableCell>{item.item_code || "-"}</TableCell>
                                <TableCell>{item.item_name}</TableCell>
                                <TableCell>{item.quantity_returned}</TableCell>
                                <TableCell>{item.returned_by || "-"}</TableCell>
                                <TableCell>{item.condition || "-"}</TableCell>
                                <TableCell className="max-w-[150px] truncate">{item.item_notes || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>

                  {/* Stock Adjustments */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        Stock Adjustments ({adjustments.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {adjustments.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No stock adjustments on this date
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Code</TableHead>
                              <TableHead>Item</TableHead>
                              <TableHead>Change</TableHead>
                              <TableHead>Before</TableHead>
                              <TableHead>After</TableHead>
                              <TableHead>Notes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {adjustments.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{item.item_code || "-"}</TableCell>
                                <TableCell>{item.item_name}</TableCell>
                                <TableCell className={item.quantity_change > 0 ? "text-green-600" : "text-red-600"}>
                                  {item.quantity_change > 0 ? `+${item.quantity_change}` : item.quantity_change}
                                </TableCell>
                                <TableCell>{item.quantity_before}</TableCell>
                                <TableCell>{item.quantity_after}</TableCell>
                                <TableCell className="max-w-[200px] truncate">{item.adjustment_notes || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-muted/30">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" onClick={handleExportPdf}>
            <FileDown className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
