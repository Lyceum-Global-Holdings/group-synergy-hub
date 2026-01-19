import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useCreateRepairRecord } from "@/hooks/construction/useRepairRecords";
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
  const { selectedCompany } = useCompany();
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

  // Fetch inventory items that have stock
  const { data: inventoryItems = [], isLoading: isLoadingItems } = useQuery({
    queryKey: ["inventory-master-with-stock", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("construction_inventory_master")
        .select(`
          id,
          item_name,
          unit,
          image_url,
          quantity,
          location_id,
          warehouse_location:warehouse_locations(id, name)
        `)
        .eq("company_id", selectedCompany?.id)
        .gt("quantity", 0)
        .order("item_name");

      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id && open,
  });

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

    inventoryItems.forEach((item) => {
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
  }, [inventoryItems]);

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
      <DialogContent className="max-w-lg">
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
                  className="h-24 w-24 object-cover rounded-lg border"
                />
              </div>
            )}
            {selectedItem && !selectedItem.image_url && (
              <div className="flex justify-center">
                <div className="h-24 w-24 bg-muted rounded-lg flex items-center justify-center">
                  <Package className="h-8 w-8 text-muted-foreground" />
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
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingItems ? "Loading..." : "Select an item"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {consolidatedItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.item_name} - {item.location_name || "Unknown"} (Qty: {item.quantity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
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

            {/* Location (Read-only, from selected item) */}
            <FormField
              control={form.control}
              name="location_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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

            {/* Service Provider */}
            <FormField
              control={form.control}
              name="service_provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Provider (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter service provider name" {...field} />
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
                  <FormLabel>Expected Return Date (Optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Remarks */}
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks (Optional)</FormLabel>
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createRepair.isPending}>
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
