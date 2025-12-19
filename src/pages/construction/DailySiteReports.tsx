import { useState } from "react";
import { Plus, Search, FileText, Calendar, Cloud, Users, Pencil, Trash2, Package } from "lucide-react";
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
import { useDailySiteReports, useCreateDailySiteReport, useUpdateDailySiteReport, useDeleteDailySiteReport } from "@/hooks/construction/useDailySiteReports";
import { useProjectMaterialSummary } from "@/hooks/construction/useRoomMaterialSummary";
import { DAILY_REPORT_STATUSES, DailySiteReport } from "@/types/construction";
import { format } from "date-fns";
import { DailySiteReportDialog, DeleteConfirmDialog } from "@/components/construction/dialogs";
import { RoomMaterialSummaryDialog } from "@/components/construction/RoomMaterialSummaryDialog";

// Component to display material counts for a single report
function MaterialCountCell({ projectId, reportDate }: { projectId: string; reportDate: string }) {
  const { data: summary } = useProjectMaterialSummary(projectId, reportDate);
  
  if (!summary || (summary.totalIssued === 0 && summary.totalReturned === 0)) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {summary.totalIssued > 0 && (
        <span className="text-green-600 dark:text-green-400">
          ↓{summary.totalIssued}
        </span>
      )}
      {summary.totalReturned > 0 && (
        <span className="text-orange-600 dark:text-orange-400">
          ↑{summary.totalReturned}
        </span>
      )}
    </div>
  );
}

export default function DailySiteReports() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DailySiteReport | null>(null);
  const [deletingItem, setDeletingItem] = useState<DailySiteReport | null>(null);
  const [materialSummaryReport, setMaterialSummaryReport] = useState<{
    projectId: string;
    projectName: string;
    reportDate: string;
  } | null>(null);

  const { data: reports, isLoading } = useDailySiteReports();
  const createMutation = useCreateDailySiteReport();
  const updateMutation = useUpdateDailySiteReport();
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

  const handleViewMaterials = (report: any) => {
    if (report.project?.id) {
      setMaterialSummaryReport({
        projectId: report.project.id,
        projectName: report.project.project_name || 'Unknown Project',
        reportDate: report.report_date,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Daily Site Reports</h1>
          <p className="text-muted-foreground">
            Track daily construction site activities and progress
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Report
        </Button>
      </div>

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
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reports?.filter((r) => r.status === "draft").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Submitted</CardTitle>
            <Cloud className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reports?.filter((r) => r.status === "submitted").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reports?.filter((r) => r.status === "approved").length || 0}
            </div>
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
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
                  <TableHead>Project</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Weather</TableHead>
                  <TableHead>Labor</TableHead>
                  <TableHead>Materials</TableHead>
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
                      <TableCell className="font-medium">{report.report_number}</TableCell>
                      <TableCell>{report.project?.project_name || "-"}</TableCell>
                      <TableCell>
                        {format(new Date(report.report_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{report.weather_conditions || "-"}</TableCell>
                      <TableCell>{report.labor_count || 0}</TableCell>
                      <TableCell>
                        {report.project?.id ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto py-1 px-2"
                            onClick={() => handleViewMaterials(report)}
                          >
                            <MaterialCountCell 
                              projectId={report.project.id} 
                              reportDate={report.report_date} 
                            />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(report.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {report.project?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewMaterials(report)}
                              title="View Materials"
                            >
                              <Package className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(report as DailySiteReport)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingItem(report as DailySiteReport)}
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

      <DailySiteReportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        report={editingItem}
      />

      <DeleteConfirmDialog
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        onConfirm={handleDelete}
        title="Delete Report"
        description={`Are you sure you want to delete report "${deletingItem?.report_number}"? This action cannot be undone.`}
        isDeleting={deleteMutation.isPending}
      />

      <RoomMaterialSummaryDialog
        open={!!materialSummaryReport}
        onOpenChange={(open) => !open && setMaterialSummaryReport(null)}
        projectId={materialSummaryReport?.projectId || null}
        projectName={materialSummaryReport?.projectName || ''}
        reportDate={materialSummaryReport?.reportDate || null}
      />
    </div>
  );
}
