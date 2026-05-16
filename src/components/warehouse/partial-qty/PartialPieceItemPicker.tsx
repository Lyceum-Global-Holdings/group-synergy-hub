import { useMemo, useState } from "react";
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

/**
 * Lightweight parent-item picker for partial pieces.
 * Sourced from `list_partial_piece_items` RPC (single query, all active items),
 * which is realtime-invalidated on Item Master changes — so newly added or
 * edited items appear immediately without re-fetching the heavy warehouse_items
 * list with allocations.
 */
export function PartialPieceItemPicker({
  value, onSelect, placeholder = "Search by item code or name…", className, disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const { data: items = [], isLoading } = usePartialPieceItems();

  const selected = useMemo(
    () => items.find(i => i.catalog_item_id === value) || null,
    [items, value],
  );

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
        <Command>
          <CommandInput placeholder="Search items by code or name..." />
          <CommandList>
            <CommandEmpty>{isLoading ? "Loading items…" : "No active items found."}</CommandEmpty>
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
                  key={it.parent_item_id}
                  value={`${it.item_code} ${it.item_name}`}
                  onSelect={() => { onSelect(it); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === it.parent_item_id ? "opacity-100" : "opacity-0")} />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Badge variant="outline" className="text-xs shrink-0">{it.item_code}</Badge>
                    <span className="font-medium truncate flex-1">{it.item_name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {it.piece_count} pcs
                    </span>
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
