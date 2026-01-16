import { useState } from "react";
import { MapPin, Package, Search } from "lucide-react";
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
import { useConstructionResources } from "@/hooks/construction/useConstructionResources";
import { useProjects } from "@/hooks/construction/useProjects";
import { RESOURCE_STATUSES } from "@/types/construction";

export function LocationWiseView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  const { data: resources, isLoading } = useConstructionResources();
  const { data: projects } = useProjects();

  // Filter for material resources only
  const materialResources = resources?.filter((r) => r.resource_type === "material") || [];
  
  const filteredResources = materialResources.filter((resource) => {
    const matchesSearch = resource.resource_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProject = projectFilter === "all" || resource.project_id === projectFilter;
    return matchesSearch && matchesProject;
  });

  // Group by project/location
  const groupedByLocation = filteredResources.reduce((acc, resource) => {
    const key = resource.project_id || "unassigned";
    const projectName = resource.project?.project_name || "Unassigned";
    if (!acc[key]) {
      acc[key] = {
        projectName,
        projectId: key,
        items: [],
      };
    }
    acc[key].items.push(resource);
    return acc;
  }, {} as Record<string, { projectName: string; projectId: string; items: typeof filteredResources }>);

  const getStatusBadge = (status: string) => {
    const statusConfig = RESOURCE_STATUSES.find((s) => s.value === status);
    return (
      <Badge className={statusConfig?.color || "bg-muted"}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search inventory items..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Filter by project/location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {projects?.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.project_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : Object.keys(groupedByLocation).length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No inventory allocations found
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {Object.entries(groupedByLocation).map(([locationId, location]) => {
            const totalAllocated = location.items.reduce((sum, a) => sum + (a.quantity_allocated || 0), 0);
            const totalUsed = location.items.reduce((sum, a) => sum + (a.quantity_used || 0), 0);
            const utilizationRate = totalAllocated > 0 ? Math.round((totalUsed / totalAllocated) * 100) : 0;

            return (
              <Card key={locationId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      {location.projectName}
                    </CardTitle>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">{location.items.length} Items</p>
                        <p className="text-xs text-muted-foreground">Allocated here</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{utilizationRate}%</p>
                        <p className="text-xs text-muted-foreground">Utilization</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Qty Allocated</TableHead>
                        <TableHead>Qty Used</TableHead>
                        <TableHead>Available</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {location.items.map((resource) => {
                        const available = (resource.quantity_allocated || 0) - (resource.quantity_used || 0);
                        return (
                          <TableRow key={resource.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                {resource.resource_name}
                              </div>
                            </TableCell>
                            <TableCell>{resource.quantity_allocated || 0}</TableCell>
                            <TableCell>{resource.quantity_used || 0}</TableCell>
                            <TableCell>
                              <span className={available < 10 ? "text-amber-600 font-medium" : ""}>
                                {available}
                              </span>
                            </TableCell>
                            <TableCell>{getStatusBadge(resource.status)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  
                  {/* Location Summary */}
                  <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Location Total:</span>
                    <div className="flex gap-6">
                      <span>
                        <strong>{totalAllocated.toLocaleString()}</strong> Allocated
                      </span>
                      <span>
                        <strong>{totalUsed.toLocaleString()}</strong> Used
                      </span>
                      <span>
                        <strong>{(totalAllocated - totalUsed).toLocaleString()}</strong> Available
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
