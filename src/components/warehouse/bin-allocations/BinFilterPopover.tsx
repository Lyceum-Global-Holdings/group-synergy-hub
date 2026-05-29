import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Boxes, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

export interface BinFilterOption {
  id: string;
  bin_code: string;
  name?: string | null;
  location_path?: string | null;
}

interface BinFilterPopoverProps {
  options: BinFilterOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  className?: string;
}

// Natural sort: "1-B-2-2" before "1-B-2-10"
const natCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

export function BinFilterPopover({
  options,
  selected,
  onChange,
  className,
}: BinFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const sorted = useMemo(
    () => [...options].sort((a, b) => natCompare(a.bin_code, b.bin_code)),
    [options],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (o) =>
        o.bin_code.toLowerCase().includes(q) ||
        (o.name ?? '').toLowerCase().includes(q) ||
        (o.location_path ?? '').toLowerCase().includes(q),
    );
  }, [sorted, search]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const selectAllFiltered = () => {
    const next = new Set(selected);
    filtered.forEach((o) => next.add(o.id));
    onChange(next);
  };

  const clear = () => onChange(new Set());

  const label = (() => {
    if (selected.size === 0) return 'All bins';
    if (selected.size === 1) {
      const only = sorted.find((o) => selected.has(o.id));
      return only ? only.bin_code : '1 bin';
    }
    return `${selected.size} bins`;
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between gap-2 min-w-[12rem]', className)}
        >
          <span className="flex items-center gap-2 truncate">
            <Boxes className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[20rem] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search bins by code, name, location..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No bins found.</CommandEmpty>
            <CommandGroup>
              {filtered.map((o) => {
                const isSelected = selected.has(o.id);
                return (
                  <CommandItem
                    key={o.id}
                    value={o.id}
                    onSelect={() => toggle(o.id)}
                    className="flex items-start gap-2"
                  >
                    <Check
                      className={cn(
                        'h-4 w-4 mt-0.5 shrink-0',
                        isSelected ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <div className="flex flex-col leading-tight min-w-0">
                      <span className="font-mono text-sm truncate">{o.bin_code}</span>
                      {o.location_path && (
                        <span className="text-xs text-muted-foreground truncate">
                          {o.location_path}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <div className="flex items-center justify-between px-2 py-1.5 text-xs">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                  onClick={selectAllFiltered}
                  disabled={!filtered.length}
                >
                  Select all ({filtered.length})
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-50 inline-flex items-center gap-1"
                  onClick={clear}
                  disabled={selected.size === 0}
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              </div>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
