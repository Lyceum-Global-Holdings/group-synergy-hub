import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateInventoryMaster, useInventoryMaster } from "@/hooks/construction/useInventoryMaster";
import { useEffect, useMemo } from "react";
import { Image as ImageIcon, Save, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  quantity: z.coerce.number().min(0, "Quantity must be 0 or greater"),
  location_id: z.string().min(1, "Location is required"),
  unit: z.string().min(1, "Unit is required"),
  unit_cost: z.coerce.number().min(0, "Unit cost must be 0 or greater"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface EditStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string | null;
}

export function EditStockDialog({ open, onOpenChange, itemId }: EditStockDialogProps) {
  const updateMutation = useUpdateInventoryMaster();
  const { data: inventoryMaster = [] } = useInventoryMaster();

  // Find the item to edit
  const item = useMemo(() => {
    if (!itemId) return null;
    return inventoryMaster.find((i) => i.id === itemId) || null;
  }, [inventoryMaster, itemId]);

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
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 1,
      location_id: "",
      unit: "",
      unit_cost: 0,
      notes: "",
    },
  });

  // Reset form when item changes
  useEffect(() => {
    if (open && item) {
      form.reset({
        quantity: item.quantity ?? 1,
        location_id: item.location_id || "",
        unit: item.unit || "",
        unit_cost: item.unit_cost ?? 0,
        notes: "",
      });
    }
  }, [open, item, form]);

  const onSubmit = async (data: FormData) => {
    if (!itemId) return;

    await updateMutation.mutateAsync({
      id: itemId,
      quantity: data.quantity,
      location_id: data.location_id,
      unit: data.unit,
      unit_cost: data.unit_cost,
      notes: data.notes,
    });
    
    onOpenChange(false);
  };

  if (!item) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Edit Stock Entry
          </DialogTitle>
          <DialogDescription>
            Update the quantity, location, and other details for this inventory entry.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Item Info (read-only) */}
            <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.item_name}
                  className="h-16 w-16 rounded object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded bg-background flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{item.item_name}</h3>
                <div className="text-sm text-muted-foreground">
                  {item.section} • {item.category}
                </div>
                {item.item_code && (
                  <div className="text-xs text-muted-foreground font-mono mt-1">
                    ID: {item.item_code}
                  </div>
                )}
              </div>
            </div>

            {/* Quantity and Location */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" placeholder="1" {...field} />
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
                    <FormLabel>Location *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map((location) => (
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
            </div>

            {/* Unit and Unit Cost */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., pcs, kg, m" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Cost *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Reason for update, adjustment notes, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
