import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Wrench, AlertTriangle, CheckCircle, Package, MapPin, Building, Users, Loader2, MoreHorizontal, Edit, ArrowRightLeft, Trash2, Eye, BarChart3 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "@/hooks/use-toast";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import { useWarehouseAssets } from "@/hooks/useWarehouseAssets";
import { useAssetCategories } from "@/hooks/useAssetCategories";
import { useCompanies } from "@/hooks/useCompanies";
import { CategoryManagementDialog } from "@/components/warehouse/CategoryManagementDialog";
import { BulkAssetImportDialog } from "@/components/warehouse/BulkAssetImportDialog";
import { LocationManagementDialog } from "@/components/warehouse/LocationManagementDialog";
import { AssetDetailsDialog } from "@/components/warehouse/AssetDetailsDialog";
import { AssetEditDialog } from "@/components/warehouse/AssetEditDialog";
import { AssetTransferDialog } from "@/components/warehouse/AssetTransferDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { WarehouseAsset, WarehouseLocation, AssetCategory, CreateWarehouseAssetData, CreateWarehouseLocationData } from "@/types/warehouse";
import { AssetAnalytics } from "@/components/warehouse/AssetAnalytics";
import { BulkAssetUpdateDialog } from "@/components/warehouse/BulkAssetUpdateDialog";
import { AssetMasterTab } from "@/components/warehouse/AssetMasterTab";
import { AssetMasterSelector } from "@/components/common/AssetMasterSelector";
import { AssetMaster } from "@/types/assetMaster";

