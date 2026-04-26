import { useEffect } from "react";
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
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import { useItemCategories } from "@/hooks/useItemCategories";
import { useCompany } from "@/contexts/CompanyContext";

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
  const { locations = [] } = useWarehouseLocations();
  const { categories = [] } = useItemCategories(selectedCompany?.id);

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
      } else if ("defaultValue" in p && p.defaultValue !== undefined) {
        next[p.key] = p.defaultValue;
        changed = true;
      }
    });
    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition.code]);

  const set = (key: string, v: unknown) => onChange({ ...values, [key]: v });

  return (
    <div className="grid gap-4">
      {definition.parameters.map((p) => (
        <div key={p.key} className="grid gap-2">
          <Label htmlFor={p.key}>{p.label}</Label>
          <ParameterInput
            param={p}
            value={values[p.key]}
            onChange={(v) => set(p.key, v)}
            locations={locations.filter((l) => l.type === "location")}
            categories={categories}
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
  categories,
}: {
  param: ReportParameter;
  value: unknown;
  onChange: (v: unknown) => void;
  locations: { id: string; name: string }[];
  categories: { id: string; name: string }[];
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
    case "location":
      return (
        <Select value={(value as string) ?? "all"} onValueChange={(v) => onChange(v === "all" ? null : v)}>
          <SelectTrigger id={param.key}>
            <SelectValue placeholder="All locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
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
  }
}
