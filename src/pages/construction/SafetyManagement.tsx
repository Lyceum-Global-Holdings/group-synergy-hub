import { useState } from "react";
import { Plus, Search, ShieldAlert, AlertTriangle, ClipboardCheck, FileWarning, Pencil, Trash2, ListChecks, Search as SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { 
  useSafetyIncidents, 
  useSafetyInspections,
  useCreateSafetyIncident,
  useUpdateSafetyIncident,
  useDeleteSafetyIncident,
  useCreateSafetyInspection,
  useUpdateSafetyInspection,
  useDeleteSafetyInspection
} from "@/hooks/construction/useSafetyManagement";
import { INCIDENT_STATUSES, INCIDENT_SEVERITIES, SAFETY_INSPECTION_STATUSES, SafetyIncident, SafetyInspection } from "@/types/construction";
import { format } from "date-fns";
import { SafetyIncidentDialog, SafetyInspectionDialog, DeleteConfirmDialog } from "@/components/construction/dialogs";
import { CloseIncidentDialog, CompleteSafetyInspectionDialog } from "@/components/construction/qhse/QhseDialogs";
import { CorrectiveActionsDialog } from "@/components/construction/qhse/CorrectiveActionsDialog";
import { useQhseStep } from "@/hooks/construction/useQhseWorkflow";

const isSerious = (i: { severity: string; incident_type: string }) =>
  ["high", "critical"].includes(i.severity) || ["lost_time", "fatality"].includes(i.incident_type);

export default function SafetyManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [incidentStatusFilter, setIncidentStatusFilter] = useState<string>("all");
  const [inspectionStatusFilter, setInspectionStatusFilter] = useState<string>("all");
  
  // Dialog states for incidents
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [editingIncident, setEditingIncident] = useState<SafetyIncident | null>(null);
  const [deletingIncident, setDeletingIncident] = useState<SafetyIncident | null>(null);
  
  // Dialog states for inspections
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);
  const [editingInspection, setEditingInspection] = useState<SafetyInspection | null>(null);
  const [deletingInspection, setDeletingInspection] = useState<SafetyInspection | null>(null);

  // Workflow
  const step = useQhseStep();
  const [closingIncident, setClosingIncident] = useState<SafetyIncident | null>(null);
  const [completingInspection, setCompletingInspection] = useState<SafetyInspection | null>(null);
  const [actionsFor, setActionsFor] = useState<
    { type: "safety_incident" | "safety_inspection"; id: string; number: string; title?: string | null; canAdd: boolean } | null
  >(null);
  
  const { data: incidents, isLoading: incidentsLoading } = useSafetyIncidents();
  const { data: inspections, isLoading: inspectionsLoading } = useSafetyInspections();
  
  // Incident mutations
  const createIncidentMutation = useCreateSafetyIncident();
  const updateIncidentMutation = useUpdateSafetyIncident();
  const deleteIncidentMutation = useDeleteSafetyIncident();
  
  // Inspection mutations
  const createInspectionMutation = useCreateSafetyInspection();
  const updateInspectionMutation = useUpdateSafetyInspection();
  const deleteInspectionMutation = useDeleteSafetyInspection();

  const filteredIncidents = incidents?.filter((incident) => {
    const matchesSearch =
      incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.incident_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = incidentStatusFilter === "all" || incident.status === incidentStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredInspections = inspections?.filter((inspection) => {
    const matchesSearch = inspection.inspection_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = inspectionStatusFilter === "all" || inspection.status === inspectionStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const getIncidentStatusBadge = (status: string) => {
    const statusConfig = INCIDENT_STATUSES.find((s) => s.value === status);
    return (
      <Badge className={statusConfig?.color || "bg-muted"}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const getSeverityBadge = (severity: string) => {
    const severityConfig = INCIDENT_SEVERITIES.find((s) => s.value === severity);
    return (
      <Badge variant="outline" className={severityConfig?.color || ""}>
        {severityConfig?.label || severity}
      </Badge>
    );
  };

  const getInspectionStatusBadge = (status: string) => {
    const statusConfig = SAFETY_INSPECTION_STATUSES.find((s) => s.value === status);
    return (
      <Badge className={statusConfig?.color || "bg-muted"}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  // Incident handlers
  const handleCreateIncident = () => {
    setEditingIncident(null);
    setIncidentDialogOpen(true);
  };

  const handleEditIncident = (item: SafetyIncident) => {
    setEditingIncident(item);
    setIncidentDialogOpen(true);
  };

  const handleDeleteIncident = async () => {
    if (deletingIncident) {
      await deleteIncidentMutation.mutateAsync(deletingIncident.id);
      setDeletingIncident(null);
    }
  };

  // Inspection handlers
  const handleCreateInspection = () => {
    setEditingInspection(null);
    setInspectionDialogOpen(true);
  };

  const handleEditInspection = (item: SafetyInspection) => {
    setEditingInspection(item);
    setInspectionDialogOpen(true);
  };

  const handleDeleteInspection = async () => {
    if (deletingInspection) {
      await deleteInspectionMutation.mutateAsync(deletingInspection.id);
      setDeletingInspection(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Safety Management</h1>
          <p className="text-muted-foreground">
            Track safety incidents and manage safety inspections
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Incidents</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{incidents?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {incidents?.filter((i) => i.status !== "closed").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inspections</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inspections?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Incidents</CardTitle>
            <FileWarning className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {incidents?.filter((i) => i.severity === "critical").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="incidents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="incidents">Safety Incidents</TabsTrigger>
          <TabsTrigger value="inspections">Safety Inspections</TabsTrigger>
        </TabsList>

        <TabsContent value="incidents">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search incidents..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={incidentStatusFilter} onValueChange={setIncidentStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {INCIDENT_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateIncident}>
                  <Plus className="mr-2 h-4 w-4" />
                  Report Incident
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {incidentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Incident #</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIncidents?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No incidents found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredIncidents?.map((incident) => (
                        <TableRow key={incident.id}>
                          <TableCell className="font-medium">{incident.incident_number}</TableCell>
                          <TableCell>{incident.title}</TableCell>
                          <TableCell>{incident.project?.project_name || "-"}</TableCell>
                          <TableCell className="capitalize">{incident.incident_type.replace("_", " ")}</TableCell>
                          <TableCell>{getSeverityBadge(incident.severity)}</TableCell>
                          <TableCell>
                            {format(new Date(incident.incident_date), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            {getIncidentStatusBadge(incident.status)}
                            {isSerious(incident) && incident.status !== "closed" && (
                              <div className="text-xs text-orange-700">Serious: a manager closes it</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {incident.status === "reported" && (
                                <Button variant="outline" size="sm" disabled={step.isPending}
                                  onClick={() => step.mutate({ fn: "start_incident_investigation", args: { p_id: incident.id }, done: "Investigation started" })}>
                                  <SearchIcon className="mr-1 h-3 w-3" /> Investigate
                                </Button>
                              )}
                              {incident.status === "investigating" && (
                                <Button size="sm" onClick={() => setClosingIncident(incident as SafetyIncident)}>Close</Button>
                              )}
                              <Button variant="ghost" size="icon" aria-label="Corrective actions"
                                onClick={() => setActionsFor({ type: "safety_incident", id: incident.id, number: incident.incident_number,
                                  title: incident.title, canAdd: incident.status !== "closed" })}>
                                <ListChecks className="h-4 w-4" />
                              </Button>
                              {incident.status !== "closed" && (
                                <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => handleEditIncident(incident as SafetyIncident)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {incident.status === "reported" && (
                                <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setDeletingIncident(incident as SafetyIncident)}>
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
        </TabsContent>

        <TabsContent value="inspections">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search inspections..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={inspectionStatusFilter} onValueChange={setInspectionStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {SAFETY_INSPECTION_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateInspection}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Inspection
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {inspectionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Inspection #</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Follow-up</TableHead>
                      <TableHead>Status</TableHead>
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
                          <TableCell>{inspection.project?.project_name || "-"}</TableCell>
                          <TableCell className="capitalize">{inspection.inspection_type}</TableCell>
                          <TableCell>
                            {format(new Date(inspection.inspection_date), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>{inspection.overall_score || "-"}</TableCell>
                          <TableCell>
                            {inspection.follow_up_required ? (
                              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                                {inspection.follow_up_date ? `By ${format(new Date(inspection.follow_up_date), "d MMM")}` : "Required"}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">No</span>
                            )}
                          </TableCell>
                          <TableCell>{getInspectionStatusBadge(inspection.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {inspection.status === "scheduled" ? (
                                <>
                                  <Button size="sm" onClick={() => setCompletingInspection(inspection as SafetyInspection)}>Complete</Button>
                                  <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => handleEditInspection(inspection as SafetyInspection)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setDeletingInspection(inspection as SafetyInspection)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </>
                              ) : (
                                <Button variant="ghost" size="icon" aria-label="Corrective actions"
                                  onClick={() => setActionsFor({ type: "safety_inspection", id: inspection.id, number: inspection.inspection_number,
                                    title: inspection.hazards_identified, canAdd: true })}>
                                  <ListChecks className="h-4 w-4" />
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
        </TabsContent>
      </Tabs>

      {/* Incident Dialogs */}
      <SafetyIncidentDialog
        open={incidentDialogOpen}
        onOpenChange={setIncidentDialogOpen}
        incident={editingIncident}
      />

      <DeleteConfirmDialog
        open={!!deletingIncident}
        onOpenChange={(open) => !open && setDeletingIncident(null)}
        onConfirm={handleDeleteIncident}
        title="Delete Incident"
        description={`Are you sure you want to delete incident "${deletingIncident?.incident_number}"? This action cannot be undone.`}
        isDeleting={deleteIncidentMutation.isPending}
      />

      <CloseIncidentDialog open={!!closingIncident} onOpenChange={(o) => !o && setClosingIncident(null)} incident={closingIncident} />
      <CompleteSafetyInspectionDialog open={!!completingInspection} onOpenChange={(o) => !o && setCompletingInspection(null)} inspection={completingInspection} />
      <CorrectiveActionsDialog
        open={!!actionsFor}
        onOpenChange={(o) => !o && setActionsFor(null)}
        sourceType={actionsFor?.type ?? "safety_incident"}
        source={actionsFor ? { id: actionsFor.id, number: actionsFor.number, title: actionsFor.title } : null}
        canAdd={!!actionsFor?.canAdd}
      />

      {/* Inspection Dialogs */}
      <SafetyInspectionDialog
        open={inspectionDialogOpen}
        onOpenChange={setInspectionDialogOpen}
        inspection={editingInspection}
      />

      <DeleteConfirmDialog
        open={!!deletingInspection}
        onOpenChange={(open) => !open && setDeletingInspection(null)}
        onConfirm={handleDeleteInspection}
        title="Delete Inspection"
        description={`Are you sure you want to delete inspection "${deletingInspection?.inspection_number}"? This action cannot be undone.`}
        isDeleting={deleteInspectionMutation.isPending}
      />
    </div>
  );
}
