import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Search, Pencil, Trash2, Package, LayoutDashboard, Boxes, MapPin, ArrowRightLeft, Wrench, Image as ImageIcon } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConstructionResources, useDeleteConstructionResource } from "@/hooks/construction/useConstructionResources";
import { useInventoryMaster, useDeleteInventoryMaster } from "@/hooks/construction/useInventoryMaster";
import { RESOURCE_STATUSES, ConstructionResource } from "@/types/construction";
import { format } from "date-fns";
import { ResourceDialog, DeleteConfirmDialog } from "@/components/construction/dialogs";
import { InventoryMasterDialog } from "@/components/construction/dialogs/InventoryMasterDialog";
import type { InventoryMaster } from "@/types/construction";
import {
  AllocationDashboard,
  InventoryWiseView,
  LocationWiseView,
  TransfersView,
  ServiceRepairView,
} from "@/components/construction/inventory";

// Predefined Section values
const INVENTORY_SECTIONS = [
  { value: "civil", label: "Civil" },
  { value: "mechanical", label: "Mechanical" },
  { value: "carpenter", label: "Carpenter" },
  { value: "mep", label: "MEP" },
  { value: "aluminium", label: "Aluminium" },
];

// Predefined Category values
const INVENTORY_CATEGORIES = [
  { value: "machines", label: "Machines" },
  { value: "tools", label: "Tools" },
  { value: "equipments", label: "Equipments" },
  { value: "scaffolding", label: "Scaffolding" },
  { value: "materials", label: "Materials" },
  { value: "safety", label: "Safety" },
];

// Allocation sub-tabs
const ALLOCATION_TABS = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "inventory-wise", label: "Inventory Wise", icon: Boxes },
  { value: "location-wise", label: "Location Wise", icon: MapPin },
  { value: "transfers", label: "Transfers", icon: ArrowRightLeft },
  { value: "service-repair", label: "Service & Repair", icon: Wrench },
];

export default function InventoryItems() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("allocation");
  const [allocationSubTab, setAllocationSubTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  
  // Master list state
  const [masterDialogOpen, setMasterDialogOpen] = useState(false);
  const [editingMaster, setEditingMaster] = useState<InventoryMaster | null>(null);
  const [deletingMaster, setDeletingMaster] = useState<InventoryMaster | null>(null);

  // Hooks
  const { data: inventoryMaster, isLoading: masterLoading } = useInventoryMaster();
  const deleteInventoryMutation = useDeleteInventoryMaster();

  const filteredMaster = inventoryMaster?.filter((item) => {
    const matchesSearch = 
      item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.section?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSection = sectionFilter === "all" || item.section === sectionFilter;
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    
    return matchesSearch && matchesSection && matchesCategory;
  });

  const handleDeleteMaster = async () => {
    if (deletingMaster) {
      await deleteInventoryMutation.mutateAsync(deletingMaster.id);
      setDeletingMaster(null);
    }
  };

  const getSectionLabel = (value: string | null) => {
    if (!value) return "-";
    return INVENTORY_SECTIONS.find(s => s.value === value)?.label || value;
  };

  const getCategoryLabel = (value: string | null) => {
    if (!value) return "-";
    return INVENTORY_CATEGORIES.find(c => c.value === value)?.label || value;
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
          {/* Allocation Sub-Tabs */}
          <div className="border-b">
            <div className="flex gap-1">
              {ALLOCATION_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setAllocationSubTab(tab.value)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      allocationSubTab === tab.value
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Allocation Sub-Tab Content */}
          {allocationSubTab === "dashboard" && <AllocationDashboard />}
          {allocationSubTab === "inventory-wise" && <InventoryWiseView />}
          {allocationSubTab === "location-wise" && <LocationWiseView />}
          {allocationSubTab === "transfers" && <TransfersView />}
          {allocationSubTab === "service-repair" && <ServiceRepairView />}
        </TabsContent>

        <TabsContent value="master" className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                {INVENTORY_SECTIONS.map((section) => (
                  <SelectItem key={section.value} value={section.value}>
                    {section.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {INVENTORY_CATEGORIES.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                      <TableHead className="w-[60px]">Image</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Item Category</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Unit Cost</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMaster?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No inventory items found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMaster?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.item_name}
                                className="w-10 h-10 object-cover rounded"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{item.item_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getSectionLabel(item.section)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {getCategoryLabel(item.category)}
                            </Badge>
                          </TableCell>
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

      <InventoryMasterDialog
        open={masterDialogOpen}
        onOpenChange={setMasterDialogOpen}
        item={editingMaster}
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
