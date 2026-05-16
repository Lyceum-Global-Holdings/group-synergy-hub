import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePartialPieceItems } from "@/hooks/warehouse/usePartialPieces";

export interface PartialPieceItemOption {
  catalog_item_id: string;
  parent_item_id: string | null;
  item_code: string;
  item_name: string;
  base_uom: string | null;
  secondary_uom: string | null;
  unit_cost: number | null;
  track_secondary_quantity: boolean | null;
  has_inventory_row: boolean;
  piece_count: number;
}

interface Props {
  value?: string;
  onSelect: (item: PartialPieceItemOption | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const PAGE_SIZE = 100;

/**
 * Parent-item picker for partial pieces.
 *
 * Sourced from `list_partial_piece_items` RPC with server-side search and
 * pagination — supports the full Item Master (~15k items) without hitting
 * the 1,000-row REST cap or rendering everything into cmdk.
 */
export function PartialPieceItemPicker({
  value, onSelect, placeholder = "Search by item code or name…", className, disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [lastSelected, setLastSelected] = useState<PartialPieceItemOption | null>(null);

  // Debounce search input to limit RPC calls.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  const { data: items = [], isFetching } = usePartialPieceItems({
    search: debounced,
    limit: PAGE_SIZE,
  });

  // The current results may not contain the previously selected item; keep
  // it cached so the trigger label remains correct after search narrows.
  const selected = useMemo(() => {
    if (!value) return null;
    const inResults = items.find(i => i.catalog_item_id === value);
    if (inResults) return inResults;
    if (lastSelected && lastSelected.catalog_item_id === value) return lastSelected;
    return null;
  }, [items, value, lastSelected]);

  const totalCount = items[0]?.total_count;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
          disabled={disabled}
        >
          <div className="flex items-center gap-2 flex-1 text-left min-w-0">
            <Package className="h-4 w-4 shrink-0" />
            {selected ? (
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="secondary" className="text-xs shrink-0">{selected.item_code}</Badge>
                <span className="truncate">{selected.item_name}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search items by code or name..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {isFetching ? "Searching…" : "No active items found."}
            </CommandEmpty>
            <CommandGroup>
              {selected && (
                <CommandItem
                  onSelect={() => { onSelect(null); setOpen(false); }}
                  className="text-muted-foreground"
                >
                  <div className="w-4 h-4 mr-2" /> Clear selection
                </CommandItem>
              )}
              {items.map(it => (
                <CommandItem
                  key={it.catalog_item_id}
                  value={it.catalog_item_id}
                  onSelect={() => {
                    setLastSelected(it);
                    onSelect(it);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === it.catalog_item_id ? "opacity-100" : "opacity-0")} />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Badge variant="outline" className="text-xs shrink-0">{it.item_code || "—"}</Badge>
                    <span className="font-medium truncate flex-1">{it.item_name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {it.piece_count} pcs
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {typeof totalCount === "number" && totalCount > items.length && (
              <div className="px-3 py-2 text-xs text-muted-foreground border-t">
                Showing {items.length} of {totalCount.toLocaleString()} items — refine your search to see more.
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
