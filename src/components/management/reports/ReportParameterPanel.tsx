import { useEffect, useMemo } from "react";
import { ReportDefinition, ReportParameter } from "@/lib/reports/registry";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStockBearingLocationsForCompany } from "@/hooks/useWarehouseLocations";
import {
  useUserLocationPermissions,
  useUserViewAllLocations,
} from "@/hooks/useUserLocationPermissions";
import { useItemCategories } from "@/hooks/useItemCategories";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLocationFilter } from "@/contexts/LocationFilterContext";
import { LocationTreePicker } from "@/components/management/reports/LocationTreePicker";
import { useBinsAtLocation } from "@/hooks/warehouse/useBinsAtLocation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  definition: ReportDefinition;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

function isoToday(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

export function ReportParameterPanel({ definition, values, onChange }: Props) {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { globalLocationId } = useLocationFilter();
  const { categories = [] } = useItemCategories(selectedCompany?.id);

  // Company-scoped + permission-aware location resolution.
  // Uses get_stock_bearing_locations_for_company so the picker exposes
  // every node a user can stock against — locations, sub-locations and
  // departments — matching SAP EWM Plant→StorLoc→Bin hierarchy.
  const { data: companyLocations = [], isLoading: locationsLoading } =
    useStockBearingLocationsForCompany(selectedCompany?.id);
  const { data: userPerms = [] } = useUserLocationPermissions(user?.id);
  const { data: viewAllLocations = false } = useUserViewAllLocations(user?.id);

  const allowedLocations = useMemo(() => {
    if (viewAllLocations) return companyLocations;
    if (!user?.id) return [] as typeof companyLocations;
    const allowedIds = new Set(userPerms.map((p) => p.location_id));
    // Strict per-node permission — matches the rest of the app. Children of a
    // permitted parent are NOT auto-included.
    return companyLocations.filter((l) => allowedIds.has(l.id));
  }, [companyLocations, userPerms, viewAllLocations, user?.id]);

  // Apply defaults on mount / definition change
  useEffect(() => {
    const next: Record<string, unknown> = { ...values };
    let changed = false;
    definition.parameters.forEach((p) => {
      if (next[p.key] !== undefined && next[p.key] !== null && next[p.key] !== "") return;
      if (p.type === "dateRange") {
        const days = p.defaultDays ?? 30;
        next[p.key] = { from: isoToday(days), to: isoToday(0) };
        changed = true;
      } else if (p.type === "textOperator") {
        next[p.key] = { op: "contains", term: "" };
        changed = true;
      } else if (p.type === "location" && globalLocationId) {
        // Seed from header global location filter only — actual scope check
        // happens in the dedicated effect below once allowedLocations resolves.
        next[p.key] = globalLocationId;
        changed = true;
      } else if ("defaultValue" in p && p.defaultValue !== undefined) {
        next[p.key] = p.defaultValue;
        changed = true;
      }
    });
    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition.code]);

  // Clear any locationId that is not in the allowed set for the active company.
  // Prevents silent zero-row reports after a company switch.
  useEffect(() => {
    if (locationsLoading) return;
    const allowedIds = new Set(allowedLocations.map((l) => l.id));
    const next: Record<string, unknown> = { ...values };
    let changed = false;
    definition.parameters.forEach((p) => {
      if (p.type !== "location") return;
      const current = next[p.key];
      if (typeof current === "string" && current && !allowedIds.has(current)) {
        next[p.key] = null;
        changed = true;
      }
    });
    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany?.id, allowedLocations, locationsLoading, definition.code]);

  const set = (key: string, v: unknown) => onChange({ ...values, [key]: v });

  // Clear any "bin" param whose scoping sibling (locationId) has changed/cleared.
  useEffect(() => {
    const next: Record<string, unknown> = { ...values };
    let changed = false;
    definition.parameters.forEach((p) => {
      if (p.type !== "bin") return;
      const scope = next[p.dependsOn];
      if (!scope && next[p.key]) {
        next[p.key] = null;
        changed = true;
      }
    });
    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition.code, JSON.stringify(definition.parameters.map((p) => (p.type === "bin" ? values[p.dependsOn] : null)))]);

  return (
    <div className="grid gap-4">
      {definition.parameters.map((p) => (
        <div key={p.key} className="grid gap-2">
          <Label htmlFor={p.key}>{p.label}</Label>
          <ParameterInput
            param={p}
            value={values[p.key]}
            onChange={(v) => set(p.key, v)}
            locations={allowedLocations}
            locationsLoading={locationsLoading}
            companySelected={!!selectedCompany?.id}
            categories={categories}
            siblingValues={values}
          />
        </div>
      ))}
      {definition.parameters.length === 0 && (
        <p className="text-sm text-muted-foreground">No parameters required for this report.</p>
      )}
    </div>
  );
}

function ParameterInput({
  param,
  value,
  onChange,
  locations,
  locationsLoading,
  companySelected,
  categories,
  siblingValues,
}: {
  param: ReportParameter;
  value: unknown;
  onChange: (v: unknown) => void;
  locations: { id: string; name: string; type: string; parent_id: string | null }[];
  locationsLoading: boolean;
  companySelected: boolean;
  categories: { id: string; name: string }[];
  siblingValues: Record<string, unknown>;
}) {
  switch (param.type) {
    case "date":
      return (
        <Input
          id={param.key}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "dateRange": {
      const v = (value as { from?: string; to?: string }) ?? {};
      return (
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            value={v.from ?? ""}
            onChange={(e) => onChange({ ...v, from: e.target.value })}
          />
          <Input
            type="date"
            value={v.to ?? ""}
            onChange={(e) => onChange({ ...v, to: e.target.value })}
          />
        </div>
      );
    }
    case "text":
      return (
        <Input
          id={param.key}
          type="text"
          placeholder={param.placeholder}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "select":
      return (
        <Select value={(value as string) ?? param.defaultValue ?? ""} onValueChange={onChange}>
          <SelectTrigger id={param.key}>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {param.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "boolean":
      return (
        <div className="flex items-center gap-3 pt-1">
          <Switch
            id={param.key}
            checked={Boolean(value)}
            onCheckedChange={(v) => onChange(v)}
          />
          <span className="text-sm text-muted-foreground">{value ? "Yes" : "No"}</span>
        </div>
      );
    case "location": {
      const disabled = !companySelected || (!locationsLoading && locations.length === 0);
      const placeholder = !companySelected
        ? "Select a company first"
        : locations.length === 0 && !locationsLoading
          ? "No locations allocated to this company"
          : "All locations";
      return (
        <>
          <LocationTreePicker
            id={param.key}
            value={(value as string) ?? null}
            onChange={(v) => onChange(v)}
            nodes={locations}
            loading={locationsLoading}
            disabled={disabled}
            placeholder={placeholder}
          />
          {!locationsLoading && companySelected && locations.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No locations are allocated to the active company. Ask an admin to assign locations.
            </p>
          )}
        </>
      );
    }
    case "bin": {
      const scopeId = siblingValues[param.dependsOn] as string | null | undefined;
      return <BinParamInput paramKey={param.key} locationId={scopeId ?? null} value={(value as string) ?? null} onChange={onChange} />;
    }
    case "category":
      return (
        <Select value={(value as string) ?? "all"} onValueChange={(v) => onChange(v === "all" ? null : v)}>
          <SelectTrigger id={param.key}>
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "supplier":
      // Supplier picker is handled by a future enhancement; for now render disabled
      return (
        <Input id={param.key} disabled placeholder="Supplier filter (coming soon)" />
      );
    case "item":
      return (
        <ItemParamInput
          paramKey={param.key}
          value={(value as string) ?? null}
          onChange={onChange}
          placeholder={param.placeholder}
        />
      );
    case "textOperator": {
      const v = (value as { op?: string; term?: string } | undefined) ?? {};
      const op = (v.op as NotesOp) || "contains";
      const term = v.term ?? "";
      return (
        <div className="grid grid-cols-[10rem_1fr] gap-2">
          <Select
            value={op}
            onValueChange={(next) => onChange({ op: next, term })}
          >
            <SelectTrigger aria-label={`${param.label} operator`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contains">contains</SelectItem>
              <SelectItem value="equals">equals</SelectItem>
              <SelectItem value="startsWith">starts with</SelectItem>
              <SelectItem value="endsWith">ends with</SelectItem>
              <SelectItem value="notContains">does not contain</SelectItem>
            </SelectContent>
          </Select>
          <Input
            id={param.key}
            type="text"
            placeholder={
              op === "contains"
                ? param.placeholder ?? 'e.g. damaged "return to vendor"'
                : "Enter text…"
            }
            value={term}
            onChange={(e) => onChange({ op, term: e.target.value })}
          />
        </div>
      );
    }
  }
}

type NotesOp =
  | "contains"
  | "equals"
  | "startsWith"
  | "endsWith"
  | "notContains";

function BinParamInput({
  paramKey,
  locationId,
  value,
  onChange,
}: {
  paramKey: string;
  locationId: string | null;
  value: string | null;
  onChange: (v: unknown) => void;
}) {
  const { data: bins = [], isLoading } = useBinsAtLocation(locationId);
  const disabled = !locationId || isLoading;
  return (
    <Select
      value={value ?? "all"}
      onValueChange={(v) => onChange(v === "all" ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger id={paramKey}>
        <SelectValue
          placeholder={
            !locationId
              ? "Pick a location first"
              : isLoading
                ? "Loading bins…"
                : bins.length === 0
                  ? "No bins at this location"
                  : "All bins"
          }
        />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All bins</SelectItem>
        {bins.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.bin_code}
            {b.name ? ` — ${b.name}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ItemParamInput({
  paramKey,
  value,
  onChange,
  placeholder,
}: {
  paramKey: string;
  value: string | null;
  onChange: (v: unknown) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Phrase-aware search via the search_warehouse_item_catalog RPC
  // (PostgreSQL FTS with websearch_to_tsquery + trigram typo tolerance).
  // Supports multi-word phrases in any order, "quoted phrases", OR and -exclude.
  const { data: results = [], isFetching } = useQuery({
    queryKey: ["report-item-picker", search],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_warehouse_item_catalog", {
        p_query: search.trim() || null,
        p_limit: 25,
      } as never);
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        item_code: string;
        name: string;
        brand: string | null;
        category_name: string | null;
        unit_name: string | null;
      }[];
    },
    staleTime: 30_000,
  });

  // Fetch the label for the currently-selected id (in case it isn't in the
  // current search results).
  const { data: selected } = useQuery({
    queryKey: ["report-item-picker-selected", value],
    queryFn: async () => {
      if (!value) return null;
      const { data, error } = await supabase
        .from("warehouse_item_catalog")
        .select("id, item_code, name")
        .eq("id", value)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; item_code: string; name: string } | null;
    },
    enabled: !!value,
    staleTime: 60_000,
  });

  const triggerLabel = selected
    ? `${selected.item_code} — ${selected.name}`
    : placeholder ?? "Search item…";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={paramKey}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,90vw)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by item code or name…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isFetching && (
              <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Searching…
              </div>
            )}
            {!isFetching && results.length === 0 && (
              <CommandEmpty>No items found.</CommandEmpty>
            )}
            <CommandGroup>
              {results.map((it) => (
                <CommandItem
                  key={it.id}
                  value={it.id}
                  onSelect={() => {
                    onChange(it.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === it.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {it.item_code} — {it.name}
                    </span>
                    {it.brand && (
                      <span className="text-xs text-muted-foreground">{it.brand}</span>
                    )}
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
