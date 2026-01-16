import { useState } from "react";
import { Package, Pencil, Trash2, Plus, Search } from "lucide-react";
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
import { useConstructionResources, useDeleteConstructionResource } from "@/hooks/construction/useConstructionResources";
import { RESOURCE_STATUSES, ConstructionResource } from "@/types/construction";
import { format } from "date-fns";
import { ResourceDialog, DeleteConfirmDialog } from "@/components/construction/dialogs";

export function InventoryWiseView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<ConstructionResource | null>(null);
  const [deletingResource, setDeletingResource] = useState<ConstructionResource | null>(null);

  const { data: resources, isLoading } = useConstructionResources();
  const deleteResourceMutation = useDeleteConstructionResource();

  // Filter for material resources only
  const materialResources = resources?.filter((r) => r.resource_type === "material") || [];
  
  const filteredResources = materialResources.filter((resource) => {
    const matchesSearch = resource.resource_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || resource.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Group by item name for inventory-wise view
  const groupedByItem = filteredResources.reduce((acc, resource) => {
    const key = resource.resource_name;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(resource);
    return acc;
  }, {} as Record<string, typeof filteredResources>);

  const getStatusBadge = (status: string) => {
    const statusConfig = RESOURCE_STATUSES.find((s) => s.value === status);
    return (
      <Badge className={statusConfig?.color || "bg-muted"}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const handleDelete = async () => {
    if (deletingResource) {
      await deleteResourceMutation.mutateAsync(deletingResource.id);
      setDeletingResource(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by item name..."
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
            {RESOURCE_STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => { setEditingResource(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Allocation
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : Object.keys(groupedByItem).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No inventory allocations found
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedByItem).map(([itemName, allocations]) => {
                const totalAllocated = allocations.reduce((sum, a) => sum + (a.quantity_allocated || 0), 0);
                const totalUsed = allocations.reduce((sum, a) => sum + (a.quantity_used || 0), 0);
                
                return (
                  <div key={itemName} className="border rounded-lg">
                    <div className="p-4 bg-muted/50 border-b flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <h3 className="font-semibold">{itemName}</h3>
                          <p className="text-sm text-muted-foreground">
                            {allocations.length} allocation(s)
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {totalUsed.toLocaleString()} / {totalAllocated.toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground">Used / Allocated</p>
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project</TableHead>
                          <TableHead>Qty Allocated</TableHead>
                          <TableHead>Qty Used</TableHead>
                          <TableHead>Remaining</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Start Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allocations.map((resource) => (
                          <TableRow key={resource.id}>
                            <TableCell>{resource.project?.project_name || "-"}</TableCell>
                            <TableCell>{resource.quantity_allocated || 0}</TableCell>
                            <TableCell>{resource.quantity_used || 0}</TableCell>
                            <TableCell>
                              {(resource.quantity_allocated || 0) - (resource.quantity_used || 0)}
                            </TableCell>
                            <TableCell>{getStatusBadge(resource.status)}</TableCell>
                            <TableCell>
                              {resource.start_date
                                ? format(new Date(resource.start_date), "MMM d, yyyy")
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => { setEditingResource(resource as ConstructionResource); setDialogOpen(true); }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeletingResource(resource as ConstructionResource)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ResourceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        resource={editingResource}
        defaultResourceType="material"
      />

      <DeleteConfirmDialog
        open={!!deletingResource}
        onOpenChange={(open) => !open && setDeletingResource(null)}
        onConfirm={handleDelete}
        title="Delete Inventory Allocation"
        description={`Are you sure you want to delete "${deletingResource?.resource_name}"? This action cannot be undone.`}
        isDeleting={deleteResourceMutation.isPending}
      />
    </div>
  );
}
