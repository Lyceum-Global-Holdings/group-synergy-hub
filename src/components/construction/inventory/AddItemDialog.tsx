import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useCreateItemMasterWithSerial, useCreateItemMasterWithStock, useLocations } from "@/hooks/construction/useConstructionInventory";
import { useNextItemCode } from "@/hooks/construction/useNextItemCode";
import { useCurrentUserLocationPermissions } from "@/hooks/useCurrentUserLocationPermissions";
import {
  type ItemCategory,
  ITEM_SECTIONS,
  ITEM_CATEGORIES,
  SERIAL_CONDITIONS,
  SUB_CATEGORIES,
  COLOR_OPTIONS,
} from "@/types/construction-inventory";

// Bulk categories - these are quantity-tracked, not serial-tracked
const BULK_CATEGORIES: ItemCategory[] = ['tools', 'safety', 'equipment', 'scaffolding'];

const formSchema = z.object({
  item_code: z.string().min(1, "Item code is required"),
  item_name: z.string().min(1, "Item name is required"),
  section: z.enum(["civil", "mep", "aluminium", "mechanical", "carpenter"] as const),
  sub_category: z.string().min(1, "Sub-category is required"),
  color: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  unit_of_measurement: z.string().default("pcs"),
  description: z.string().optional(),
  unit_cost: z.coerce.number().optional(),
  purchase_date: z.string().optional(),
  // Serial number fields (for machines only)
  serial_number: z.string().optional(),
  current_location_id: z.string().optional(),
  condition: z.enum(["working", "under_repair", "damaged", "scrap"] as const).default("working"),
  availability: z.enum(["available", "in_use", "in_transit", "reserved"] as const).default("available"),
  warranty_expiry: z.string().optional(),
  asset_value: z.coerce.number().optional(),
  // Bulk item fields (for tools, safety, equipment, scaffolding)
  initial_quantity: z.coerce.number().min(0).optional(),
  location_id: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ItemCategory;
}

export function AddItemDialog({ open, onOpenChange, category }: AddItemDialogProps) {
  const createItemWithSerial = useCreateItemMasterWithSerial();
  const createItemWithStock = useCreateItemMasterWithStock();
  const { data: locations } = useLocations();
  const { data: permissions } = useCurrentUserLocationPermissions();

  const editableLocationIds = useMemo(
    () => new Set(permissions?.editLocationIds ?? []),
    [permissions?.editLocationIds]
  );

  const permittedLocations = useMemo(() => {
    if (!locations || !permissions) return [];

    // Only show top-level locations (type = 'location'), not sub-locations/departments/floors
    const topLevelLocations = locations.filter((loc) => loc.type === "location");

    if (permissions.canEditAllLocations) return topLevelLocations;
    return topLevelLocations.filter((loc) => editableLocationIds.has(loc.id));
  }, [locations, permissions, editableLocationIds]);

  // Machines are serial tracked, others are bulk tracked
  const isMachineCategory = category === "machines";
  const isBulkCategory = BULK_CATEGORIES.includes(category);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      item_code: "",
      item_name: "",
      section: "civil",
      sub_category: "",
      color: "",
      brand: "",
      model: "",
      unit_of_measurement: "pcs",
      description: "",
      unit_cost: undefined,
      purchase_date: "",
      serial_number: "",
      current_location_id: "",
      condition: "working",
      availability: "available",
      warranty_expiry: "",
      asset_value: undefined,
      initial_quantity: undefined,
      location_id: "",
    },
  });

  const watchedSubCategory = form.watch("sub_category");
  const watchedItemName = form.watch("item_name");
  const watchedColor = form.watch("color");

  const { data: nextItemCode } = useNextItemCode(
    category,
    watchedSubCategory,
    watchedItemName,
    watchedColor
  );

  // Auto-fill item code when all fields are available
  useEffect(() => {
    if (open && nextItemCode) {
      form.setValue("item_code", nextItemCode);
    }
  }, [open, nextItemCode, form]);

  // Reset sub_category when category changes (dialog re-opens with different category)
  useEffect(() => {
    form.setValue("sub_category", "");
    form.setValue("color", "");
  }, [category, form]);

  // Clear stale location values that are no longer permitted
  useEffect(() => {
    if (!permissions || permissions.canEditAllLocations) return;

    const currentLocationId = form.getValues("current_location_id");
    if (currentLocationId && !editableLocationIds.has(currentLocationId)) {
      form.setValue("current_location_id", "");
    }

    const bulkLocationId = form.getValues("location_id");
    if (bulkLocationId && !editableLocationIds.has(bulkLocationId)) {
      form.setValue("location_id", "");
    }
  }, [permissions, editableLocationIds, form]);

  const availableSubCategories = SUB_CATEGORIES[category] || [];

  const onSubmit = async (values: FormOutput) => {
    const canUseLocation = (locationId?: string) => {
      if (!locationId) return true;
      if (permissions?.canEditAllLocations) return true;
      return editableLocationIds.has(locationId);
    };

    if (isMachineCategory && !canUseLocation(values.current_location_id)) {
      form.setError("current_location_id", {
        type: "manual",
        message: "You can only add to edit-permitted locations.",
      });
      return;
    }

    if (!isMachineCategory && values.location_id && !canUseLocation(values.location_id)) {
      form.setError("location_id", {
        type: "manual",
        message: "You can only add to edit-permitted locations.",
      });
      return;
    }

    // Convert empty date strings to undefined so they become NULL in the database
    const purchaseDate = values.purchase_date?.trim() || undefined;
    const warrantyExpiry = values.warranty_expiry?.trim() || undefined;

    if (isMachineCategory) {
      await createItemWithSerial.mutateAsync({
        item_code: values.item_code,
        item_name: values.item_name,
        section: values.section,
        category,
        sub_category: values.sub_category,
        color: values.color,
        brand: values.brand,
        model: values.model,
        unit_of_measurement: values.unit_of_measurement,
        description: values.description,
        unit_cost: values.unit_cost,
        purchase_date: purchaseDate,
        is_serial_tracked: true,
        serial_number: values.serial_number,
        current_location_id: values.current_location_id || undefined,
        condition: values.condition,
        availability: values.availability,
        warranty_expiry: warrantyExpiry,
        asset_value: values.asset_value,
      });
    } else {
      await createItemWithStock.mutateAsync({
        item_code: values.item_code,
        item_name: values.item_name,
        section: values.section,
        category,
        sub_category: values.sub_category,
        color: values.color,
        brand: values.brand,
        model: values.model,
        unit_of_measurement: values.unit_of_measurement,
        description: values.description,
        unit_cost: values.unit_cost,
        purchase_date: purchaseDate,
        is_serial_tracked: false,
        initial_quantity: values.initial_quantity,
        location_id: values.location_id,
      });
    }
    form.reset();
    onOpenChange(false);
  };

  const categoryLabel = ITEM_CATEGORIES.find(c => c.value === category)?.label || "Item";
  const isSubmitting = createItemWithSerial.isPending || createItemWithStock.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New {categoryLabel.slice(0, -1)}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Row 1: Sub-Category & Color */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sub_category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub-Category *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sub-category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableSubCategories.map(sub => (
                          <SelectItem key={sub.value} value={sub.value}>
                            {sub.label}
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
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select color" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COLOR_OPTIONS.map(c => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 2: Item Name & Auto-generated Item Code */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="item_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name *</FormLabel>
                    <FormControl>
                      <Input placeholder={isMachineCategory ? "e.g., Excavator" : "e.g., Safety Helmet"} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="item_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Code (Auto-generated)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Fill sub-category, color & name" 
                        {...field} 
                        readOnly 
                        className="bg-muted font-mono"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 3: Section & Unit */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="section"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select section" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ITEM_SECTIONS.map(sec => (
                          <SelectItem key={sec.value} value={sec.value}>
                            {sec.label}
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
                name="unit_of_measurement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pcs">Pieces</SelectItem>
                        <SelectItem value="set">Set</SelectItem>
                        <SelectItem value="kg">Kilogram</SelectItem>
                        <SelectItem value="m">Meter</SelectItem>
                        <SelectItem value="sqm">Square Meter</SelectItem>
                        <SelectItem value="nos">Numbers</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 4: Brand & Model */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand</FormLabel>
                    <FormControl>
                      <Input placeholder={isMachineCategory ? "e.g., Caterpillar" : "e.g., 3M"} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., CAT 320" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 5: Unit Cost & Purchase Date */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unit_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Cost (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0.00" {...field} />
                    </FormControl>
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
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Item description..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Machine Category - Serial Number Fields */}
            {isMachineCategory && (
              <div className="space-y-4 rounded-md border p-4 bg-muted/30">
                <h4 className="font-medium text-sm">Serial Number Details</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Machines are automatically serial-tracked. Enter the serial number for this unit.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="serial_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serial Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., SN-MCH-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="current_location_id"
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
                            {permittedLocations.map(loc => (
                              <SelectItem key={loc.id} value={loc.id}>
                                {loc.name}
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select condition" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SERIAL_CONDITIONS.map(cond => (
                              <SelectItem key={cond.value} value={cond.value}>
                                {cond.label}
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
                    name="availability"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Availability</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select availability" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="in_use">In Use</SelectItem>
                            <SelectItem value="in_transit">In Transit</SelectItem>
                            <SelectItem value="reserved">Reserved</SelectItem>
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
                    name="warranty_expiry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warranty Expiry</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="asset_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asset Value (₹)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Bulk Category - Initial Quantity & Location Fields */}
            {isBulkCategory && (
              <div className="space-y-4 rounded-md border p-4 bg-muted/30">
                <h4 className="font-medium text-sm">Initial Stock</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  {categoryLabel} are quantity-tracked. Enter the initial quantity and storage location.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="initial_quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Initial Quantity</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0" 
                            placeholder="e.g., 10" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                            {permittedLocations.map(loc => (
                              <SelectItem key={loc.id} value={loc.id}>
                                {loc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add {categoryLabel.slice(0, -1)}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
