import { useMemo, useState } from "react";
import { Briefcase, Plus, Search, Pencil, History, Sparkles, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useCompany } from "@/contexts/CompanyContext";
import { useServices, useServicePriceHistory } from "@/hooks/useServices";
import { SERVICE_UNITS, type Service } from "@/types/sales";

function ServiceDialog({ open, onOpenChange, service, companyId }: {
  open: boolean; onOpenChange: (o: boolean) => void; service: Service | null; companyId?: string;
}) {
  const { createService, updateService } = useServices(companyId);
  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [category, setCategory] = useState(service?.category ?? "");
  const [unit, setUnit] = useState(service?.unit ?? "job");
  const [price, setPrice] = useState(String(service?.default_price ?? ""));
  const [active, setActive] = useState(service?.is_active ?? true);

  // Re-seed when a different service is opened.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (open && seededFor !== (service?.id ?? "new")) {
    setSeededFor(service?.id ?? "new");
    setName(service?.name ?? "");
    setDescription(service?.description ?? "");
    setCategory(service?.category ?? "");
    setUnit(service?.unit ?? "job");
    setPrice(String(service?.default_price ?? ""));
    setActive(service?.is_active ?? true);
  }

  const save = async () => {
    if (!name.trim() || !companyId) return;
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      unit,
      default_price: Number(price) || 0,
      is_active: active,
    };
    if (service) await updateService.mutateAsync({ id: service.id, ...payload });
    else await createService.mutateAsync({ ...payload, company_id: companyId });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{service ? `Edit — ${service.service_code}` : "New Service"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Site Survey" /></div>
          <div className="space-y-1"><Label>Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Field" /></div>
            <div className="space-y-1"><Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1"><Label>Default price (LKR)</Label>
              <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
            <label className="flex items-center gap-2 text-sm pb-2">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!name.trim() || createService.isPending || updateService.isPending}>
            {service ? "Save changes" : "Create service"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PriceHistoryDialog({ open, onOpenChange, service }: {
  open: boolean; onOpenChange: (o: boolean) => void; service: Service | null;
}) {
  const { formatCurrency } = useCompany();
  const { history } = useServicePriceHistory(open ? service?.id : undefined);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Price history — {service?.name}</DialogTitle></DialogHeader>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No price changes recorded yet.</p>
        ) : (
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {history.map((h) => (
              <li key={h.id} className="text-sm border-l-2 pl-3">
                <span className="font-medium">
                  {h.old_price != null ? formatCurrency(Number(h.old_price)) : "—"} → {formatCurrency(Number(h.new_price))}
                </span>
                <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ServicesPage() {
  const { selectedCompany, formatCurrency } = useCompany();
  const companyId = selectedCompany?.id;
  const { services, templates, isLoading, customizeTemplate } = useServices(companyId);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [historyFor, setHistoryFor] = useState<Service | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return services.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.service_code.toLowerCase().includes(q) ||
      (s.category ?? "").toLowerCase().includes(q));
  }, [services, search]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Briefcase className="h-6 w-6" /> Services
          </h1>
          <p className="text-sm text-muted-foreground">
            Services this company provides. Prices here are list prices — quotes can override per line.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} disabled={!companyId}>
          <Plus className="h-4 w-4 mr-2" /> New Service
        </Button>
      </div>

      {/* Generic templates gallery */}
      {templates.length > 0 && companyId && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Generic services
            </CardTitle>
            <CardDescription>
              Shared templates — add one to your company to customize its name and pricing.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <Button
                key={t.id} variant="outline" size="sm"
                onClick={() => customizeTemplate.mutate(t.id)}
                disabled={customizeTemplate.isPending}
                title={`${t.description ?? ""} · list ${formatCurrency(Number(t.default_price))}`}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                {t.name} · {formatCurrency(Number(t.default_price))}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="relative w-72">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search services…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">List price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!companyId ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Select a company.</TableCell></TableRow>
            ) : isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No services yet — create one or add a generic service above.
              </TableCell></TableRow>
            ) : filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.service_code}</TableCell>
                <TableCell>
                  <p className="font-medium">{s.name}</p>
                  {s.description && <p className="text-xs text-muted-foreground truncate max-w-72">{s.description}</p>}
                </TableCell>
                <TableCell>{s.category ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{s.unit}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(Number(s.default_price))}</TableCell>
                <TableCell>
                  <Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Price history" onClick={() => setHistoryFor(s)}>
                    <History className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => { setEditing(s); setDialogOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ServiceDialog open={dialogOpen} onOpenChange={setDialogOpen} service={editing} companyId={companyId} />
      <PriceHistoryDialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)} service={historyFor} />
    </div>
  );
}