const assetFormSchema = z.object({
  asset_master_id: z.string().optional(),
  name: z.string().min(1, "Asset name is required"),
  quantity: z.string().transform(val => parseInt(val)).pipe(
    z.number().min(1, "Quantity must be at least 1").max(100, "Quantity cannot exceed 100")
  ),
  company_id: z.string().min(1, "Company is required"),
  category: z.string().optional(),
  category_id: z.string().min(1, "Category is required"),
  subcategory_id: z.string().optional(),
  brand: z.string().optional(),
  location_id: z.string().optional(),
  sublocation_id: z.string().optional(),
  department_id: z.string().optional(),
  condition: z.enum(["good", "fair", "poor", "needs_repair"]),
  status: z.enum(["active", "inactive", "maintenance", "disposed"]),
  purchase_date: z.string().optional(),
  purchase_price: z.string().optional(),
  current_value: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

type AssetFormValues = z.infer<typeof assetFormSchema>;

const getConditionBadge = (condition: string) => {
  const variants = {
    good: "bg-success/10 text-success border-success/20",
    fair: "bg-warning/10 text-warning border-warning/20", 
    poor: "bg-destructive/10 text-destructive border-destructive/20",
    needs_repair: "bg-destructive/20 text-destructive border-destructive/30",
  };
  return variants[condition as keyof typeof variants] || variants.good;
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "active":
      return <CheckCircle className="h-4 w-4 text-success" />;
    case "maintenance":
      return <Wrench className="h-4 w-4 text-warning" />;
    case "inactive":
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    case "disposed":
      return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Package className="h-4 w-4 text-muted-foreground" />;
  }
};

export default function AssetManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isCategoryManagementOpen, setIsCategoryManagementOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<WarehouseAsset | null>(null);
  const [selectedAssetMaster, setSelectedAssetMaster] = useState<AssetMaster | null>(null);
  
  const { 
    locations,
    isLoading: isLoadingLocations,
    error: locationsError
  } = useWarehouseLocations();
  
  const { 
    assets, 
    isLoading: assetsLoading, 
    createAsset, 
    createBulkAssets,
    updateAsset,
    deleteAsset,
    deleteBulkAssets,
    updateBulkAssets,
    isCreating: isCreatingAsset,
    isCreatingBulk,
    isUpdating,
    isDeleting,
    isDeletingBulk,
    isUpdatingBulk
  } = useWarehouseAssets();

  const { 
    mainCategories, 
    getSubcategories, 
    isLoading: categoriesLoading 
  } = useAssetCategories();

  const { 
    companies, 
    isLoading: companiesLoading 
  } = useCompanies();

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      asset_master_id: undefined,
      name: "",
      quantity: 1,
      company_id: "",
      category: "",
      category_id: "",
      subcategory_id: "",
      brand: "",
      location_id: "",
      sublocation_id: "",
      department_id: "",
      condition: "good",
      status: "active",
      purchase_date: "",
      purchase_price: "",
      current_value: "",
      description: "",
      notes: "",
    },
  });

  // Auto-fill form when Asset Master is selected
  useEffect(() => {
    if (selectedAssetMaster) {
      form.setValue("name", selectedAssetMaster.asset_name);
      if (selectedAssetMaster.brand) {
        form.setValue("brand", selectedAssetMaster.brand);
      }
      if (selectedAssetMaster.category_id) {
        form.setValue("category_id", selectedAssetMaster.category_id);
      }
      if (selectedAssetMaster.subcategory_id) {
        form.setValue("subcategory_id", selectedAssetMaster.subcategory_id);
      }
      if (selectedAssetMaster.purchase_price) {
        form.setValue("purchase_price", selectedAssetMaster.purchase_price.toString());
      }
      if (selectedAssetMaster.current_value) {
        form.setValue("current_value", selectedAssetMaster.current_value.toString());
      }
      if (selectedAssetMaster.description) {
        form.setValue("description", selectedAssetMaster.description);
      }
    }
  }, [selectedAssetMaster, form]);


  const onSubmit = (data: AssetFormValues) => {
    // Get category name from ID for backward compatibility
    const selectedCategory = mainCategories.find(cat => cat.id === data.category_id);
    
    const assetData = {
      name: data.name,
      asset_master_id: data.asset_master_id || undefined,
      category: selectedCategory?.name || "",
      category_id: data.category_id || undefined,
      subcategory_id: data.subcategory_id || undefined,
      brand: data.brand,
      condition: data.condition,
      status: data.status,
      location_id: data.location_id || undefined,
      sublocation_id: data.sublocation_id || undefined,
      department_id: data.department_id || undefined,
      purchase_date: data.purchase_date,
      purchase_price: data.purchase_price ? parseFloat(data.purchase_price) : undefined,
      current_value: data.current_value ? parseFloat(data.current_value) : undefined,
      description: data.description,
      notes: data.notes,
    };

    if (data.quantity === 1) {
      createAsset(assetData);
    } else {
      // Create array of identical assets for bulk creation
      const bulkAssets = Array.from({ length: data.quantity }, () => ({ ...assetData }));
      createBulkAssets(bulkAssets);
    }
    
    setIsDialogOpen(false);
    form.reset();
    setSelectedAssetMaster(null);
  };

  const handleSelectAsset = (assetId: string, checked: boolean) => {
    setSelectedAssetIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(assetId);
      } else {
        newSet.delete(assetId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAssetIds(new Set(filteredAssets.map(asset => asset.id)));
    } else {
      setSelectedAssetIds(new Set());
    }
  };

  const handleBulkDelete = () => {
    const assetIdsArray = Array.from(selectedAssetIds);
    deleteBulkAssets(assetIdsArray);
    setSelectedAssetIds(new Set());
    setBulkDeleteConfirmOpen(false);
  };

  const clearSelection = () => {
    setSelectedAssetIds(new Set());
  };

  const handleBulkUpdate = (updateData: Partial<WarehouseAsset>) => {
    const assetIdsArray = Array.from(selectedAssetIds);
    updateBulkAssets({ assetIds: assetIdsArray, updateData });
    setSelectedAssetIds(new Set());
  };


  const filteredAssets = assets.filter((asset) =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (asset.brand && asset.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (asset.asset_id && asset.asset_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getLocationsByType = (type: "location" | "sublocation" | "department", parentId?: string) => {
    if (type === "location") {
      return locations.filter(loc => loc.type === "location");
    } else if (type === "sublocation") {
      return locations.filter(loc => loc.type === "sublocation" && loc.parent_id === parentId);
    } else if (type === "department") {
      return locations.filter(loc => loc.type === "department" && loc.parent_id === parentId);
    }
    return [];
  };

  const getLocationName = (id: string) => {
    return locations.find(loc => loc.id === id)?.name || "";
  };

  const getFullLocationPath = (asset: WarehouseAsset) => {
    const parts = [];
    
    // Add main location
    if (asset.location_id) {
      const location = locations?.find(loc => loc.id === asset.location_id);
      if (location) parts.push(location.name);
    }
    
    // Add sublocation
    if (asset.sublocation_id) {
      const sublocation = locations?.find(loc => loc.id === asset.sublocation_id);
      if (sublocation) parts.push(sublocation.name);
    }
    
    // Add department
    if (asset.department_id) {
      const department = locations?.find(loc => loc.id === asset.department_id);
      if (department) parts.push(department.name);
    }
    
    return parts.length > 0 ? parts.join(" → ") : "—";
  };

  const getCategoryName = (id: string) => {
    return mainCategories.find(cat => cat.id === id)?.name || "";
  };

  const getSubcategoryName = (id: string) => {
    const allCategories = [...mainCategories];
    mainCategories.forEach(cat => {
      allCategories.push(...getSubcategories(cat.id));
    });
    return allCategories.find(cat => cat.id === id)?.name || "";
  };

  const totalValue = assets.reduce((sum, asset) => sum + (asset.purchase_price || 0), 0);
  const activeAssets = assets.filter(asset => asset.status === "active").length;
  const maintenanceAssets = assets.filter(asset => asset.status === "maintenance").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Asset Management</h1>
          <p className="text-muted-foreground">
            Track and manage warehouse assets, equipment, and machinery
          </p>
        </div>
        <div className="flex gap-2">
          <BulkAssetImportDialog />
          <CategoryManagementDialog />
          <LocationManagementDialog />

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Asset
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Asset</DialogTitle>
                <DialogDescription>
                  Create a new warehouse asset with details and location information.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="asset_master_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select from Asset Master (Optional)</FormLabel>
                        <FormControl>
                          <AssetMasterSelector
                            value={field.value}
                            onValueChange={field.onChange}
                            onAssetSelected={setSelectedAssetMaster}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedAssetMaster && (
                    <div className="p-3 bg-muted rounded-lg flex items-start gap-3">
                      {selectedAssetMaster.image_url && (
                        <img
                          src={selectedAssetMaster.image_url}
                          alt={selectedAssetMaster.asset_name}
                          className="h-16 w-16 rounded object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{selectedAssetMaster.asset_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedAssetMaster.brand && `${selectedAssetMaster.brand} • `}
                          {selectedAssetMaster.purchase_price && `LKR ${selectedAssetMaster.purchase_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          ✓ Form fields auto-filled from Asset Master
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asset Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter asset name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1" 
                              max="100"
                              placeholder="1" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                          <p className="text-xs text-muted-foreground">
                            Number of identical assets to create
                          </p>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="company_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select company" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background border shadow-md z-50">
                              {companies?.map((company) => (
                                <SelectItem key={company.id} value={company.id}>
                                  {company.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="category_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background border shadow-md z-50">
                              <SelectItem value="none">None (Required)</SelectItem>
                              {mainCategories
                                .filter(category => category.id && category.id.trim() !== "")
                                .map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="brand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Brand</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter brand" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="subcategory_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subcategory (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select subcategory" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background border shadow-md z-50">
                              <SelectItem value="none">None (Optional)</SelectItem>
                              {form.watch("category_id") && form.watch("category_id") !== "none" && getSubcategories(form.watch("category_id"))
                                .filter(subcategory => subcategory.id && subcategory.id.trim() !== "")
                                .map((subcategory) => (
                                <SelectItem key={subcategory.id} value={subcategory.id}>
                                  {subcategory.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="condition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Condition</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select condition" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background border shadow-md z-50">
                              <SelectItem value="good">Good</SelectItem>
                              <SelectItem value="fair">Fair</SelectItem>
                              <SelectItem value="poor">Poor</SelectItem>
                              <SelectItem value="needs_repair">Needs Repair</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background border shadow-md z-50">
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                              <SelectItem value="maintenance">Maintenance</SelectItem>
                              <SelectItem value="disposed">Disposed</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="location_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                            </FormControl>
                             <SelectContent className="bg-background border shadow-md z-50">
                               <SelectItem value="none">None (Optional)</SelectItem>
                               {isLoadingLocations ? (
                                 <SelectItem value="" disabled>Loading locations...</SelectItem>
                               ) : locations.length === 0 ? (
                                 <SelectItem value="" disabled>No locations available</SelectItem>
                               ) : (
                                 getLocationsByType("location").map((location) => (
                                   <SelectItem key={location.id} value={location.id}>
                                     {location.name}
                                   </SelectItem>
                                 ))
                               )}
                             </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sublocation_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sublocation</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select sublocation" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background border shadow-md z-50">
                              <SelectItem value="none">None (Optional)</SelectItem>
                              {form.watch("location_id") && form.watch("location_id") !== "none" && getLocationsByType("sublocation", form.watch("location_id")).map((sublocation) => (
                                <SelectItem key={sublocation.id} value={sublocation.id}>
                                  {sublocation.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="department_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select department" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background border shadow-md z-50">
                              <SelectItem value="none">None (Optional)</SelectItem>
                              {form.watch("sublocation_id") && form.watch("sublocation_id") !== "none" && getLocationsByType("department", form.watch("sublocation_id")).map((department) => (
                                <SelectItem key={department.id} value={department.id}>
                                  {department.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="purchase_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purchase Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="purchase_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purchase Price</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="current_value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Value</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter asset description"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Additional notes or comments"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isCreatingAsset || isCreatingBulk}>
                      {(isCreatingAsset || isCreatingBulk) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Asset{form.watch("quantity") > 1 ? `s (${form.watch("quantity")})` : ""}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs for Assets List and Analytics */}
      <Tabs defaultValue="assets-list" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="assets-list" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Assets List
          </TabsTrigger>
          <TabsTrigger value="asset-master" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Asset Master
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assets-list" className="space-y-6 mt-6">
          {/* Asset Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{assets.length}</div>
                <p className="text-xs text-muted-foreground">
                  All registered assets
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Assets</CardTitle>
                <CheckCircle className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{activeAssets}</div>
                <p className="text-xs text-muted-foreground">
                  Currently in use
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
                <Wrench className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">{maintenanceAssets}</div>
                <p className="text-xs text-muted-foreground">
                  Under maintenance
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Rs. {totalValue.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  Asset portfolio value
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filter */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-1 items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assets by name, category, brand, or asset ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            
            {selectedAssetIds.size > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                <span className="text-sm text-muted-foreground">
                  {selectedAssetIds.size} asset{selectedAssetIds.size > 1 ? 's' : ''} selected
                </span>
                <Button
                  size="sm"
                  onClick={() => setIsBulkUpdateOpen(true)}
                  disabled={isUpdatingBulk}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Update Selected
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteConfirmOpen(true)}
                  disabled={isDeletingBulk}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete Selected
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                >
                  Clear
                </Button>
              </div>
            )}
          </div>

          {/* Assets Table */}
          <Card>
            <CardHeader>
              <CardTitle>Asset Inventory</CardTitle>
              <CardDescription>
                Manage all warehouse assets and their details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={filteredAssets.length > 0 && selectedAssetIds.size === filteredAssets.length}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Asset ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assetsLoading ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center">
                          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                          Loading assets...
                        </TableCell>
                      </TableRow>
                    ) : filteredAssets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground">
                          No assets found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAssets.map((asset) => (
                        <TableRow key={asset.id} className={selectedAssetIds.has(asset.id) ? "bg-muted/50" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={selectedAssetIds.has(asset.id)}
                              onCheckedChange={(checked) => handleSelectAsset(asset.id, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {asset.asset_id || "Auto-generated"}
                          </TableCell>
                          <TableCell className="font-medium">{asset.name}</TableCell>
                          <TableCell>{asset.category}</TableCell>
                          <TableCell>{asset.brand || "—"}</TableCell>
                          <TableCell>
                            {getFullLocationPath(asset)}
                          </TableCell>
                          <TableCell>
                            <Badge className={getConditionBadge(asset.condition)} variant="outline">
                              {asset.condition.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(asset.status)}
                              <span className="capitalize">{asset.status}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            Rs. {(asset.current_value || asset.purchase_price || 0).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  setSelectedAsset(asset);
                                  setIsDetailsDialogOpen(true);
                                }}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setSelectedAsset(asset);
                                  setIsEditDialogOpen(true);
                                }}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setSelectedAsset(asset);
                                  setIsTransferDialogOpen(true);
                                }}>
                                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                                  Transfer
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => {
                                    setSelectedAsset(asset);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="asset-master" className="space-y-6 mt-6">
          <AssetMasterTab />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <AssetAnalytics 
            assets={assets}
            locations={locations}
            categories={[...mainCategories, ...mainCategories.flatMap(cat => getSubcategories(cat.id))]}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AssetDetailsDialog
        asset={selectedAsset}
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        onEdit={(asset) => {
          setSelectedAsset(asset);
          setIsEditDialogOpen(true);
          setIsDetailsDialogOpen(false);
        }}
        locations={locations}
        categories={[...mainCategories, ...mainCategories.flatMap(cat => getSubcategories(cat.id))]}
        getLocationName={getLocationName}
        getCategoryName={getCategoryName}
        getSubcategoryName={getSubcategoryName}
      />

      <AssetEditDialog
        asset={selectedAsset}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        locations={locations}
        categories={[...mainCategories, ...mainCategories.flatMap(cat => getSubcategories(cat.id))]}
        getLocationsByType={getLocationsByType}
      />

      <AssetTransferDialog
        asset={selectedAsset}
        open={isTransferDialogOpen}
        onOpenChange={setIsTransferDialogOpen}
        locations={locations}
        getLocationsByType={getLocationsByType}
        getLocationName={getLocationName}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the asset "{selectedAsset?.name}" and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedAsset) {
                  deleteAsset(selectedAsset.id);
                  setIsDeleteDialogOpen(false);
                  setSelectedAsset(null);
                }
              }}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Assets</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedAssetIds.size} selected asset{selectedAssetIds.size > 1 ? 's' : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingBulk}
            >
              {isDeletingBulk ? "Deleting..." : `Delete ${selectedAssetIds.size} Asset${selectedAssetIds.size > 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkAssetUpdateDialog
        open={isBulkUpdateOpen}
        onOpenChange={setIsBulkUpdateOpen}
        selectedAssetIds={selectedAssetIds}
        locations={locations}
        getLocationsByType={getLocationsByType}
        onUpdate={handleBulkUpdate}
        isUpdating={isUpdatingBulk}
      />
    </div>
  );
}