import { useMemo, useState } from "react";
import { Plus, Search, Shirt, Tags, Pencil, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCompany } from "@/contexts/CompanyContext";
import { useCostumes } from "@/hooks/useCostumes";
import { useRentalCategories } from "@/hooks/useRentalCategories";
import { formatCurrency } from "@/lib/utils";
import type { Costume, RentalCategory } from "@/types/costumeRental";
import { CreateCostumeDialog } from "@/components/tuh-modules/costume-rental/CreateCostumeDialog";
import { ManageUnitsDialog } from "@/components/tuh-modules/costume-rental/ManageUnitsDialog";
import { RentalCategoriesDialog } from "@/components/tuh-modules/costume-rental/RentalCategoriesDialog";

const STATUS_VARIANT = {
  active: "default" as const,
  inactive: "secondary" as const,
  retired: "destructive" as const,
};

export default function CostumeCatalog() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { costumes, isLoading } = useCostumes(companyId);
  const { categories } = useRentalCategories(companyId);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editCostume, setEditCostume] = useState<Costume | null>(null);
  const [unitsCostume, setUnitsCostume] = useState<Costume | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const filtered = useMemo(() => {
    return costumes.filter((c: Costume) => {
      const q = search.toLowerCase();
      const matchesSearch =
        c.name.toLowerCase().includes(q) ||
        c.costume_code.toLowerCase().includes(q) ||
        (c.color ?? "").toLowerCase().includes(q) ||
        (c.theme ?? "").toLowerCase().includes(q);
      const matchesCat = categoryFilter === "all" || c.category_id === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [costumes, search, categoryFilter]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Shirt className="h-6 w-6" /> Costume Catalog
          </h1>
          <p className="text-sm text-muted-foreground">Rental costumes organised by category, with individual units.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCategoriesOpen(true)}>
            <Tags className="h-4 w-4 mr-2" /> Categories
          </Button>
          <Button onClick={() => { setEditCostume(null); setCreateOpen(true); }} disabled={!companyId}>
            <Plus className="h-4 w-4 mr-2" /> New Costume
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 w-64" placeholder="Search costumes…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c: RentalCategory) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-1">{filtered.length} costume(s)</span>
      </div>

      {!companyId ? (
        <p className="text-sm text-muted-foreground">Select a company to manage its costume catalog.</p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No costumes yet. Click "New Costume" to add one.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((c: Costume) => (
            <Card key={c.id} className="overflow-hidden">
              <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
                {c.image_url
                  ? <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" />
                  : <Shirt className="h-10 w-10 text-muted-foreground" />}
              </div>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{c.costume_code}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[c.status]} className="capitalize shrink-0">{c.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                  {c.category?.name && <Badge variant="outline">{c.category.name}</Badge>}
                  {c.size && <span>Size {c.size}</span>}
                  {c.color && <span>· {c.color}</span>}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{formatCurrency(c.daily_rate)}/day</span>
                  <span className="text-xs text-muted-foreground">
                    {c.available_units ?? 0}/{c.total_units ?? 0} available
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setUnitsCostume(c)}>
                    <Boxes className="h-4 w-4 mr-1" /> Units
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setEditCostume(c); setCreateOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateCostumeDialog open={createOpen} onOpenChange={setCreateOpen} companyId={companyId} costume={editCostume} />
      <ManageUnitsDialog open={!!unitsCostume} onOpenChange={(o) => !o && setUnitsCostume(null)} costume={unitsCostume} />
      <RentalCategoriesDialog open={categoriesOpen} onOpenChange={setCategoriesOpen} companyId={companyId} />
    </div>
  );
}
