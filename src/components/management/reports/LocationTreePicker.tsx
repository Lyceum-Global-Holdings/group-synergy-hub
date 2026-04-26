import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface LocationNode {
  id: string;
  name: string;
  type: string; // 'location' | 'sublocation' | 'department' | ...
  parent_id: string | null;
  depth?: number;
}

interface Props {
  id?: string;
  /** Selected node id, or null for "All locations". */
  value: string | null;
  onChange: (id: string | null) => void;
  /** Flat list of permitted nodes for the active company. */
  nodes: LocationNode[];
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

interface OrderedNode extends LocationNode {
  /** Indentation depth in the rendered tree (0-based). */
  uiDepth: number;
}

const TYPE_LABEL: Record<string, string> = {
  location: "LOC",
  sublocation: "SUB",
  department: "DEPT",
};

/**
 * Build a depth-first flattened ordering from the flat node list, using
 * `parent_id` to link children. Orphan nodes (parent missing because the user
 * lacks permission to it) are promoted to roots so they remain reachable.
 */
function flattenTree(nodes: LocationNode[]): OrderedNode[] {
  const byId = new Map<string, LocationNode>(nodes.map((n) => [n.id, n]));
  const childrenByParent = new Map<string | null, LocationNode[]>();

  for (const n of nodes) {
    const effectiveParent =
      n.parent_id && byId.has(n.parent_id) ? n.parent_id : null;
    const list = childrenByParent.get(effectiveParent) ?? [];
    list.push(n);
    childrenByParent.set(effectiveParent, list);
  }

  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  const out: OrderedNode[] = [];
  const walk = (parent: string | null, depth: number) => {
    const children = childrenByParent.get(parent) ?? [];
    for (const c of children) {
      out.push({ ...c, uiDepth: depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function LocationTreePicker({
  id,
  value,
  onChange,
  nodes,
  loading,
  disabled,
  placeholder = "All locations",
}: Props) {
  const [open, setOpen] = useState(false);

  const ordered = useMemo(() => flattenTree(nodes), [nodes]);
  const selected = value ? ordered.find((n) => n.id === value) ?? null : null;

  const triggerLabel = selected
    ? selected.name
    : loading
      ? "Loading locations…"
      : placeholder;

  return (
    <div className="grid gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              !selected && "text-muted-foreground",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              {selected && (
                <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">
                  {TYPE_LABEL[selected.type] ?? selected.type}
                </Badge>
              )}
              <span className="truncate">{triggerLabel}</span>
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
          <Command
            filter={(itemValue, search) => {
              if (!search) return 1;
              return itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <CommandInput
                placeholder="Search locations…"
                className="h-10 border-0 focus:ring-0"
              />
            </div>
            <CommandList className="max-h-[320px]">
              <CommandEmpty>No matching location.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__all_locations__"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="gap-2"
                >
                  <Check
                    className={cn("h-4 w-4", !value ? "opacity-100" : "opacity-0")}
                  />
                  <span className="font-medium">All locations</span>
                </CommandItem>
                {ordered.map((n) => (
                  <CommandItem
                    key={n.id}
                    // Include type so SUB/DEPT acronyms are searchable too.
                    value={`${n.name} ${TYPE_LABEL[n.type] ?? n.type}`}
                    onSelect={() => {
                      onChange(n.id);
                      setOpen(false);
                    }}
                    className="gap-2"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value === n.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span
                      className="flex min-w-0 flex-1 items-center gap-2"
                      style={{ paddingLeft: `${n.uiDepth * 14}px` }}
                    >
                      <span className="truncate">{n.name}</span>
                    </span>
                    <Badge
                      variant="outline"
                      className="ml-2 shrink-0 text-[10px] uppercase"
                    >
                      {TYPE_LABEL[n.type] ?? n.type}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-xs text-muted-foreground">
        Filters by the exact node selected. Pick a sub-location or department to drill down.
      </p>
    </div>
  );
}
