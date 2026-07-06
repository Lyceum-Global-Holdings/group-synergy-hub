import { useMemo, useState } from "react";
import { Boxes, Search, Sparkles, Wrench, Ban, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useCompany } from "@/contexts/CompanyContext";
import { useCostumeStock, type StockUnit } from "@/hooks/useCostumeStock";
import { useCostumeUnits } from "@/hooks/useCostumeUnits";
import { UnitLifecycleDialog } from "@/components/tuh-modules/costume-rental/UnitLifecycleDialog";
import {
  STATUS_META, CONDITIONS, isActiveStock, conditionLabel,
} from "@/components/tuh-modules/costume-rental/unitLifecycle";
import type { UnitStatus } from "@/types/costumeRental";

const KPI_STATUSES: { key: UnitStatus | "needs_repair"; label: string }[] = [
  { key: "available", label: "Available" },
  { key: "out", label: "On rent" },
  { key: "cleaning", label: "Cleaning" },
  { key: "maintenance", label: "Maintenance" },
  { key: "needs_repair", label: "Needs repair" },
  { key: "retired", label: "Retired" },
  { key: "lost", label: "Lost" },
];

export default function CostumeStock() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { units, isLoading } = useCostumeStock(companyId);
  const { changeStatus, disposeUnit } = useCostumeUnits();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [manageUnit, setManageUnit] = useState<StockUnit | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [retireOpen, setRetireOpen] = useState(false);
  const [retireReason, setRetireReason] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const u of units) {
      c[u.status] = (c[u.status] ?? 0) + 1;
      if (u.condition === "needs_repair") c.needs_repair = (c.needs_repair ?? 0) + 1;
    }
    c.active = units.filter((u) => isActiveStock(u.status)).length;
    return c;
  }, [units]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return units.filter((u) => {
      const matchesSearch =
        u.unit_code.toLowerCase().includes(q) ||
        (u.costume?.name ?? "").toLowerCase().includes(q) ||
        (u.size ?? "").toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "attention"
          ? (u.condition === "needs_repair" || u.status === "cleaning" || u.status === "maintenance")
          : u.status === statusFilter);
      const matchesCond = conditionFilter === "all" || u.condition === conditionFilter;
      return matchesSearch && matchesStatus && matchesCond;
    });
  }, [units, search, statusFilter, conditionFilter]);

  const selectableIds = filtered.filter((u) => isActiveStock(u.status)).map((u) => u.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const bulkStatus = async (status: UnitStatus, reason: string) => {
    const ids = [...selected];
    await Promise.all(ids.map((id) => changeStatus.mutateAsync({ unitId: id, status, reason }).catch(() => null)));
    setSelected(new Set());
  };
  const bulkRetire = async () => {
    const ids = [...selected];
    await Promise.all(ids.map((id) => disposeUnit.mutateAsync({ unitId: id, reason: retireReason.trim() || "Bulk disposal" }).catch(() => null)));
    setSelected(new Set());
    setRetireOpen(false);
    setRetireReason("");
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Boxes className="h-6 w-6" /> Stock &amp; Maintenance
        </h1>
        <p className="text-sm text-muted-foreground">
          Fleet-wide costume unit lifecycle — condition, cleaning, maintenance and disposal (ISO 55000).
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="cursor-pointer" onClick={() => setStatusFilter("all")}>
          <CardContent className="p-3">
            <p className="text-2xl font-semibold">{counts.active ?? 0}</p>
            <p className="text-xs text-muted-foreground">Active units</p>
          </CardContent>
        </Card>
        {KPI_STATUSES.map((k) => (
          <Card key={k.key} className="cursor-pointer"
                onClick={() => setStatusFilter(k.key === "needs_repair" ? "attention" : k.key)}>
            <CardContent className="p-3">
              <p className="text-2xl font-semibold">{counts[k.key] ?? 0}</p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 w-64" placeholder="Search unit, costume or size…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="attention">Needs attention</SelectItem>
            {(Object.keys(STATUS_META) as UnitStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={conditionFilter} onValueChange={setConditionFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Condition" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All conditions</SelectItem>
            {CONDITIONS.map((c) => (
              <SelectItem key={c} value={c} className="capitalize">{conditionLabel(c)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-1">{filtered.length} unit(s)</span>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2">
          <span className="text-sm font-medium ml-1">{selected.size} selected</span>
          <Button size="sm" variant="secondary" onClick={() => bulkStatus("cleaning", "Bulk: sent to cleaning")}>
            <Sparkles className="h-4 w-4 mr-1" /> Send to cleaning
          </Button>
          <Button size="sm" variant="secondary" onClick={() => bulkStatus("maintenance", "Bulk: sent to maintenance")}>
            <Wrench className="h-4 w-4 mr-1" /> Send to maintenance
          </Button>
          <Button size="sm" variant="secondary" onClick={() => bulkStatus("available", "Bulk: returned to service")}>
            Mark available
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setRetireOpen(true)}>
            <Ban className="h-4 w-4 mr-1" /> Retire
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {/* Table */}
      {!companyId ? (
        <p className="text-sm text-muted-foreground">Select a company to view its stock.</p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Costume</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead className="text-right">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No units match.</TableCell></TableRow>
              )}
              {filtered.map((u) => (
                <TableRow key={u.id} className={u.condition === "needs_repair" ? "bg-destructive/5" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(u.id)}
                      onCheckedChange={() => toggleOne(u.id)}
                      disabled={!isActiveStock(u.status)}
                      aria-label={`Select ${u.unit_code}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono">{u.unit_code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded bg-muted overflow-hidden shrink-0">
                        {u.costume?.image_url && <img src={u.costume.image_url} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <span className="truncate">{u.costume?.name ?? "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>{u.size || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_META[u.status].variant} className="capitalize">{STATUS_META[u.status].label}</Badge>
                  </TableCell>
                  <TableCell className="capitalize">
                    <span className="inline-flex items-center gap-1">
                      {u.condition === "needs_repair" && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                      {conditionLabel(u.condition)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setManageUnit(u)}>Manage</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <UnitLifecycleDialog
        open={!!manageUnit}
        onOpenChange={(o) => !o && setManageUnit(null)}
        unit={manageUnit}
        costumeName={manageUnit?.costume?.name}
      />

      {/* Bulk retire reason */}
      <Dialog open={retireOpen} onOpenChange={setRetireOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Retire {selected.size} unit(s)</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This disposes the selected units — a terminal action.</p>
          <div className="space-y-1">
            <Label>Reason</Label>
            <Input value={retireReason} onChange={(e) => setRetireReason(e.target.value)} placeholder="e.g. End of life / damaged beyond repair" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetireOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={bulkRetire} disabled={disposeUnit.isPending}>Retire units</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
