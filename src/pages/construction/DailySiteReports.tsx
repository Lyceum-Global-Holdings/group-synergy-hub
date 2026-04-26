// Force rebuild - cache refresh v2
import { useState } from "react";
import { Plus, Search, FileText, Calendar, Cloud, Users, Pencil, Trash2, Sparkles, BarChart3, Eye, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDailySiteReports, useDeleteDailySiteReport, ReportPeriodType } from "@/hooks/construction/useDailySiteReports";
import { DAILY_REPORT_STATUSES, DailySiteReport } from "@/types/construction";
import { format } from "date-fns";
import { DailySiteReportDialog, DeleteConfirmDialog, ViewSiteReportDialog } from "@/components/construction/dialogs";
import { GenerateReportDialog } from "@/components/construction/dialogs/GenerateReportDialog";
import { SiteReportAnalytics } from "@/components/construction/reports/SiteReportAnalytics";
import { TelegramSettingsTab } from "@/components/construction/TelegramSettingsTab";
import { GenerateReportButton } from "@/components/management/reports/GenerateReportButton";

const REPORT_TYPE_CONFIG = {
  daily: { label: "Daily", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" },
  weekly: { label: "Weekly", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
  monthly: { label: "Monthly", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300" },
};

export default function DailySiteReports() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DailySiteReport | null>(null);
  const [deletingItem, setDeletingItem] = useState<DailySiteReport | null>(null);
  const [viewingItem, setViewingItem] = useState<DailySiteReport | null>(null);

  const { data: reports, isLoading } = useDailySiteReports(
    undefined,
    typeFilter !== "all" ? typeFilter as ReportPeriodType : undefined
  );
  const deleteMutation = useDeleteDailySiteReport();

  const filteredReports = reports?.filter((report) => {
    const matchesSearch =
      report.report_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.project?.project_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || report.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = DAILY_REPORT_STATUSES.find((s) => s.value === status);
    return (
      <Badge className={statusConfig?.color || "bg-muted"}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const config = REPORT_TYPE_CONFIG[type as keyof typeof REPORT_TYPE_CONFIG] || REPORT_TYPE_CONFIG.daily;
    return (
      <Badge variant="outline" className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const handleCreate = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const handleEdit = (item: DailySiteReport) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deletingItem) {
      await deleteMutation.mutateAsync(deletingItem.id);
      setDeletingItem(null);
    }
  };

  const formatPeriod = (report: any) => {
    const reportType = report.report_type || 'daily';
    if (reportType === 'daily') {
      return format(new Date(report.report_date), "MMM d, yyyy");
    }
    if (report.period_start_date && report.period_end_date) {
      return `${format(new Date(report.period_start_date), "MMM d")} - ${format(new Date(report.period_end_date), "MMM d, yyyy")}`;
    }
    return format(new Date(report.report_date), "MMM d, yyyy");
  };

  // Count reports by type
  const dailyCount = reports?.filter(r => (r.report_type || 'daily') === 'daily').length || 0;
  const weeklyCount = reports?.filter(r => r.report_type === 'weekly').length || 0;
  const monthlyCount = reports?.filter(r => r.report_type === 'monthly').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Site Reports</h1>
          <p className="text-muted-foreground">
            Generate and manage daily, weekly, and monthly site reports
          </p>
        </div>
        <div className="flex gap-2">
          <GenerateReportButton template="CN-DSR-001" label="Standard Report" />
          <Button 
            variant="outline" 
            onClick={() => setGenerateDialogOpen(true)}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Generate Report
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Report
          </Button>
        </div>
      </div>

      <Tabs defaultValue="list" className="space-y-6">
        <TabsList>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Reports List
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics Dashboard
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reports?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Daily</CardTitle>
                <Calendar className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dailyCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Weekly</CardTitle>
                <Cloud className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{weeklyCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly</CardTitle>
                <Users className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{monthlyCount}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search reports..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Report Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {DAILY_REPORT_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Weather</TableHead>
                      <TableHead>Labor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No reports found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredReports?.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell className="font-medium">
                            <div>
                              <span>{report.report_number}</span>
                              <span className="block text-xs text-muted-foreground">
                                {format(new Date(report.created_at), "MMM d 'at' h:mm a")}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{getTypeBadge(report.report_type || 'daily')}</TableCell>
                          <TableCell>{report.project?.project_name || "-"}</TableCell>
                          <TableCell>{formatPeriod(report)}</TableCell>
                          <TableCell>{report.weather_conditions || "-"}</TableCell>
                          <TableCell>{report.labor_count || 0}</TableCell>
                          <TableCell>{getStatusBadge(report.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setViewingItem(report as DailySiteReport)}
                                title="View Report"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(report as DailySiteReport)}
                                title="Edit Report"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingItem(report as DailySiteReport)}
                                title="Delete Report"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <SiteReportAnalytics />
        </TabsContent>

        <TabsContent value="settings">
          <TelegramSettingsTab />
        </TabsContent>
      </Tabs>

      <DailySiteReportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        report={editingItem}
      />

      <GenerateReportDialog
        open={generateDialogOpen}
        onOpenChange={setGenerateDialogOpen}
      />

      <ViewSiteReportDialog
        open={!!viewingItem}
        onOpenChange={(open) => !open && setViewingItem(null)}
        report={viewingItem}
      />

      <DeleteConfirmDialog
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        onConfirm={handleDelete}
        title="Delete Report"
        description={`Are you sure you want to delete report "${deletingItem?.report_number}"? This action cannot be undone.`}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
