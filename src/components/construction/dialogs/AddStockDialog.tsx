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
import { useCreateInventoryMaster, useInventoryMaster } from "@/hooks/construction/useInventoryMaster";
import type { CreateInventoryMasterData } from "@/types/construction";
import { useEffect, useState, useMemo } from "react";
import { Image as ImageIcon, Plus, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  item_name: z.string().min(1, "Item name is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  location_id: z.string().min(1, "Location is required"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface MasterItem {
  item_name: string;
  section: string;
  category: string;
  unit?: string;
  unit_cost?: number;
  image_url?: string | null;
  status: string;
}

interface AddStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddStockDialog({ open, onOpenChange }: AddStockDialogProps) {
  const createMutation = useCreateInventoryMaster();
  const { data: inventoryMaster = [] } = useInventoryMaster();
  const [selectedItemImage, setSelectedItemImage] = useState<string | null>(null);
  const [selectedMasterItem, setSelectedMasterItem] = useState<MasterItem | null>(null);
  const [itemComboOpen, setItemComboOpen] = useState(false);

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

  // Get unique item names from Item Master with their details
  const uniqueItems = useMemo(() => {
    const itemMap = new Map<string, MasterItem>();
    
    inventoryMaster.forEach((item) => {
      const normalizedName = item.item_name.toLowerCase().trim();
      if (!itemMap.has(normalizedName)) {
        itemMap.set(normalizedName, {
          item_name: item.item_name,
          section: item.section || "",
          category: item.category || "",
          unit: item.unit || "",
          unit_cost: item.unit_cost || undefined,
          image_url: item.image_url,
          status: item.status,
        });
      }
    });
    
    return Array.from(itemMap.values());
  }, [inventoryMaster]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      item_name: "",
      quantity: 1,
      location_id: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        item_name: "",
        quantity: 1,
        location_id: "",
        notes: "",
      });
      setSelectedItemImage(null);
      setSelectedMasterItem(null);
    }
  }, [open, form]);

  // Handle item selection - auto-fill image and store master item details
  const handleItemSelect = (itemName: string) => {
    form.setValue("item_name", itemName);
    
    const masterItem = uniqueItems.find(
      (item) => item.item_name.toLowerCase().trim() === itemName.toLowerCase().trim()
    );
    
    if (masterItem) {
      setSelectedMasterItem(masterItem);
      setSelectedItemImage(masterItem.image_url || null);
    } else {
      setSelectedMasterItem(null);
      setSelectedItemImage(null);
    }
    
    setItemComboOpen(false);
  };

  const onSubmit = async (data: FormData) => {
    if (!selectedMasterItem) {
      return;
    }

    // Create a new inventory record with the existing item's details
    const createData: CreateInventoryMasterData = {
      item_name: selectedMasterItem.item_name,
      section: selectedMasterItem.section,
      category: selectedMasterItem.category,
      quantity: data.quantity,
      location_id: data.location_id,
      unit: selectedMasterItem.unit,
      unit_cost: selectedMasterItem.unit_cost,
      image_url: selectedMasterItem.image_url || undefined,
      status: selectedMasterItem.status,
      notes: data.notes,
    };

    await createMutation.mutateAsync(createData);
    onOpenChange(false);
  };

  const selectedItemValue = form.watch("item_name");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Add Stock to Existing Item
          </DialogTitle>
          <DialogDescription>
            Add quantity to an existing item from Item Master. Select an item and specify the quantity and location.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Item Name Selection */}
            <FormField
              control={form.control}
              name="item_name"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Item Name *</FormLabel>
                  <Popover open={itemComboOpen} onOpenChange={setItemComboOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={itemComboOpen}
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value || "Select an item from Item Master"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search items..." />
                        <CommandList>
                          <CommandEmpty>
                            No items found. Add new items from Item Master.
                          </CommandEmpty>
                          <CommandGroup>
                            {uniqueItems.map((item) => (
                              <CommandItem
                                key={item.item_name}
                                value={item.item_name}
                                onSelect={() => handleItemSelect(item.item_name)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedItemValue?.toLowerCase() === item.item_name.toLowerCase()
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <div className="flex items-center gap-2 flex-1">
                                  {item.image_url ? (
                                    <img
                                      src={item.image_url}
                                      alt={item.item_name}
                                      className="h-8 w-8 rounded object-cover"
                                    />
                                  ) : (
                                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div>
                                    <div className="font-medium">{item.item_name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {item.section} • {item.category}
                                    </div>
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Auto-filled Item Image (read-only) */}
            {selectedItemImage && (
              <div className="space-y-2">
                <FormLabel>Item Image (from Item Master)</FormLabel>
                <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
                  <img
                    src={selectedItemImage}
                    alt="Item"
                    className="h-16 w-16 rounded object-cover"
                  />
                  <p className="text-sm text-muted-foreground">
                    Image auto-filled from Item Master
                  </p>
                </div>
              </div>
            )}

            {/* Selected Item Details */}
            {selectedMasterItem && (
              <div className="p-3 bg-muted/50 rounded-md space-y-1">
                <p className="text-sm font-medium">Item Details</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <span>Section: {selectedMasterItem.section || "—"}</span>
                  <span>Category: {selectedMasterItem.category || "—"}</span>
                  <span>Unit: {selectedMasterItem.unit || "—"}</span>
                  <span>Unit Cost: {selectedMasterItem.unit_cost ? `$${selectedMasterItem.unit_cost}` : "—"}</span>
                </div>
              </div>
            )}

            {/* Quantity and Location */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity to Add *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="1" placeholder="1" {...field} />
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

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Purchase notes, supplier info, etc." {...field} />
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
                disabled={createMutation.isPending || !selectedMasterItem}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Stock
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
