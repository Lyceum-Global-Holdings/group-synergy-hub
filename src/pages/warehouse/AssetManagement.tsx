import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Search, Wrench, AlertTriangle, CheckCircle, Package, MapPin, Building, Users, Loader2, MoreHorizontal, Edit, ArrowRightLeft, Trash2, Eye } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "@/hooks/use-toast";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import { useWarehouseAssets } from "@/hooks/useWarehouseAssets";
import { useAssetCategories } from "@/hooks/useAssetCategories";
import { CategoryManagementDialog } from "@/components/warehouse/CategoryManagementDialog";
import { BulkAssetImportDialog } from "@/components/warehouse/BulkAssetImportDialog";
import { AssetDetailsDialog } from "@/components/warehouse/AssetDetailsDialog";
import { AssetEditDialog } from "@/components/warehouse/AssetEditDialog";
import { AssetTransferDialog } from "@/components/warehouse/AssetTransferDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { WarehouseAsset, WarehouseLocation, AssetCategory, CreateWarehouseAssetData, CreateWarehouseLocationData } from "@/types/warehouse";

const assetFormSchema = z.object({
  name: z.string().min(1, "Asset name is required"),
  quantity: z.string().transform(val => parseInt(val)).pipe(
    z.number().min(1, "Quantity must be at least 1").max(100, "Quantity cannot exceed 100")
  ),
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

const locationFormSchema = z.object({
  name: z.string().min(1, "Location name is required"),
  type: z.enum(["location", "sublocation", "department"]),
  parentId: z.string().optional(),
  description: z.string().optional(),
});

type AssetFormValues = z.infer<typeof assetFormSchema>;
type LocationFormValues = z.infer<typeof locationFormSchema>;

const getConditionBadge = (condition: string) => {
  const variants = {
    good: "bg-blue-100 text-blue-800 border-blue-200",
    fair: "bg-yellow-100 text-yellow-800 border-yellow-200",
    poor: "bg-red-100 text-red-800 border-red-200",
    needs_repair: "bg-orange-100 text-orange-800 border-orange-200",
  };
  return variants[condition as keyof typeof variants] || variants.good;
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "active":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "maintenance":
      return <Wrench className="h-4 w-4 text-yellow-600" />;
    case "inactive":
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    case "disposed":
      return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    default:
      return <Package className="h-4 w-4 text-gray-600" />;
  }
};

export default function AssetManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isCategoryManagementOpen, setIsCategoryManagementOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<WarehouseAsset | null>(null);
  
  const { 
    locations, 
    isLoading: locationsLoading, 
    createLocation, 
    isCreating: isCreatingLocation 
  } = useWarehouseLocations();
  
  const { 
    assets, 
    isLoading: assetsLoading, 
    createAsset, 
    createBulkAssets,
    updateAsset,
    deleteAsset,
    isCreating: isCreatingAsset,
    isCreatingBulk,
    isUpdating,
    isDeleting
  } = useWarehouseAssets();

  const { 
    mainCategories, 
    getSubcategories, 
    isLoading: categoriesLoading 
  } = useAssetCategories();

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      name: "",
      quantity: 1,
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

  const locationForm = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      name: "",
      type: "location",
      parentId: "",
      description: "",
    },
  });

  const onSubmit = (data: AssetFormValues) => {
    // Get category name from ID for backward compatibility
    const selectedCategory = mainCategories.find(cat => cat.id === data.category_id);
    
    const assetData = {
      name: data.name,
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
  };

  const onLocationSubmit = (data: LocationFormValues) => {
    const locationData = {
      name: data.name,
      type: data.type,
      parent_id: data.parentId || undefined,
      description: data.description,
    };
    createLocation(locationData);
    setIsLocationDialogOpen(false);
    locationForm.reset();
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
          <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <MapPin className="mr-2 h-4 w-4" />
                Manage Locations
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Location/Department</DialogTitle>
                <DialogDescription>
                  Create new locations, sublocations, or departments for asset management.
                </DialogDescription>
              </DialogHeader>
              <Form {...locationForm}>
                <form onSubmit={locationForm.handleSubmit(onLocationSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={locationForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={locationForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background border shadow-md z-50">
                              <SelectItem value="location">Location</SelectItem>
                              <SelectItem value="sublocation">Sublocation</SelectItem>
                              <SelectItem value="department">Department</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {locationForm.watch("type") === "sublocation" && (
                    <FormField
                      control={locationForm.control}
                      name="parentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Parent Location</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select parent location" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background border shadow-md z-50">
                              {getLocationsByType("location").map((location) => (
                                <SelectItem key={location.id} value={location.id}>
                                  {location.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {locationForm.watch("type") === "department" && (
                    <FormField
                      control={locationForm.control}
                      name="parentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Parent Sublocation</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select parent sublocation" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background border shadow-md z-50">
                              {locations
                                .filter(loc => loc.type === "sublocation")
                                .map((sublocation) => {
                                  const parentLocation = locations.find(l => l.id === sublocation.parent_id);
                                  return (
                                    <SelectItem key={sublocation.id} value={sublocation.id}>
                                      {parentLocation ? `${parentLocation.name} → ${sublocation.name}` : sublocation.name}
                                    </SelectItem>
                                  );
                                })}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={locationForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter description (optional)"
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
                      onClick={() => setIsLocationDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isCreatingLocation}>
                      {isCreatingLocation && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add {locationForm.watch("type")}
                    </Button>
                  </div>
                </form>
              </Form>

              {/* Current Locations List */}
              <div className="mt-6">
                <h4 className="font-medium mb-3">Current Location Hierarchy</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {/* Show locations with their hierarchy */}
                  {locations
                    .filter(loc => loc.type === "location")
                    .map((location) => (
                    <div key={location.id} className="space-y-1">
                      <div className="flex items-center justify-between p-2 border rounded bg-blue-50">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-blue-600" />
                          <span className="font-medium">{location.name}</span>
                          <Badge variant="outline" className="bg-blue-100 text-blue-800">
                            Location
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Show sublocations under this location */}
                      {locations
                        .filter(sub => sub.type === "sublocation" && sub.parent_id === location.id)
                        .map((sublocation) => (
                        <div key={sublocation.id} className="ml-6 space-y-1">
                          <div className="flex items-center justify-between p-2 border rounded bg-green-50">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-green-600" />
                              <span className="font-medium">{sublocation.name}</span>
                              <Badge variant="outline" className="bg-green-100 text-green-800">
                                Sublocation
                              </Badge>
                            </div>
                          </div>
                          
                          {/* Show departments under this sublocation */}
                          {locations
                            .filter(dept => dept.type === "department" && dept.parent_id === sublocation.id)
                            .map((department) => (
                            <div key={department.id} className="ml-6">
                              <div className="flex items-center justify-between p-2 border rounded bg-orange-50">
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-orange-600" />
                                  <span className="font-medium">{department.name}</span>
                                  <Badge variant="outline" className="bg-orange-100 text-orange-800">
                                    Department
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Asset
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Asset</DialogTitle>
                <DialogDescription>
                  Enter asset details to add it to the warehouse inventory.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
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

                  <div className="grid grid-cols-1 gap-4">
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
                      name="brand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Brand</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter brand name" {...field} />
                          </FormControl>
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
                              {getLocationsByType("location")
                                .filter(location => location.id && location.id.trim() !== "")
                                .map((location) => (
                                <SelectItem key={location.id} value={location.id}>
                                  {location.name}
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
                              {locations
                                .filter(loc => loc.type === "sublocation" && loc.id && loc.id.trim() !== "")
                                .map((sublocation) => {
                                  const parentLocation = locations.find(l => l.id === sublocation.parent_id);
                                  return (
                                    <SelectItem key={sublocation.id} value={sublocation.id}>
                                      {parentLocation ? `${parentLocation.name} → ${sublocation.name}` : sublocation.name}
                                    </SelectItem>
                                  );
                                })}
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
                              {locations
                                .filter(loc => loc.type === "department" && loc.id && loc.id.trim() !== "")
                                .map((department) => {
                                  const parentSublocation = locations.find(l => l.id === department.parent_id);
                                  const grandparentLocation = parentSublocation ? locations.find(l => l.id === parentSublocation.parent_id) : null;
                                  const fullPath = grandparentLocation && parentSublocation 
                                    ? `${grandparentLocation.name} → ${parentSublocation.name} → ${department.name}`
                                    : department.name;
                                  return (
                                    <SelectItem key={department.id} value={department.id}>
                                      {fullPath}
                                    </SelectItem>
                                  );
                                })}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-4">
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
                            <Input type="number" placeholder="0.00" step="0.01" {...field} />
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
                            <Input type="number" placeholder="0.00" step="0.01" {...field} />
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
                            placeholder="Enter asset description (optional)"
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
                            placeholder="Enter additional notes (optional)"
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
                      {form.watch("quantity") > 1 ? `Add ${form.watch("quantity")} Assets` : "Add Asset"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Assets</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeAssets}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Under Maintenance</CardTitle>
            <Wrench className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{maintenanceAssets}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalValue.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Assets Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Assets</CardTitle>
              <CardDescription>
                Manage and track all warehouse assets
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset ID</TableHead>
                <TableHead>Asset Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Brand</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Purchase Price</TableHead>
                    <TableHead className="w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
            <TableBody>
              {assetsLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    <p className="text-muted-foreground mt-2">Loading assets...</p>
                  </TableCell>
                </TableRow>
              ) : filteredAssets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <p className="text-muted-foreground">No assets found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAssets.map((asset) => {
                  const locationName = asset.location_id ? getLocationName(asset.location_id) : "-";
                  
                  const categoryName = asset.category_id ? getCategoryName(asset.category_id) : asset.category;
                  const subcategoryName = asset.subcategory_id ? getSubcategoryName(asset.subcategory_id) : "";
                  const displayCategory = subcategoryName ? `${categoryName} → ${subcategoryName}` : categoryName;
                  
                  return (
                    <TableRow key={asset.id}>
                      <TableCell className="font-mono text-sm font-medium">{asset.asset_id || "-"}</TableCell>
                      <TableCell className="font-medium">{asset.name}</TableCell>
                      <TableCell>{displayCategory || asset.category}</TableCell>
                      <TableCell>{asset.brand || "-"}</TableCell>
                      <TableCell>{locationName}</TableCell>
                      <TableCell>
                        <Badge className={getConditionBadge(asset.condition)}>
                          {asset.condition.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(asset.status)}
                          <span className="capitalize">{asset.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>{asset.purchase_price ? `$${asset.purchase_price.toLocaleString()}` : "-"}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-background border shadow-md z-50">
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
                              onClick={() => {
                                setSelectedAsset(asset);
                                setIsDeleteDialogOpen(true);
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* All Dialogs */}
      <AssetDetailsDialog
        asset={selectedAsset}
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        onEdit={(asset) => {
          setSelectedAsset(asset);
          setIsEditDialogOpen(true);
        }}
        locations={locations}
        categories={mainCategories}
        getLocationName={(locationId) => locations.find(l => l.id === locationId)?.name || 'Unknown'}
        getCategoryName={(categoryId) => mainCategories.find(c => c.id === categoryId)?.name || 'Unknown'}
        getSubcategoryName={(subcategoryId) => {
          // Find subcategory across all categories
          for (const category of mainCategories) {
            const subcategories = getSubcategories(category.id);
            const found = subcategories.find(c => c.id === subcategoryId);
            if (found) return found.name;
          }
          return 'Unknown';
        }}
      />

      <AssetEditDialog
        asset={selectedAsset}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        locations={locations}
        categories={mainCategories}
        getLocationsByType={(type, parentId) => 
          locations.filter(l => l.type === type && (!parentId || l.parent_id === parentId))
        }
      />

      <AssetTransferDialog
        asset={selectedAsset}
        open={isTransferDialogOpen}
        onOpenChange={setIsTransferDialogOpen}
        locations={locations}
        getLocationsByType={(type, parentId) => 
          locations.filter(l => l.type === type && (!parentId || l.parent_id === parentId))
        }
        getLocationName={(locationId) => locations.find(l => l.id === locationId)?.name || 'Unknown'}
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
    </div>
  );
}