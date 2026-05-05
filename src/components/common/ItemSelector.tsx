import React, { useEffect, useMemo, useState } from 'react';
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
import { supabase } from '@/integrations/supabase/client';

interface ItemSelectorProps {
  value?: string;
  onSelect: (item: WarehouseItem | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /**
   * When provided, items are filtered to only those with stock at this location,
   * and quantities shown reflect per-location availability (international stores standard).
   */
  locationId?: string;
}

export function ItemSelector({
  value,
  onSelect,
  placeholder = "Select item...",
  className,
  disabled = false,
  locationId,
}: ItemSelectorProps) {
  const [open, setOpen] = useState(false);
  const { items, isLoading } = useWarehouseItems();
  const [locationStock, setLocationStock] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!locationId) {
      setLocationStock(null);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('warehouse_bin_allocations')
        .select('warehouse_item_id, allocated_quantity, warehouse_bins!inner(location_id)')
        .eq('warehouse_bins.location_id', locationId);
      if (cancelled || error) return;
      const map: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        const id = row.warehouse_item_id;
        map[id] = (map[id] || 0) + Number(row.allocated_quantity || 0);
      });
      setLocationStock(map);
    })();
    return () => { cancelled = true; };
  }, [locationId]);

  const activeItems = useMemo(() => {
    const base = items.filter(item => item.status === 'active');
    if (!locationId || !locationStock) return base;
    return base.filter(item => (locationStock[item.id] || 0) > 0);
  }, [items, locationId, locationStock]);

  const selectedItem = activeItems.find(item => item.id === value)
    ?? items.find(item => item.id === value);

  const handleSelect = (item: WarehouseItem) => {
    onSelect(item);
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setOpen(false);
  };

  const stockLabel = (item: WarehouseItem) => {
    if (locationId && locationStock) {
      return `Stock @ location: ${locationStock[item.id] || 0}`;
    }
    return `Stock: ${item.current_stock || 0}`;
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
              {isLoading
                ? "Loading items..."
                : locationId
                  ? "No items with stock at this location."
                  : "No items found."}
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
                      {stockLabel(item)}
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
