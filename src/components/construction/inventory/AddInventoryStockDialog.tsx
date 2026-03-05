import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, ChevronsUpDown, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useItemMaster, useLocations } from "@/hooks/construction/useConstructionInventory";
import { useAddStockToExistingItem } from "@/hooks/construction/useAddStockToExistingItem";
import { ITEM_CATEGORIES, type ItemCategory } from "@/types/construction-inventory";
import { Alert, AlertDescription } from "@/components/ui/alert";

const formSchema = z.object({
  item_master_id: z.string().min(1, "Please select an item from the Item Master"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  location_id: z.string().min(1, "Please select a location"),
});

type FormData = z.infer<typeof formSchema>;

interface AddInventoryStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ItemCategory;
}

export function AddInventoryStockDialog({ open, onOpenChange, category }: AddInventoryStockDialogProps) {
  const [itemPopoverOpen, setItemPopoverOpen] = useState(false);
  const { data: items, isLoading: itemsLoading } = useItemMaster(category);
  const { data: locations } = useLocations();
  const addStock = useAddStockToExistingItem();

  const categoryLabel = ITEM_CATEGORIES.find(c => c.value === category)?.label || "Items";

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      item_master_id: "",
      quantity: undefined,
      location_id: "",
    },
  });

  const selectedItemId = form.watch("item_master_id");
  const selectedItem = items?.find(i => i.id === selectedItemId);

  const onSubmit = async (values: FormData) => {
    await addStock.mutateAsync({
      item_master_id: values.item_master_id,
      quantity: values.quantity,
      location_id: values.location_id,
    });
    form.reset();
    onOpenChange(false);
  };

  const hasItems = items && items.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add {categoryLabel.slice(0, -1)} Inventory</DialogTitle>
          <DialogDescription>
            Select an existing item from the Item Master and add stock quantity.
          </DialogDescription>
        </DialogHeader>

        {!itemsLoading && !hasItems ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No {categoryLabel.toLowerCase()} found in the Item Master. Please create the item in the{" "}
              <strong>Item Master</strong> tab first before adding inventory.
            </AlertDescription>
          </Alert>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Item Selector - searchable dropdown */}
              <FormField
                control={form.control}
                name="item_master_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Select Item from Item Master *</FormLabel>
                    <Popover open={itemPopoverOpen} onOpenChange={setItemPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {selectedItem
                              ? `${selectedItem.item_code} — ${selectedItem.item_name}`
                              : "Search and select an item..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search by name or code..." />
                          <CommandList>
                            <CommandEmpty>
                              No items found. Create the item in the Item Master first.
                            </CommandEmpty>
                            <CommandGroup>
                              {items?.map(item => (
                                <CommandItem
                                  key={item.id}
                                  value={`${item.item_code} ${item.item_name}`}
                                  onSelect={() => {
                                    field.onChange(item.id);
                                    setItemPopoverOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === item.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">{item.item_name}</span>
                                    <span className="text-xs text-muted-foreground font-mono">
                                      {item.item_code} · {item.unit_of_measurement}
                                    </span>
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

              {/* Selected item info */}
              {selectedItem && (
                <div className="rounded-md border p-3 bg-muted/30 text-sm space-y-1">
                  <p><strong>Item:</strong> {selectedItem.item_name}</p>
                  <p><strong>Code:</strong> {selectedItem.item_code}</p>
                  <p><strong>Unit:</strong> {selectedItem.unit_of_measurement}</p>
                  {selectedItem.brand && <p><strong>Brand:</strong> {selectedItem.brand}</p>}
                </div>
              )}

              {/* Quantity & Location */}
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
                          min={1}
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
                      <FormLabel>Location *</FormLabel>
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

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addStock.isPending}>
                  {addStock.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Stock
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
