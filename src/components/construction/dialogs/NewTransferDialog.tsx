import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInventoryMaster } from "@/hooks/construction/useInventoryMaster";
import { useEffect, useState, useMemo } from "react";
import { Image as ImageIcon, ArrowRightLeft, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { Alert, AlertDescription } from "@/components/ui/alert";

const formSchema = z.object({
  item_name: z.string().min(1, "Item name is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  unit: z.string().min(1, "Unit is required"),
  from_location_id: z.string().min(1, "From location is required"),
  to_location_id: z.string().min(1, "To location is required"),
}).refine((data) => data.from_location_id !== data.to_location_id, {
  message: "From and To locations cannot be the same",
  path: ["to_location_id"],
});

type FormData = z.infer<typeof formSchema>;

interface ItemWithLocation {
  id: string;
  item_name: string;
  section: string | null;
  category: string | null;
  unit: string | null;
  unit_cost: number | null;
  image_url: string | null;
  quantity: number;
  location_id: string | null;
  location_name: string | null;
}

interface NewTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewTransferDialog({ open, onOpenChange }: NewTransferDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { data: inventoryMaster = [] } = useInventoryMaster();
  const [selectedItemImage, setSelectedItemImage] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemWithLocation | null>(null);
  const [itemComboOpen, setItemComboOpen] = useState(false);
  const [availableStock, setAvailableStock] = useState<number>(0);

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

  // Get items with their location information for transfer
  const itemsWithLocations = useMemo(() => {
    return inventoryMaster
      .filter(item => item.quantity > 0) // Only show items with stock
      .map(item => ({
        id: item.id,
        item_name: item.item_name,
        section: item.section,
        category: item.category,
        unit: item.unit,
        unit_cost: item.unit_cost,
        image_url: item.image_url,
        quantity: item.quantity,
        location_id: item.location_id,
        location_name: item.warehouse_location?.name || null,
      }));
  }, [inventoryMaster]);

  // Get unique item names for selection
  const uniqueItemNames = useMemo(() => {
    const names = new Set<string>();
    itemsWithLocations.forEach(item => names.add(item.item_name));
    return Array.from(names);
  }, [itemsWithLocations]);

  // Get available locations for selected item (locations where item has stock)
  const availableFromLocations = useMemo(() => {
    if (!selectedItem) return [];
    return itemsWithLocations
      .filter(item => item.item_name === selectedItem.item_name && item.quantity > 0)
      .map(item => ({
        id: item.location_id!,
        name: item.location_name!,
        quantity: item.quantity,
      }))
      .filter(loc => loc.id && loc.name);
  }, [selectedItem, itemsWithLocations]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      item_name: "",
      quantity: 1,
      unit: "",
      from_location_id: "",
      to_location_id: "",
    },
  });

  const fromLocationId = form.watch("from_location_id");
  const quantityValue = form.watch("quantity");

  // Update available stock when from_location changes
  useEffect(() => {
    if (selectedItem && fromLocationId) {
      const locationItem = itemsWithLocations.find(
        item => item.item_name === selectedItem.item_name && item.location_id === fromLocationId
      );
      setAvailableStock(locationItem?.quantity || 0);
    } else {
      setAvailableStock(0);
    }
  }, [selectedItem, fromLocationId, itemsWithLocations]);

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { data: user } = await supabase.auth.getUser();
      
      // Find the source item record
      const sourceItem = itemsWithLocations.find(
        item => item.item_name === data.item_name && item.location_id === data.from_location_id
      );
      
      if (!sourceItem) throw new Error("Source item not found");
      if (sourceItem.quantity < data.quantity) {
        throw new Error(`Insufficient stock. Available: ${sourceItem.quantity}`);
      }

      // 1. Reduce quantity at source location
      const newSourceQty = sourceItem.quantity - data.quantity;
      const { error: sourceError } = await supabase
        .from("construction_inventory_master")
        .update({ quantity: newSourceQty })
        .eq("id", sourceItem.id);
      
      if (sourceError) throw sourceError;

      // 2. Check if item exists at destination location
      const existingDestItem = itemsWithLocations.find(
        item => item.item_name === data.item_name && item.location_id === data.to_location_id
      );

      if (existingDestItem) {
        // Update existing record
        const newDestQty = existingDestItem.quantity + data.quantity;
        const { error: destError } = await supabase
          .from("construction_inventory_master")
          .update({ quantity: newDestQty })
          .eq("id", existingDestItem.id);
        
        if (destError) throw destError;
      } else {
        // Create new record at destination
        const { error: createError } = await supabase
          .from("construction_inventory_master")
          .insert({
            item_name: sourceItem.item_name,
            section: sourceItem.section,
            category: sourceItem.category,
            unit: data.unit,
            unit_cost: sourceItem.unit_cost,
            image_url: sourceItem.image_url,
            quantity: data.quantity,
            location_id: data.to_location_id,
            company_id: selectedCompany?.id,
            created_by: user.user?.id,
            status: "active",
          });
        
        if (createError) throw createError;
      }

      // 3. Log the transfer transaction
      const { error: transactionError } = await supabase
        .from("construction_inventory_transactions")
        .insert({
          item_id: sourceItem.id,
          transaction_type: "transfer",
          quantity_change: data.quantity,
          quantity_before: sourceItem.quantity,
          quantity_after: newSourceQty,
          from_location_id: data.from_location_id,
          to_location_id: data.to_location_id,
          notes: `Transferred ${data.quantity} ${data.unit} of ${data.item_name}`,
          company_id: selectedCompany?.id,
          created_by: user.user?.id,
        });

      if (transactionError) throw transactionError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-master"] });
      queryClient.invalidateQueries({ queryKey: ["construction-recent-transactions"] });
      toast({ title: "Transfer completed successfully" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Transfer failed", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        item_name: "",
        quantity: 1,
        unit: "",
        from_location_id: "",
        to_location_id: "",
      });
      setSelectedItemImage(null);
      setSelectedItem(null);
      setAvailableStock(0);
    }
  }, [open, form]);

  // Handle item selection
  const handleItemSelect = (itemName: string) => {
    form.setValue("item_name", itemName);
    form.setValue("from_location_id", "");
    form.setValue("to_location_id", "");
    
    const item = itemsWithLocations.find(i => i.item_name === itemName);
    
    if (item) {
      setSelectedItem(item);
      setSelectedItemImage(item.image_url || null);
      if (item.unit) {
        form.setValue("unit", item.unit);
      }
    } else {
      setSelectedItem(null);
      setSelectedItemImage(null);
    }
    
    setItemComboOpen(false);
  };

  const onSubmit = async (data: FormData) => {
    await transferMutation.mutateAsync(data);
  };

  const selectedItemValue = form.watch("item_name");
  const isQuantityExceeded = quantityValue > availableStock && availableStock > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            New Transfer
          </DialogTitle>
          <DialogDescription>
            Transfer inventory items between locations. Select an item and specify the source and destination.
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
                          {field.value || "Select an item to transfer"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search items..." />
                        <CommandList>
                          <CommandEmpty>No items with available stock found.</CommandEmpty>
                          <CommandGroup>
                            {uniqueItemNames.map((itemName) => {
                              const item = itemsWithLocations.find(i => i.item_name === itemName);
                              return (
                                <CommandItem
                                  key={itemName}
                                  value={itemName}
                                  onSelect={() => handleItemSelect(itemName)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedItemValue === itemName ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex items-center gap-2 flex-1">
                                    {item?.image_url ? (
                                      <img
                                        src={item.image_url}
                                        alt={itemName}
                                        className="h-8 w-8 rounded object-cover"
                                      />
                                    ) : (
                                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                    )}
                                    <div>
                                      <div className="font-medium">{itemName}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {item?.section} • {item?.category}
                                      </div>
                                    </div>
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Auto-filled Item Image */}
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

            {/* From and To Locations */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="from_location_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Location *</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={!selectedItem}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableFromLocations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name} ({location.quantity} available)
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
                name="to_location_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To Location *</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={!selectedItem}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select destination" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations
                          .filter(loc => loc.id !== fromLocationId)
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
            </div>

            {/* Available Stock Info */}
            {availableStock > 0 && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                Available at source: <span className="font-medium">{availableStock}</span>
              </div>
            )}

            {/* Quantity Exceeded Warning */}
            {isQuantityExceeded && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Quantity exceeds available stock ({availableStock})
                </AlertDescription>
              </Alert>
            )}

            {/* Quantity and Unit */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        min="1" 
                        max={availableStock || undefined}
                        placeholder="1" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={transferMutation.isPending || !selectedItem || isQuantityExceeded}
              >
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Transfer
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
