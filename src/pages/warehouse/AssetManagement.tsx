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
import { Plus, Search, Wrench, AlertTriangle, CheckCircle, Package, MapPin, Building, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "@/hooks/use-toast";

const assetFormSchema = z.object({
  name: z.string().min(1, "Asset name is required"),
  category: z.string().min(1, "Category is required"),
  serialNumber: z.string().min(1, "Serial number is required"),
  location: z.string().min(1, "Location is required"),
  sublocation: z.string().optional(),
  department: z.string().optional(),
  condition: z.enum(["excellent", "good", "fair", "poor"]),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  purchasePrice: z.string().min(1, "Purchase price is required"),
  description: z.string().optional(),
});

const locationFormSchema = z.object({
  name: z.string().min(1, "Location name is required"),
  type: z.enum(["location", "sublocation", "department"]),
  parentId: z.string().optional(),
  description: z.string().optional(),
});

type AssetFormValues = z.infer<typeof assetFormSchema>;
type LocationFormValues = z.infer<typeof locationFormSchema>;

interface LocationItem {
  id: string;
  name: string;
  type: "location" | "sublocation" | "department";
  parentId?: string;
  description?: string;
}

// Mock data for demonstration
const mockLocations: LocationItem[] = [
  { id: "1", name: "Warehouse A", type: "location", description: "Main warehouse facility" },
  { id: "2", name: "Warehouse B", type: "location", description: "Secondary warehouse facility" },
  { id: "3", name: "Loading Dock", type: "sublocation", parentId: "1", description: "Loading area in Warehouse A" },
  { id: "4", name: "Storage Zone 1", type: "sublocation", parentId: "1", description: "Primary storage area" },
  { id: "5", name: "Storage Zone 2", type: "sublocation", parentId: "2", description: "Secondary storage area" },
  { id: "6", name: "Operations", type: "department", parentId: "3", description: "Operations department in Loading Dock" },
  { id: "7", name: "Maintenance", type: "department", parentId: "4", description: "Maintenance department in Storage Zone 1" },
  { id: "8", name: "Quality Control", type: "department", parentId: "4", description: "Quality control department in Storage Zone 1" },
  { id: "9", name: "Receiving", type: "department", parentId: "3", description: "Receiving department in Loading Dock" },
];

const mockAssets = [
  {
    id: "1",
    name: "Forklift MF-2024",
    category: "Equipment",
    serialNumber: "FL-001-2024",
    location: "Warehouse A",
    sublocation: "Loading Dock",
    department: "Operations",
    condition: "excellent" as const,
    status: "active",
    purchaseDate: "2024-01-15",
    purchasePrice: 45000,
    lastMaintenance: "2024-08-15",
  },
  {
    id: "2",
    name: "Conveyor Belt System",
    category: "Machinery",
    serialNumber: "CB-002-2023",
    location: "Warehouse B",
    sublocation: "Storage Zone 1",
    department: "Operations",
    condition: "good" as const,
    status: "active",
    purchaseDate: "2023-06-10",
    purchasePrice: 125000,
    lastMaintenance: "2024-07-20",
  },
  {
    id: "3",
    name: "Pallet Jack PJ-150",
    category: "Equipment",
    serialNumber: "PJ-003-2022",
    location: "Warehouse A",
    sublocation: "Storage Zone 1",
    department: "Maintenance",
    condition: "fair" as const,
    status: "maintenance",
    purchaseDate: "2022-03-22",
    purchasePrice: 2500,
    lastMaintenance: "2024-09-01",
  },
];

const getConditionBadge = (condition: string) => {
  const variants = {
    excellent: "bg-green-100 text-green-800 border-green-200",
    good: "bg-blue-100 text-blue-800 border-blue-200",
    fair: "bg-yellow-100 text-yellow-800 border-yellow-200",
    poor: "bg-red-100 text-red-800 border-red-200",
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
    default:
      return <Package className="h-4 w-4 text-gray-600" />;
  }
};

export default function AssetManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [assets] = useState(mockAssets);
  const [locations, setLocations] = useState<LocationItem[]>(mockLocations);

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      name: "",
      category: "",
      serialNumber: "",
      location: "",
      sublocation: "",
      department: "",
      condition: "good",
      purchaseDate: "",
      purchasePrice: "",
      description: "",
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
    console.log("Asset data:", data);
    toast({
      title: "Asset Created",
      description: "New asset has been added successfully.",
    });
    setIsDialogOpen(false);
    form.reset();
  };

  const onLocationSubmit = (data: LocationFormValues) => {
    const newLocation: LocationItem = {
      id: Date.now().toString(),
      name: data.name,
      type: data.type,
      parentId: data.parentId,
      description: data.description,
    };
    setLocations([...locations, newLocation]);
    toast({
      title: "Location Added",
      description: `${data.type} "${data.name}" has been added successfully.`,
    });
    setIsLocationDialogOpen(false);
    locationForm.reset();
  };

  const filteredAssets = assets.filter((asset) =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.sublocation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getLocationsByType = (type: "location" | "sublocation" | "department", parentId?: string) => {
    if (type === "location") {
      return locations.filter(loc => loc.type === "location");
    } else if (type === "sublocation") {
      return locations.filter(loc => loc.type === "sublocation" && loc.parentId === parentId);
    } else if (type === "department") {
      return locations.filter(loc => loc.type === "department" && loc.parentId === parentId);
    }
    return [];
  };

  const getLocationName = (id: string) => {
    return locations.find(loc => loc.id === id)?.name || "";
  };

  const totalValue = assets.reduce((sum, asset) => sum + asset.purchasePrice, 0);
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
                              {getLocationsByType("sublocation").map((sublocation) => (
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
                    <Button type="submit">Add {locationForm.watch("type")}</Button>
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
                        .filter(sub => sub.type === "sublocation" && sub.parentId === location.id)
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
                            .filter(dept => dept.type === "department" && dept.parentId === sublocation.id)
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
                  <div className="grid grid-cols-2 gap-4">
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
                      name="category"
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
                              <SelectItem value="equipment">Equipment</SelectItem>
                              <SelectItem value="machinery">Machinery</SelectItem>
                              <SelectItem value="vehicles">Vehicles</SelectItem>
                              <SelectItem value="tools">Tools</SelectItem>
                              <SelectItem value="furniture">Furniture</SelectItem>
                              <SelectItem value="technology">Technology</SelectItem>
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
                      name="serialNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Serial Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter serial number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="location"
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
                              {getLocationsByType("location").map((location) => (
                                <SelectItem key={location.id} value={location.name}>
                                  {location.name}
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
                      name="sublocation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sublocation (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select sublocation" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background border shadow-md z-50">
                              {getLocationsByType("sublocation").map((sublocation) => (
                                <SelectItem key={sublocation.id} value={sublocation.name}>
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
                      name="department"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select department" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background border shadow-md z-50">
                              {/* Show all departments available in the selected sublocation */}
                              {locations
                                .filter(loc => loc.type === "department")
                                .map((department) => (
                                <SelectItem key={department.id} value={department.name}>
                                  {department.name}
                                  {department.parentId && (
                                    <span className="text-xs text-muted-foreground ml-2">
                                      ({getLocationName(department.parentId)})
                                    </span>
                                  )}
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
                              <SelectItem value="excellent">Excellent</SelectItem>
                              <SelectItem value="good">Good</SelectItem>
                              <SelectItem value="fair">Fair</SelectItem>
                              <SelectItem value="poor">Poor</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="purchaseDate"
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
                      name="purchasePrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purchase Price</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0.00" {...field} />
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

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Add Asset</Button>
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
                <TableHead>Asset Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Serial Number</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Sublocation</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Purchase Price</TableHead>
                <TableHead>Last Maintenance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="font-medium">{asset.name}</TableCell>
                  <TableCell>{asset.category}</TableCell>
                  <TableCell className="font-mono text-sm">{asset.serialNumber}</TableCell>
                  <TableCell>{asset.location}</TableCell>
                  <TableCell>{asset.sublocation || "-"}</TableCell>
                  <TableCell>{asset.department || "-"}</TableCell>
                  <TableCell>
                    <Badge className={getConditionBadge(asset.condition)}>
                      {asset.condition}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(asset.status)}
                      <span className="capitalize">{asset.status}</span>
                    </div>
                  </TableCell>
                  <TableCell>${asset.purchasePrice.toLocaleString()}</TableCell>
                  <TableCell>{asset.lastMaintenance}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}