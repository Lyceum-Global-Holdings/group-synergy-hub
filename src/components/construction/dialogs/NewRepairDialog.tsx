import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useInventoryMaster } from "@/hooks/construction/useInventoryMaster";
import { useCreateRepairRecord, useRepairRecords } from "@/hooks/construction/useRepairRecords";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Package, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  item_id: z.string().min(1, "Please select an item"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  unit: z.string().optional(),
  location_id: z.string().min(1, "Location is required"),
  service_provider: z.string().optional(),
  remarks: z.string().optional(),
  expected_return_date: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface NewRepairDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewRepairDialog({ open, onOpenChange }: NewRepairDialogProps) {
  const createRepair = useCreateRepairRecord();
  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    item_name: string;
    unit: string | null;
    image_url: string | null;
    quantity: number;
    location_id: string | null;
  } | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      item_id: "",
      quantity: 1,
      unit: "",
      location_id: "",
      service_provider: "",
      remarks: "",
      expected_return_date: "",
    },
  });

  // Use the shared useInventoryMaster hook (single source of truth)
  const { data: inventoryMaster = [], isLoading: isLoadingMaster } = useInventoryMaster();
  
  // Fetch active repair records to exclude items under repair
  const { data: repairRecords = [] } = useRepairRecords();

  // Get IDs of items currently under active repair
  const itemsUnderRepairIds = useMemo(() => {
    return new Set(
      repairRecords
        .filter((r) => !["returned", "discarded"].includes(r.repair_status))
        .map((r) => r.item_id)
    );
  }, [repairRecords]);

  // Filter items with available stock and not under active repair
  const availableItems = useMemo(() => {
    return inventoryMaster.filter(
      (item) => item.quantity > 0 && !itemsUnderRepairIds.has(item.id)
    );
  }, [inventoryMaster, itemsUnderRepairIds]);

  // Consolidate items by item_name + location_id (sum quantities)
  const consolidatedItems = useMemo(() => {
    const itemMap = new Map<string, {
      id: string;
      item_name: string;
      unit: string | null;
      image_url: string | null;
      quantity: number;
      location_id: string | null;
      location_name: string | null;
    }>();

    availableItems.forEach((item) => {
      const key = `${item.item_name}__${item.location_id}`;
      const existing = itemMap.get(key);
      
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        itemMap.set(key, {
          id: item.id,
          item_name: item.item_name,
          unit: item.unit,
          image_url: item.image_url,
          quantity: item.quantity,
          location_id: item.location_id,
          location_name: (item.warehouse_location as { name: string } | null)?.name || null,
        });
      }
    });

    return Array.from(itemMap.values());
  }, [availableItems]);

  // Fetch warehouse locations
  const { data: locations = [] } = useQuery({
    queryKey: ["warehouse-locations-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouse_locations")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
      setSelectedItem(null);
    }
  }, [open, form]);

  // Update form when item is selected
  const handleItemChange = (itemId: string) => {
    const item = consolidatedItems.find((i) => i.id === itemId);
    if (item) {
      setSelectedItem(item);
      form.setValue("item_id", itemId);
      form.setValue("unit", item.unit || "");
      form.setValue("location_id", item.location_id || "");
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!selectedItem) return;

    // Validate quantity
    if (data.quantity > selectedItem.quantity) {
      form.setError("quantity", {
        message: `Maximum available: ${selectedItem.quantity}`,
      });
      return;
    }

    await createRepair.mutateAsync({
      item_id: data.item_id,
      item_name: selectedItem.item_name,
      quantity: data.quantity,
      unit: data.unit,
      location_id: data.location_id,
      service_provider: data.service_provider,
      remarks: data.remarks,
      expected_return_date: data.expected_return_date || undefined,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Item for Repair</DialogTitle>
          <DialogDescription>
            Select an item to send for service or repair. The item will be removed from available inventory.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Item Image Preview */}
            {selectedItem?.image_url && (
              <div className="flex justify-center">
                <img
                  src={selectedItem.image_url}
                  alt={selectedItem.item_name}
                  className="h-20 w-20 sm:h-24 sm:w-24 object-cover rounded-lg border"
                />
              </div>
            )}
            {selectedItem && !selectedItem.image_url && (
              <div className="flex justify-center">
                <div className="h-20 w-20 sm:h-24 sm:w-24 bg-muted rounded-lg flex items-center justify-center">
                  <Package className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                </div>
              </div>
            )}

            {/* Item Selection */}
            <FormField
              control={form.control}
              name="item_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Name *</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleItemChange(value);
                    }}
                    disabled={isLoadingMaster}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={isLoadingMaster ? "Loading items..." : "Select an item"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background z-[9999] max-h-60">
                      {consolidatedItems.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          No items with available stock
                        </div>
                      ) : (
                        consolidatedItems.map((item) => (
                          <SelectItem key={`${item.id}-${item.location_id}`} value={item.id}>
                            {item.item_name} - {item.location_name || "Unknown"} (Qty: {item.quantity})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Quantity and Unit - Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Quantity */}
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={selectedItem?.quantity || 1}
                        {...field}
                      />
                    </FormControl>
                    {selectedItem && (
                      <p className="text-xs text-muted-foreground">
                        Available: {selectedItem.quantity}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Unit */}
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., pcs, kg" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Location */}
            <FormField
              control={form.control}
              name="location_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background z-[9999]">
                      {locations.map((loc) => (
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

            {/* Service Provider and Expected Return Date - Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Service Provider */}
              <FormField
                control={form.control}
                name="service_provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Provider</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter provider name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Expected Return Date */}
              <FormField
                control={form.control}
                name="expected_return_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Return Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Remarks */}
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the issue or reason for repair..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createRepair.isPending}
                className="w-full sm:w-auto"
              >
                {createRepair.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Send for Repair
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
