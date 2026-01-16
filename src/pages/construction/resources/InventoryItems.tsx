import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Search, Pencil, Trash2, Package } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConstructionResources, useDeleteConstructionResource } from "@/hooks/construction/useConstructionResources";
import { useInventoryMaster, useDeleteInventoryMaster } from "@/hooks/construction/useInventoryMaster";
import { RESOURCE_STATUSES, ConstructionResource } from "@/types/construction";
import { format } from "date-fns";
import { ResourceDialog, DeleteConfirmDialog } from "@/components/construction/dialogs";
import { InventoryMasterDialog } from "@/components/construction/dialogs/InventoryMasterDialog";
import type { InventoryMaster } from "@/types/construction";

export default function InventoryItems() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("allocation");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Allocation state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<ConstructionResource | null>(null);
  const [deletingResource, setDeletingResource] = useState<ConstructionResource | null>(null);
  
  // Master list state
  const [masterDialogOpen, setMasterDialogOpen] = useState(false);
  const [editingMaster, setEditingMaster] = useState<InventoryMaster | null>(null);
  const [deletingMaster, setDeletingMaster] = useState<InventoryMaster | null>(null);

  // Hooks
  const { data: resources, isLoading: resourcesLoading } = useConstructionResources();
  const deleteResourceMutation = useDeleteConstructionResource();
  
  const { data: inventoryMaster, isLoading: masterLoading } = useInventoryMaster();
  const deleteInventoryMutation = useDeleteInventoryMaster();

  // Filter for material resources only
  const materialResources = resources?.filter((r) => r.resource_type === "material");
  const filteredResources = materialResources?.filter((resource) =>
    resource.resource_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMaster = inventoryMaster?.filter((item) =>
    item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statusConfig = RESOURCE_STATUSES.find((s) => s.value === status);
    return (
      <Badge className={statusConfig?.color || "bg-muted"}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const handleDeleteResource = async () => {
    if (deletingResource) {
      await deleteResourceMutation.mutateAsync(deletingResource.id);
      setDeletingResource(null);
    }
  };

  const handleDeleteMaster = async () => {
    if (deletingMaster) {
      await deleteInventoryMutation.mutateAsync(deletingMaster.id);
      setDeletingMaster(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/construction/resource-allocation")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Items</h1>
          <p className="text-muted-foreground">
            Manage inventory allocations and item master
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="allocation">Allocation View</TabsTrigger>
          <TabsTrigger value="master">Item Master</TabsTrigger>
        </TabsList>

        <TabsContent value="allocation" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search inventory allocations..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button onClick={() => { setEditingResource(null); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Allocation
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              {resourcesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Qty Allocated</TableHead>
                      <TableHead>Qty Used</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResources?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No inventory allocations found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredResources?.map((resource) => (
                        <TableRow key={resource.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              {resource.resource_name}
                            </div>
                          </TableCell>
                          <TableCell>{resource.project?.project_name || "-"}</TableCell>
                          <TableCell>{resource.quantity_allocated || 0}</TableCell>
                          <TableCell>{resource.quantity_used || 0}</TableCell>
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
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="master" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search item master..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button onClick={() => { setEditingMaster(null); setMasterDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              {masterLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Unit Cost</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMaster?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No inventory items found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMaster?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.item_code || "-"}</TableCell>
                          <TableCell>{item.item_name}</TableCell>
                          <TableCell>{item.category || "-"}</TableCell>
                          <TableCell>{item.unit || "-"}</TableCell>
                          <TableCell>{item.unit_cost ? `$${item.unit_cost.toFixed(2)}` : "-"}</TableCell>
                          <TableCell>
                            <Badge variant={item.status === "active" ? "default" : "secondary"}>
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setEditingMaster(item); setMasterDialogOpen(true); }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingMaster(item)}
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
      </Tabs>

      <ResourceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        resource={editingResource}
        defaultResourceType="material"
      />

      <InventoryMasterDialog
        open={masterDialogOpen}
        onOpenChange={setMasterDialogOpen}
        item={editingMaster}
      />

      <DeleteConfirmDialog
        open={!!deletingResource}
        onOpenChange={(open) => !open && setDeletingResource(null)}
        onConfirm={handleDeleteResource}
        title="Delete Inventory Allocation"
        description={`Are you sure you want to delete "${deletingResource?.resource_name}"? This action cannot be undone.`}
        isDeleting={deleteResourceMutation.isPending}
      />

      <DeleteConfirmDialog
        open={!!deletingMaster}
        onOpenChange={(open) => !open && setDeletingMaster(null)}
        onConfirm={handleDeleteMaster}
        title="Delete Inventory Item"
        description={`Are you sure you want to delete "${deletingMaster?.item_name}"? This action cannot be undone.`}
        isDeleting={deleteInventoryMutation.isPending}
      />
    </div>
  );
}
