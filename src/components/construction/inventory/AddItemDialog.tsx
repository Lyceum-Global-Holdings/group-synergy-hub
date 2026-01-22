import { useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { useCreateItemMasterWithSerial, useLocations } from "@/hooks/construction/useConstructionInventory";
import { useNextItemCode } from "@/hooks/construction/useNextItemCode";
import {
  type ItemCategory,
  type ItemSection,
  ITEM_SECTIONS,
  ITEM_CATEGORIES,
  SERIAL_CONDITIONS,
} from "@/types/construction-inventory";

const formSchema = z.object({
  item_code: z.string().min(1, "Item code is required"),
  item_name: z.string().min(1, "Item name is required"),
  section: z.enum(["civil", "mep", "aluminium", "mechanical", "carpenter"] as const),
  brand: z.string().optional(),
  model: z.string().optional(),
  unit_of_measurement: z.string().default("pcs"),
  description: z.string().optional(),
  is_serial_tracked: z.boolean().default(false),
  unit_cost: z.coerce.number().optional(),
  purchase_date: z.string().optional(),
  // Serial number fields (for machines)
  serial_number: z.string().optional(),
  current_location_id: z.string().optional(),
  condition: z.enum(["working", "under_repair", "damaged", "scrap"] as const).default("working"),
  availability: z.enum(["available", "in_use", "in_transit", "reserved"] as const).default("available"),
  warranty_expiry: z.string().optional(),
  asset_value: z.coerce.number().optional(),
});

type FormData = z.infer<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ItemCategory;
}

export function AddItemDialog({ open, onOpenChange, category }: AddItemDialogProps) {
  const createItem = useCreateItemMasterWithSerial();
  const { data: locations } = useLocations();
  const { data: nextItemCode, refetch: refetchNextCode } = useNextItemCode(category);

  // Machines are always serial tracked
  const isMachineCategory = category === "machines";

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      item_code: "",
      item_name: "",
      section: "civil",
      brand: "",
      model: "",
      unit_of_measurement: "pcs",
      description: "",
      is_serial_tracked: isMachineCategory,
      unit_cost: undefined,
      purchase_date: "",
      serial_number: "",
      current_location_id: "",
      condition: "working",
      availability: "available",
      warranty_expiry: "",
      asset_value: undefined,
    },
  });

  // Auto-fill item code when dialog opens or category changes
  useEffect(() => {
    if (open && nextItemCode) {
      form.setValue("item_code", nextItemCode);
    }
  }, [open, nextItemCode, form]);

  // Reset form when category changes
  useEffect(() => {
    form.setValue("is_serial_tracked", isMachineCategory);
    // Refetch next item code when category changes
    refetchNextCode();
  }, [category, isMachineCategory, form, refetchNextCode]);

  const onSubmit = async (values: FormOutput) => {
    await createItem.mutateAsync({
      item_code: values.item_code,
      item_name: values.item_name,
      section: values.section,
      category,
      brand: values.brand,
      model: values.model,
      unit_of_measurement: values.unit_of_measurement,
      description: values.description,
      unit_cost: values.unit_cost,
      purchase_date: values.purchase_date,
      is_serial_tracked: isMachineCategory ? true : values.is_serial_tracked,
      // Serial number data (only for machines)
      serial_number: isMachineCategory ? values.serial_number : undefined,
      current_location_id: isMachineCategory ? values.current_location_id : undefined,
      condition: isMachineCategory ? values.condition : undefined,
      availability: isMachineCategory ? values.availability : undefined,
      warranty_expiry: isMachineCategory ? values.warranty_expiry : undefined,
      asset_value: isMachineCategory ? values.asset_value : undefined,
    });
    form.reset();
    onOpenChange(false);
  };

  const categoryLabel = ITEM_CATEGORIES.find(c => c.value === category)?.label || "Item";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New {categoryLabel.slice(0, -1)}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="item_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Code *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Auto-generated" 
                        {...field} 
                        readOnly 
                        className="bg-muted"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="item_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Excavator" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Caterpillar" {...field} />
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

            {!isMachineCategory && (
              <FormField
                control={form.control}
                name="is_serial_tracked"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Serial Number Tracking</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Enable individual serial number tracking for this item
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            )}

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
                            {locations?.map(loc => (
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

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createItem.isPending}>
                {createItem.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add {categoryLabel.slice(0, -1)}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
