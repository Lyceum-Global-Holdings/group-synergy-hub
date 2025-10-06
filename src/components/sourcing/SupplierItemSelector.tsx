import { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useWarehouseItems } from "@/hooks/useWarehouseItems";
import { Badge } from "@/components/ui/badge";

interface SupplierItemSelectorProps {
  selectedItems: string[];
  onItemsChange: (itemIds: string[]) => void;
  excludeItemIds?: string[];
}

export function SupplierItemSelector({ selectedItems, onItemsChange, excludeItemIds = [] }: SupplierItemSelectorProps) {
  const [open, setOpen] = useState(false);
  const { items, isLoading } = useWarehouseItems();

  const availableItems = items?.filter(item => 
    !excludeItemIds.includes(item.id) && !selectedItems.includes(item.id)
  ) || [];

  const handleSelect = (itemId: string) => {
    onItemsChange([...selectedItems, itemId]);
    setOpen(false);
  };

  const handleRemove = (itemId: string) => {
    onItemsChange(selectedItems.filter(id => id !== itemId));
  };

  const getItemById = (id: string) => items?.find(item => item.id === id);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Search and add items from Item Master
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search items..." />
            <CommandEmpty>
              {isLoading ? "Loading items..." : "No items found."}
            </CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {availableItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.item_code} ${item.name}`}
                  onSelect={() => handleSelect(item.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedItems.includes(item.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{item.item_code} - {item.name}</span>
                    <span className="text-sm text-muted-foreground">
                      Stock: {item.current_stock}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedItems.map((itemId) => {
            const item = getItemById(itemId);
            if (!item) return null;
            return (
              <Badge key={itemId} variant="secondary" className="text-sm">
                {item.item_code} - {item.name}
                <button
                  onClick={() => handleRemove(itemId)}
                  className="ml-2 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
