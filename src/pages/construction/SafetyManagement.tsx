import { useState } from "react";
import { Plus, Search, ShieldAlert, AlertTriangle, ClipboardCheck, FileWarning } from "lucide-react";
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
import { useSafetyIncidents, useSafetyInspections } from "@/hooks/construction/useSafetyManagement";
import { INCIDENT_STATUSES, INCIDENT_SEVERITIES, SAFETY_INSPECTION_STATUSES } from "@/types/construction";
import { format } from "date-fns";

export default function SafetyManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [incidentStatusFilter, setIncidentStatusFilter] = useState<string>("all");
  const [inspectionStatusFilter, setInspectionStatusFilter] = useState<string>("all");
  
  const { data: incidents, isLoading: incidentsLoading } = useSafetyIncidents();
  const { data: inspections, isLoading: inspectionsLoading } = useSafetyInspections();

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
                <Button>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIncidents?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                          <TableCell>{getIncidentStatusBadge(incident.status)}</TableCell>
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
                <Button>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInspections?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                                Required
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">No</span>
                            )}
                          </TableCell>
                          <TableCell>{getInspectionStatusBadge(inspection.status)}</TableCell>
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
    </div>
  );
}
