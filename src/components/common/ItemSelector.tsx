import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Package, Loader2 } from 'lucide-react';
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
import { WarehouseItem } from '@/types/itemBin';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';

interface ItemSelectorProps {
  value?: string;
  onSelect: (item: WarehouseItem | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /**
   * When provided, items are filtered to only those with stock at this location,
   * and quantities shown reflect per-location availability.
   */
  locationId?: string;
}

const PAGE_SIZE = 50;

/**
 * Server-side searched item picker. Uses the `list_warehouse_inventory` RPC
 * with a debounced search term — never full-fetches the catalog, so it stays
 * snappy with 14k+ items. See mem://performance/warehouse-inventory-server-pagination.
 */
export function ItemSelector({
  value,
  onSelect,
  placeholder = "Select item...",
  className,
  disabled = false,
  locationId,
}: ItemSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [cachedSelected, setCachedSelected] = useState<WarehouseItem | null>(null);
  const { selectedCompany, isViewingAllCompanies } = useCompany();

  // Debounce search input → 250ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const companyId = isViewingAllCompanies ? null : selectedCompany?.id ?? null;

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ['item-selector', companyId, debouncedSearch, locationId ?? null],
    enabled: open,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_warehouse_inventory' as any, {
        _company_id: companyId,
        _search: debouncedSearch || null,
        _category_id: null,
        _status: 'active',
        _location_ids: locationId ? [locationId] : null,
        _cursor_created_at: null,
        _cursor_id: null,
        _limit: PAGE_SIZE,
        _stock_mode: locationId ? 'in_stock' : 'all',
      } as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const items: WarehouseItem[] = useMemo(
    () =>
      rows.map((row: any) => ({
        ...row,
        supplier:
          row.supplier_id && row.supplier_name
            ? { id: row.supplier_id, name: row.supplier_name }
            : null,
        bins: Array.isArray(row.bins) && row.bins.length > 0 ? row.bins : null,
      })) as WarehouseItem[],
    [rows],
  );

  // Cache the selected item so the trigger label stays correct even
  // when the active row isn't in the current search page.
  useEffect(() => {
    if (!value) {
      setCachedSelected(null);
      return;
    }
    const inList = items.find((i) => i.id === value);
    if (inList) {
      setCachedSelected(inList);
      return;
    }
    if (cachedSelected?.id === value) return;
    // Fetch the single row so we can render its code/name.
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('warehouse_items_full' as any)
        .select('id, item_code, name, current_stock')
        .eq('id', value)
        .maybeSingle();
      if (!cancelled && !error && data) {
        setCachedSelected(data as unknown as WarehouseItem);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value, items, cachedSelected?.id]);

  const selectedItem = cachedSelected;

  const handleSelect = (item: WarehouseItem) => {
    setCachedSelected(item);
    onSelect(item);
    setOpen(false);
  };

  const handleClear = () => {
    setCachedSelected(null);
    onSelect(null);
    setOpen(false);
  };

  const stockLabel = (item: WarehouseItem) => {
    if (locationId) {
      return `Stock @ location: ${item.current_stock ?? 0}`;
    }
    return `Stock: ${item.current_stock ?? 0}`;
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
        <Command shouldFilter={false}>
          <div className="relative">
            <CommandInput
              placeholder="Search items by code or name..."
              value={search}
              onValueChange={setSearch}
            />
            {isFetching && (
              <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <CommandList>
            <CommandEmpty>
              {isFetching
                ? "Searching..."
                : locationId
                  ? "No items with stock at this location."
                  : debouncedSearch
                    ? "No items match your search."
                    : "Type to search items..."}
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
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
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
              {items.length === PAGE_SIZE && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
                  Showing first {PAGE_SIZE} results — refine search to narrow.
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
