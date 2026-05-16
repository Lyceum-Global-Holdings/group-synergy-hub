import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface ItemSearchOption {
  id: string;
  item_code: string;
  name: string;
}

interface ItemSearchComboboxProps {
  value: string;
  onChange: (value: string, option: ItemSearchOption | null) => void;
  /** Label shown when value is empty / "all". */
  allLabel?: string;
  /** When true, an explicit "All Items" sentinel option with value `"all"` is offered. */
  includeAllOption?: boolean;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
}

/**
 * Async, server-paginated item picker.
 * Hits `list_warehouse_inventory` RPC with a debounced search string,
 * so it stays fast even with 14k+ items in the catalog.
 */
export function ItemSearchCombobox({
  value,
  onChange,
  allLabel = 'All Items',
  includeAllOption = true,
  placeholder = 'Search by code or name...',
  className,
  triggerClassName,
}: ItemSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const { selectedCompany, isViewingAllCompanies } = useCompany();

  // Debounce input
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Track latest query to drop stale results
  const latestQueryRef = useRef('');
  latestQueryRef.current = debounced;

  const { data: options = [], isFetching } = useQuery<ItemSearchOption[]>({
    queryKey: [
      'item-search-combobox',
      selectedCompany?.id,
      isViewingAllCompanies,
      debounced,
    ],
    enabled: open && !!(isViewingAllCompanies || selectedCompany?.id),
    queryFn: async () => {
      const q = latestQueryRef.current;
      const { data, error } = await supabase.rpc('list_warehouse_inventory' as any, {
        _company_id: isViewingAllCompanies ? null : selectedCompany?.id ?? null,
        _search: q || null,
        _category_id: null,
        _status: 'active',
        _location_ids: null,
        _cursor_created_at: null,
        _cursor_id: null,
        _limit: 25,
        _stock_mode: 'all',
        _supplier_id: null,
      } as any);
      if (error) throw error;
      // Drop stale responses
      if (latestQueryRef.current !== q) return [];
      return ((data || []) as any[]).map((row) => ({
        id: row.id,
        item_code: row.item_code,
        name: row.name,
      }));
    },
    staleTime: 30_000,
  });

  // Display label resolution
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!value || value === 'all') {
      setSelectedLabel(null);
      return;
    }
    const inList = options.find((o) => o.id === value);
    if (inList) setSelectedLabel(`${inList.item_code} — ${inList.name}`);
  }, [value, options]);

  const display = value === 'all' || !value ? allLabel : selectedLabel ?? 'Selected item';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-[260px] justify-between', triggerClassName)}
        >
          <span className="truncate">{display}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('w-[320px] p-0', className)} align="end">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder={placeholder}
              className="h-10 border-0 focus:ring-0"
            />
            {isFetching && <Loader2 className="ml-2 h-4 w-4 animate-spin opacity-60" />}
          </div>
          <CommandList className="max-h-[320px]">
            {includeAllOption && (
              <CommandGroup>
                <CommandItem
                  value="__all__"
                  onSelect={() => {
                    onChange('all', null);
                    setSelectedLabel(null);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === 'all' || !value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {allLabel}
                </CommandItem>
              </CommandGroup>
            )}
            {options.length === 0 && !isFetching ? (
              <CommandEmpty>
                {debounced ? 'No items match your search.' : 'Type to search items…'}
              </CommandEmpty>
            ) : (
              <CommandGroup heading={debounced ? 'Results' : 'Recent items'}>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.id}
                    value={opt.id}
                    onSelect={() => {
                      onChange(opt.id, opt);
                      setSelectedLabel(`${opt.item_code} — ${opt.name}`);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === opt.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="font-mono text-xs text-muted-foreground mr-2">
                      {opt.item_code}
                    </span>
                    <span className="truncate">{opt.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
