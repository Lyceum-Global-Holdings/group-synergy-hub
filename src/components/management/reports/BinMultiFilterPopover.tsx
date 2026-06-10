import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Boxes, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type BinMultiMode = "include" | "exclude";

export interface BinMultiFilterValue {
  mode: BinMultiMode;
  binIds: string[];
}

export interface BinMultiFilterOption {
  id: string;
  bin_code: string;
  name?: string | null;
  location_path?: string | null;
}

interface Props {
  id?: string;
  options: BinMultiFilterOption[];
  loading?: boolean;
  disabled?: boolean;
  value: BinMultiFilterValue;
  onChange: (v: BinMultiFilterValue) => void;
  emptyHint?: string;
  disabledHint?: string;
}

const natCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

const EMPTY: BinMultiFilterValue = { mode: "include", binIds: [] };

export function normalizeBinMultiValue(v: unknown): BinMultiFilterValue {
  if (!v || typeof v !== "object") return { ...EMPTY };
  const raw = v as Partial<BinMultiFilterValue>;
  const mode: BinMultiMode = raw.mode === "exclude" ? "exclude" : "include";
  const binIds = Array.isArray(raw.binIds)
    ? raw.binIds.filter((x): x is string => typeof x === "string")
    : [];
  return { mode, binIds };
}

export function BinMultiFilterPopover({
  id,
  options,
  loading,
  disabled,
  value,
  onChange,
  emptyHint,
  disabledHint,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const safeValue = normalizeBinMultiValue(value);
  const selected = new Set(safeValue.binIds);

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
        (o.name ?? "").toLowerCase().includes(q) ||
        (o.location_path ?? "").toLowerCase().includes(q),
    );
  }, [sorted, search]);

  const toggle = (binId: string) => {
    const next = new Set(selected);
    if (next.has(binId)) next.delete(binId);
    else next.add(binId);
    onChange({ mode: safeValue.mode, binIds: Array.from(next) });
  };

  const selectAllFiltered = () => {
    const next = new Set(selected);
    filtered.forEach((o) => next.add(o.id));
    onChange({ mode: safeValue.mode, binIds: Array.from(next) });
  };

  const clear = () => onChange({ mode: safeValue.mode, binIds: [] });

  const setMode = (mode: BinMultiMode) =>
    onChange({ mode, binIds: safeValue.binIds });

  const triggerLabel = (() => {
    if (disabled && disabledHint) return disabledHint;
    if (loading) return "Loading bins…";
    if (sorted.length === 0) return emptyHint ?? "No allocated bins";
    if (selected.size === 0) return "All bins";
    if (selected.size === 1) {
      const only = sorted.find((o) => selected.has(o.id));
      const code = only?.bin_code ?? "1 bin";
      return safeValue.mode === "exclude" ? `Excluding ${code}` : code;
    }
    return safeValue.mode === "exclude"
      ? `${selected.size} bins excluded`
      : `${selected.size} bins included`;
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className="w-full justify-between gap-2 font-normal"
        >
          <span className="flex items-center gap-2 truncate">
            <Boxes className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{triggerLabel}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,90vw)] p-0" align="start">
        <div className="flex items-center gap-1 border-b px-2 py-2">
          <Button
            type="button"
            size="sm"
            variant={safeValue.mode === "include" ? "default" : "ghost"}
            className="h-7 flex-1 text-xs"
            onClick={() => setMode("include")}
          >
            Include selected
          </Button>
          <Button
            type="button"
            size="sm"
            variant={safeValue.mode === "exclude" ? "default" : "ghost"}
            className="h-7 flex-1 text-xs"
            onClick={() => setMode("exclude")}
          >
            Exclude selected
          </Button>
        </div>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search bins by code, name, location…"
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
                        "h-4 w-4 mt-0.5 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col leading-tight min-w-0">
                      <span className="font-mono text-sm truncate">
                        {o.bin_code}
                        {o.name ? (
                          <span className="ml-1 text-muted-foreground font-sans">
                            — {o.name}
                          </span>
                        ) : null}
                      </span>
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
