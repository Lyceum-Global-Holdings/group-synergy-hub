import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { WarehouseAsset, WarehouseLocation, AssetCategory } from "@/types/warehouse";
import { useWarehouseAssets } from "@/hooks/useWarehouseAssets";
import { useEffect } from "react";

const editAssetSchema = z.object({
  name: z.string().min(1, "Asset name is required"),
  category_id: z.string().min(1, "Category is required"),
  subcategory_id: z.string().optional(),
  brand: z.string().optional(),
  location_id: z.string().optional(),
  sublocation_id: z.string().optional(),
  department_id: z.string().optional(),
  condition: z.enum(['good', 'fair', 'poor', 'needs_repair']),
  status: z.enum(['active', 'inactive', 'maintenance', 'disposed']),
  serial_number: z.string().optional(),
  asset_tag: z.string().optional(),
  purchase_date: z.string().optional(),
  purchase_price: z.string().transform(val => val === "" ? "" : val).optional(),
  current_value: z.string().transform(val => val === "" ? "" : val).optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

type EditAssetFormValues = z.infer<typeof editAssetSchema>;

interface AssetEditDialogProps {
  asset: WarehouseAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: WarehouseLocation[];
  categories: AssetCategory[];
  getLocationsByType: (type: string, parentId?: string) => WarehouseLocation[];
}

export function AssetEditDialog({
  asset,
  open,
  onOpenChange,
  locations,
  categories,
  getLocationsByType,
}: AssetEditDialogProps) {
  const { updateAsset, isUpdating } = useWarehouseAssets();

  const form = useForm<EditAssetFormValues>({
    resolver: zodResolver(editAssetSchema),
    defaultValues: {
      name: "",
      category_id: "",
      subcategory_id: "",
      brand: "",
      location_id: "",
      sublocation_id: "",
      department_id: "",
      condition: 'good',
      status: 'active',
      serial_number: "",
      asset_tag: "",
      purchase_date: "",
      purchase_price: "",
      current_value: "",
      description: "",
      notes: "",
    },
  });

  // Update form when asset changes
  useEffect(() => {
    if (asset && open) {
      form.reset({
        name: asset.name,
        category_id: asset.category_id || "",
        subcategory_id: asset.subcategory_id || "",
        brand: asset.brand || "",
        location_id: asset.location_id || "",
        sublocation_id: asset.sublocation_id || "",
        department_id: asset.department_id || "",
        condition: asset.condition as any,
        status: asset.status as any,
        serial_number: asset.serial_number || "",
        asset_tag: asset.asset_tag || "",
        purchase_date: asset.purchase_date || "",
        purchase_price: asset.purchase_price ? asset.purchase_price.toString() : "",
        current_value: asset.current_value ? asset.current_value.toString() : "",
        description: asset.description || "",
        notes: asset.notes || "",
      });
    }
  }, [asset, open, form]);

  const onSubmit = (data: EditAssetFormValues) => {
    if (!asset) return;

    // Get the category name from the selected category_id
    const selectedCategory = categories.find(cat => cat.id === data.category_id);
    
    const updateData: any = {
      name: data.name,
      category: selectedCategory?.name || asset.category, // Required field
      category_id: data.category_id || null,
      subcategory_id: data.subcategory_id || null,
      brand: data.brand || null,
      location_id: data.location_id || null,
      sublocation_id: data.sublocation_id || null,
      department_id: data.department_id || null,
      condition: data.condition,
      status: data.status,
      serial_number: data.serial_number || null,
      asset_tag: data.asset_tag || null,
      purchase_date: data.purchase_date || null,
      purchase_price: data.purchase_price ? Number(data.purchase_price) : null,
      current_value: data.current_value ? Number(data.current_value) : null,
      description: data.description || null,
      notes: data.notes || null,
    };

    // Clean UUID fields - convert empty strings to null
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === "") {
        updateData[key] = null;
      }
    });

    console.log('Updating asset with data:', updateData);
    updateAsset({ id: asset.id, ...updateData });
    onOpenChange(false);
  };

  const selectedLocationId = form.watch("location_id");
  const selectedSublocationId = form.watch("sublocation_id");
  const selectedCategoryId = form.watch("category_id");

  const mainCategories = categories.filter(cat => !cat.parent_id);
  const subcategories = categories.filter(cat => cat.parent_id === selectedCategoryId);
  const mainLocations = getLocationsByType('warehouse');
  const sublocations = getLocationsByType('sublocation', selectedLocationId);
  const departments = getLocationsByType('department', selectedSublocationId || selectedLocationId);

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Asset: {asset.name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter asset name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {mainCategories.map((category) => (
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
              <FormField
                control={form.control}
                name="subcategory_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subcategory</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select subcategory" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {subcategories.map((subcategory) => (
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

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="location_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {mainLocations.map((location) => (
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sublocation" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sublocations.map((sublocation) => (
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map((department) => (
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="condition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condition *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="serial_number"
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
                name="asset_tag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset Tag</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter asset tag" {...field} />
                    </FormControl>
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
                    <Textarea placeholder="Enter asset description" {...field} />
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
                    <Textarea placeholder="Enter additional notes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Asset
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}