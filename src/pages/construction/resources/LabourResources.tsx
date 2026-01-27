import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Search, Pencil, Trash2, Users, LayoutDashboard, UserSquare2, MapPin, Upload } from "lucide-react";
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
import { useLabourMaster, useDeleteLabourMaster } from "@/hooks/construction/useLabourMaster";
import { RESOURCE_STATUSES } from "@/types/construction";
import type { ConstructionResource, LabourMaster } from "@/types/construction";
import { format } from "date-fns";
import { ResourceDialog } from "@/components/construction/dialogs/ResourceDialog";
import { DeleteConfirmDialog } from "@/components/construction/dialogs/DeleteConfirmDialog";
import { LabourMasterDialog } from "@/components/construction/dialogs/LabourMasterDialog";
import { LabourDashboard, LabourWiseView, LabourLocationWiseView } from "@/components/construction/labour";
import { LabourBulkImportDialog } from "@/components/construction/labour/LabourBulkImportDialog";

export default function LabourResources() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("allocation");
  const [allocationSubTab, setAllocationSubTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Allocation state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<ConstructionResource | null>(null);
  const [deletingResource, setDeletingResource] = useState<ConstructionResource | null>(null);
  
  // Master list state
  const [masterDialogOpen, setMasterDialogOpen] = useState(false);
  const [editingMaster, setEditingMaster] = useState<LabourMaster | null>(null);
  const [deletingMaster, setDeletingMaster] = useState<LabourMaster | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  // Hooks
  const { data: resources, isLoading: resourcesLoading } = useConstructionResources();
  const deleteResourceMutation = useDeleteConstructionResource();
  
  const { data: labourMaster, isLoading: masterLoading } = useLabourMaster();
  const deleteLabourMutation = useDeleteLabourMaster();

  // Filter for labour resources only
  const labourResources = resources?.filter((r) => r.resource_type === "labor");
  const filteredResources = labourResources?.filter((resource) =>
    resource.resource_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMaster = labourMaster?.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.trade?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.labour_company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.epf_no?.toLowerCase().includes(searchTerm.toLowerCase())
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
      await deleteLabourMutation.mutateAsync(deletingMaster.id);
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
          <h1 className="text-3xl font-bold tracking-tight">Labour Resources</h1>
          <p className="text-muted-foreground">
            Manage labour allocations and master list
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="allocation">Allocation View</TabsTrigger>
          <TabsTrigger value="master">Labour Master List</TabsTrigger>
        </TabsList>

        <TabsContent value="allocation" className="space-y-4">
          {/* Sub-tabs for Allocation View */}
          <div className="flex items-center gap-2 border-b pb-2">
            <Button
              variant={allocationSubTab === "dashboard" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setAllocationSubTab("dashboard")}
              className="gap-2"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
            <Button
              variant={allocationSubTab === "labour-wise" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setAllocationSubTab("labour-wise")}
              className="gap-2"
            >
              <UserSquare2 className="h-4 w-4" />
              Labour Wise
            </Button>
            <Button
              variant={allocationSubTab === "location-wise" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setAllocationSubTab("location-wise")}
              className="gap-2"
            >
              <MapPin className="h-4 w-4" />
              Location Wise
            </Button>
          </div>

          {/* Sub-tab Content */}
          {allocationSubTab === "dashboard" && <LabourDashboard />}
          {allocationSubTab === "labour-wise" && <LabourWiseView />}
          {allocationSubTab === "location-wise" && <LabourLocationWiseView />}
        </TabsContent>

        <TabsContent value="master" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search labour master..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setBulkImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import Data
              </Button>
              <Button onClick={() => { setEditingMaster(null); setMasterDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Labour
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              {masterLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>EPF No</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMaster?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No labour records found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredMaster?.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-sm">{item.employee_id || "-"}</TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.epf_no || "-"}</TableCell>
                            <TableCell>{item.category || "-"}</TableCell>
                            <TableCell>{item.labour_company || "-"}</TableCell>
                            <TableCell>{item.contact_number || "-"}</TableCell>
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
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ResourceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        resource={editingResource}
        defaultResourceType="labor"
      />

      <LabourMasterDialog
        open={masterDialogOpen}
        onOpenChange={setMasterDialogOpen}
        labour={editingMaster}
      />

      <DeleteConfirmDialog
        open={!!deletingResource}
        onOpenChange={(open) => !open && setDeletingResource(null)}
        onConfirm={handleDeleteResource}
        title="Delete Labour Allocation"
        description={`Are you sure you want to delete "${deletingResource?.resource_name}"? This action cannot be undone.`}
        isDeleting={deleteResourceMutation.isPending}
      />

      <DeleteConfirmDialog
        open={!!deletingMaster}
        onOpenChange={(open) => !open && setDeletingMaster(null)}
        onConfirm={handleDeleteMaster}
        title="Delete Labour Record"
        description={`Are you sure you want to delete "${deletingMaster?.name}"? This action cannot be undone.`}
        isDeleting={deleteLabourMutation.isPending}
      />

      <LabourBulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
      />
    </div>
  );
}
