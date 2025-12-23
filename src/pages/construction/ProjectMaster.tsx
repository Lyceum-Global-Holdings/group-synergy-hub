import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Eye, Pencil, Trash2, Layers, Warehouse } from "lucide-react";
import { useProjects } from "@/hooks/construction/useProjects";
import { useDeleteProject } from "@/hooks/construction/useProjectMutations";
import { ConstructionProject, PROJECT_STATUSES } from "@/types/construction";
import { format } from "date-fns";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreateProjectDialog } from "@/components/construction/CreateProjectDialog";
import { ProjectDetailsDialog } from "@/components/construction/ProjectDetailsDialog";
import { FloorDrawingsDialog } from "@/components/construction/FloorDrawingsDialog";
import { ProjectWarehouseAllocationDialog } from "@/components/construction/ProjectWarehouseAllocationDialog";

export default function ProjectMaster() {
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ConstructionProject | null>(null);
  const [viewingProject, setViewingProject] = useState<ConstructionProject | null>(null);
  const [deletingProject, setDeletingProject] = useState<ConstructionProject | null>(null);
  const [floorDrawingsProject, setFloorDrawingsProject] = useState<ConstructionProject | null>(null);
  const [warehouseProject, setWarehouseProject] = useState<ConstructionProject | null>(null);

  const { data: projects = [], isLoading } = useProjects();
  const deleteProject = useDeleteProject();

  const filteredProjects = projects.filter(
    (project) =>
      project.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.project_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statusConfig = PROJECT_STATUSES.find((s) => s.value === status);
    return (
      <Badge className={statusConfig?.color || "bg-gray-100 text-gray-800"}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleDelete = async () => {
    if (deletingProject) {
      await deleteProject.mutateAsync(deletingProject.id);
      setDeletingProject(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Project Master</h1>
          <p className="text-muted-foreground">
            Manage construction projects and track progress
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Projects</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No projects found. Create your first project to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project Code</TableHead>
                  <TableHead>Project Name</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">
                      {project.project_code}
                    </TableCell>
                    <TableCell>{project.project_name}</TableCell>
                    <TableCell>{project.client_name || "-"}</TableCell>
                    <TableCell className="capitalize">
                      {project.project_type || "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(project.status)}</TableCell>
                    <TableCell>
                      {project.start_date
                        ? format(new Date(project.start_date), "MMM d, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>{formatCurrency(project.estimated_budget)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{
                              width: `${project.completion_percentage || 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm">
                          {project.completion_percentage || 0}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setViewingProject(project)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setFloorDrawingsProject(project)}
                          title="Floor Drawings"
                        >
                          <Layers className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setWarehouseProject(project)}
                          title="Warehouse Allocation"
                        >
                          <Warehouse className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingProject(project);
                            setCreateDialogOpen(true);
                          }}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingProject(project)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) setEditingProject(null);
        }}
        editingProject={editingProject}
      />

      <ProjectDetailsDialog
        project={viewingProject}
        open={!!viewingProject}
        onOpenChange={(open) => !open && setViewingProject(null)}
      />

      <FloorDrawingsDialog
        project={floorDrawingsProject}
        open={!!floorDrawingsProject}
        onOpenChange={(open) => !open && setFloorDrawingsProject(null)}
      />

      <ProjectWarehouseAllocationDialog
        project={warehouseProject}
        open={!!warehouseProject}
        onOpenChange={(open) => !open && setWarehouseProject(null)}
      />

      <AlertDialog
        open={!!deletingProject}
        onOpenChange={(open) => !open && setDeletingProject(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingProject?.project_name}"?
              This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
