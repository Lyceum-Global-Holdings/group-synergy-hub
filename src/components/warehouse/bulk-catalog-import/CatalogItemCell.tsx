import { useState, useMemo, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWarehouseCatalogPage } from '@/hooks/useWarehouseCatalogPage';

interface Props {
  value: string | null;
  display: string; // e.g. "ITM-001 — Name"
  onChange: (item: { id: string; item_code: string; name: string; unit_name: string | null }) => void;
}

export function CatalogItemCell({ value, display, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 200);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isFetching, fetchNextPage, hasNextPage, error } = useWarehouseCatalogPage({
    search: debouncedSearch || undefined,
    status: 'active',
    pageSize: 25,
    enabled: open,
  });

  const items = useMemo(() => (data?.pages ?? []).flat(), [data]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn('h-8 w-full justify-between font-normal text-xs', !value && 'text-muted-foreground')}
        >
          <span className="truncate">{display || 'Pick item…'}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search by code, name, GTIN…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>
              {isFetching
                ? 'Searching…'
                : error
                ? `Search failed: ${(error as Error).message}`
                : 'No items found.'}
            </CommandEmpty>
            <CommandGroup>
              {items.map((it) => (
                <CommandItem
                  key={it.id}
                  value={it.id}
                  onSelect={() => {
                    onChange({ id: it.id, item_code: it.item_code, name: it.name, unit_name: it.unit_name });
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === it.id ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex flex-col">
                    <span className="font-mono text-xs">{it.item_code}</span>
                    <span className="text-xs text-muted-foreground">{it.name}</span>
                  </div>
                </CommandItem>
              ))}
              {hasNextPage && (
                <div className="p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => fetchNextPage()}
                    disabled={isFetching}
                  >
                    {isFetching ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                    Load more
                  </Button>
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
