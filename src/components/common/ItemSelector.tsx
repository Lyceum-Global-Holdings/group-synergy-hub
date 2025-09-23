import React, { useState } from 'react';
import { Check, ChevronsUpDown, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWarehouseItems } from '@/hooks/useWarehouseItems';
import { WarehouseItem } from '@/types/itemBin';

interface ItemSelectorProps {
  value?: string;
  onSelect: (item: WarehouseItem | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function ItemSelector({
  value,
  onSelect,
  placeholder = "Select item...",
  className,
  disabled = false,
}: ItemSelectorProps) {
  const [open, setOpen] = useState(false);
  const { items, isLoading } = useWarehouseItems();

  const activeItems = items.filter(item => item.status === 'active');
  const selectedItem = activeItems.find(item => item.id === value);

  const handleSelect = (item: WarehouseItem) => {
    onSelect(item);
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
          disabled={disabled}
        >
          <div className="flex items-center gap-2 flex-1 text-left">
            <Package className="h-4 w-4 shrink-0" />
            {selectedItem ? (
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="secondary" className="text-xs">
                  {selectedItem.item_code}
                </Badge>
                <span className="truncate">{selectedItem.name}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search items by code or name..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Loading items..." : "No items found."}
            </CommandEmpty>
            <CommandGroup>
              {selectedItem && (
                <CommandItem onSelect={handleClear} className="text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4" />
                    <span>Clear selection</span>
                  </div>
                </CommandItem>
              )}
              {activeItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.item_code} ${item.name}`}
                  onSelect={() => handleSelect(item)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === item.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Badge variant="outline" className="text-xs shrink-0">
                      {item.item_code}
                    </Badge>
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="font-medium truncate">{item.name}</span>
                      {item.description && (
                        <span className="text-xs text-muted-foreground truncate">
                          {item.description}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      Stock: {item.current_stock || 0}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}