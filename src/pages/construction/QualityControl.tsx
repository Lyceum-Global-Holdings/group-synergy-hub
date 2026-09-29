import { useState } from "react";
import { Plus, Search, ClipboardCheck, CheckCircle, XCircle, AlertCircle, Pencil, Trash2, Play, ListChecks, RotateCcw } from "lucide-react";
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
import { useQualityInspections, useCreateQualityInspection, useUpdateQualityInspection, useDeleteQualityInspection } from "@/hooks/construction/useQualityInspections";
import { QUALITY_INSPECTION_STATUSES, INSPECTION_RESULTS, QualityInspection } from "@/types/construction";
import { format } from "date-fns";
import { QualityInspectionDialog, DeleteConfirmDialog } from "@/components/construction/dialogs";
import { RecordQualityResultDialog, ReinspectDialog } from "@/components/construction/qhse/QhseDialogs";
import { CorrectiveActionsDialog } from "@/components/construction/qhse/CorrectiveActionsDialog";
import { useOpenActionCounts, useQhseStep } from "@/hooks/construction/useQhseWorkflow";

export default function QualityControl() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<QualityInspection | null>(null);
  const [deletingItem, setDeletingItem] = useState<QualityInspection | null>(null);
  const [resultFor, setResultFor] = useState<QualityInspection | null>(null);
  const [reinspectFor, setReinspectFor] = useState<QualityInspection | null>(null);
  const [actionsFor, setActionsFor] = useState<QualityInspection | null>(null);
  const step = useQhseStep();
  const { data: actionCounts } = useOpenActionCounts();

  const { data: inspections, isLoading } = useQualityInspections();
  const createMutation = useCreateQualityInspection();
  const updateMutation = useUpdateQualityInspection();
  const deleteMutation = useDeleteQualityInspection();

  const filteredInspections = inspections?.filter((inspection) => {
    const matchesSearch =
      inspection.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inspection.inspection_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || inspection.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = QUALITY_INSPECTION_STATUSES.find((s) => s.value === status);
    return (
      <Badge className={statusConfig?.color || "bg-muted"}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const getResultBadge = (result: string | null) => {
    if (!result) return <span className="text-muted-foreground">-</span>;
    const resultConfig = INSPECTION_RESULTS.find((r) => r.value === result);
    return (
      <Badge className={resultConfig?.color || "bg-muted"}>
        {resultConfig?.label || result}
      </Badge>
    );
  };

  const handleCreate = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const handleEdit = (item: QualityInspection) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deletingItem) {
      await deleteMutation.mutateAsync(deletingItem.id);
      setDeletingItem(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quality Control</h1>
          <p className="text-muted-foreground">
            Schedule, run and record inspections; failures raise corrective actions and a re-inspection.
          </p>
          {actionCounts && (actionCounts.open > 0 || actionCounts.toVerify > 0) && (
            <p className="text-sm text-muted-foreground">
              Corrective actions across quality and safety: {actionCounts.open} open{actionCounts.overdue ? ` (${actionCounts.overdue} overdue)` : ""},{" "}
              {actionCounts.toVerify} waiting for verification.
            </p>
          )}
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Inspection
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inspections</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inspections?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Passed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {inspections?.filter((i) => i.overall_result === "pass").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {inspections?.filter((i) => i.overall_result === "fail").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {inspections?.filter((i) => i.status === "scheduled").length || 0}
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
                placeholder="Search inspections..."
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
                {QUALITY_INSPECTION_STATUSES.map((status) => (
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
                  <TableHead>Inspection #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInspections?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No inspections found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInspections?.map((inspection) => (
                    <TableRow key={inspection.id}>
                      <TableCell className="font-medium">{inspection.inspection_number}</TableCell>
                      <TableCell>{inspection.title}</TableCell>
                      <TableCell>{inspection.project?.project_name || "-"}</TableCell>
                      <TableCell className="capitalize">{inspection.inspection_type}</TableCell>
                      <TableCell>
                        {format(new Date(inspection.inspection_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{getStatusBadge(inspection.status)}</TableCell>
                      <TableCell>
                        {getResultBadge(inspection.overall_result)}
                        {inspection.follow_up_date && (
                          <div className="text-xs text-muted-foreground">Follow up by {format(new Date(inspection.follow_up_date), "d MMM")}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {inspection.status === "scheduled" && (
                            <Button variant="outline" size="sm" disabled={step.isPending}
                              onClick={() => step.mutate({ fn: "start_quality_inspection", args: { p_id: inspection.id }, done: "Inspection started" })}>
                              <Play className="mr-1 h-3 w-3" /> Start
                            </Button>
                          )}
                          {(inspection.status === "scheduled" || inspection.status === "in_progress") && (
                            <Button size="sm" onClick={() => setResultFor(inspection as QualityInspection)}>Record result</Button>
                          )}
                          {inspection.status === "failed" && (
                            <Button variant="outline" size="sm" onClick={() => setReinspectFor(inspection as QualityInspection)}>
                              <RotateCcw className="mr-1 h-3 w-3" /> Re-inspect
                            </Button>
                          )}
                          {inspection.status !== "scheduled" && (
                            <Button variant="ghost" size="icon" aria-label="Corrective actions" onClick={() => setActionsFor(inspection as QualityInspection)}>
                              <ListChecks className="h-4 w-4" />
                            </Button>
                          )}
                          {(inspection.status === "scheduled" || inspection.status === "in_progress") && (
                            <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => handleEdit(inspection as QualityInspection)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {inspection.status === "scheduled" && (
                            <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setDeletingItem(inspection as QualityInspection)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
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

      <QualityInspectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        inspection={editingItem}
      />

      <RecordQualityResultDialog open={!!resultFor} onOpenChange={(o) => !o && setResultFor(null)} inspection={resultFor} />
      <ReinspectDialog open={!!reinspectFor} onOpenChange={(o) => !o && setReinspectFor(null)} inspection={reinspectFor} />
      <CorrectiveActionsDialog
        open={!!actionsFor}
        onOpenChange={(o) => !o && setActionsFor(null)}
        sourceType="quality_inspection"
        source={actionsFor ? { id: actionsFor.id, number: actionsFor.inspection_number, title: actionsFor.title } : null}
        canAdd={!!actionsFor && actionsFor.status !== "scheduled"}
      />

      <DeleteConfirmDialog
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        onConfirm={handleDelete}
        title="Delete Inspection"
        description={`Are you sure you want to delete inspection "${deletingItem?.inspection_number}"? This action cannot be undone.`}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
