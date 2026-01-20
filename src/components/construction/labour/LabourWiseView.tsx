import { useState } from "react";
import { Search, Pencil, Trash2, Users, Filter, Building2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { useLabourMaster, useDeleteLabourMaster } from "@/hooks/construction/useLabourMaster";
import { useProjects } from "@/hooks/construction/useProjects";
import { LabourAllocationDialog } from "@/components/construction/dialogs/LabourAllocationDialog";
import { LabourDetailsDialog } from "@/components/construction/dialogs/LabourDetailsDialog";
import { DeleteConfirmDialog } from "@/components/construction/dialogs/DeleteConfirmDialog";
import type { LabourMaster } from "@/types/construction";

export function LabourWiseView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLabour, setEditingLabour] = useState<LabourMaster | null>(null);
  const [deletingLabour, setDeletingLabour] = useState<LabourMaster | null>(null);
  const [viewingLabour, setViewingLabour] = useState<LabourMaster | null>(null);

  const { data: labourMaster, isLoading } = useLabourMaster();
  const { data: projects = [] } = useProjects();
  const deleteLabourMutation = useDeleteLabourMaster();

  // Get unique categories and companies from data
  const uniqueCategories = [...new Set(labourMaster?.map(l => l.category).filter(Boolean))];
  const uniqueCompanies = [...new Set(labourMaster?.map(l => l.labour_company).filter(Boolean))];

  // Create a map for project lookup
  const projectMap = new Map(projects.map(p => [p.id, p]));

  // Filter labour data
  const filteredLabour = labourMaster?.filter((labour) => {
    const matchesSearch =
      labour.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      labour.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      labour.epf_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      labour.trade?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === "all" || labour.category === categoryFilter;
    const matchesCompany = companyFilter === "all" || labour.labour_company === companyFilter;
    const matchesStatus = statusFilter === "all" || labour.status === statusFilter;
    const matchesProject = projectFilter === "all" || 
      (projectFilter === "__unassigned__" && !labour.project_id) ||
      labour.project_id === projectFilter;

    return matchesSearch && matchesCategory && matchesCompany && matchesStatus && matchesProject;
  });

  const handleDelete = async () => {
    if (deletingLabour) {
      await deleteLabourMutation.mutateAsync(deletingLabour.id);
      setDeletingLabour(null);
    }
  };

  const handleEdit = (labour: LabourMaster) => {
    setEditingLabour(labour);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-1 gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, ID, EPF, trade..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {uniqueCategories.map((cat) => (
                <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {uniqueCompanies.map((comp) => (
                <SelectItem key={comp} value={comp!}>{comp}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[200px]">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.project_code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>Showing {filteredLabour?.length || 0} of {labourMaster?.length || 0} labour records</span>
      </div>

      {/* Labour Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>EPF No</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Trade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLabour?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No labour records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLabour?.map((labour) => {
                    const project = labour.project_id ? projectMap.get(labour.project_id) : null;
                    return (
                      <TableRow key={labour.id}>
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {labour.employee_id || "-"}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{labour.name}</TableCell>
                        <TableCell>{labour.epf_no || "-"}</TableCell>
                        <TableCell>
                          {labour.category ? (
                            <Badge variant="outline">{labour.category}</Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {labour.labour_company ? (
                            <Badge variant="secondary">{labour.labour_company}</Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {project ? (
                            <Badge variant="default" className="font-normal">
                              {project.project_code}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>{labour.trade || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={labour.status === "active" ? "default" : "secondary"}>
                            {labour.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewingLabour(labour)}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(labour)}
                              title="Edit Allocation"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingLabour(labour)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <LabourDetailsDialog
        open={!!viewingLabour}
        onOpenChange={(open) => !open && setViewingLabour(null)}
        labour={viewingLabour}
      />

      <LabourAllocationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        labour={editingLabour}
      />

      <DeleteConfirmDialog
        open={!!deletingLabour}
        onOpenChange={(open) => !open && setDeletingLabour(null)}
        onConfirm={handleDelete}
        title="Delete Labour Record"
        description={`Are you sure you want to delete "${deletingLabour?.name}"? This action cannot be undone.`}
        isDeleting={deleteLabourMutation.isPending}
      />
    </div>
  );
}
