import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Shirt, Tags, Pencil, Boxes, ShoppingCart, Check } from "lucide-react";
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
import { cn, formatCurrency } from "@/lib/utils";
import type { Costume, RentalCategory } from "@/types/costumeRental";
import { costumeSizeOptions, sizeLabel } from "@/components/tuh-modules/costume-rental/sizeUtils";
import { CreateCostumeDialog } from "@/components/tuh-modules/costume-rental/CreateCostumeDialog";
import { ManageUnitsDialog } from "@/components/tuh-modules/costume-rental/ManageUnitsDialog";
import { RentalCategoriesDialog } from "@/components/tuh-modules/costume-rental/RentalCategoriesDialog";
import { CostumeCartSheet } from "@/components/tuh-modules/costume-rental/CostumeCartSheet";
import { CostumeDetailDialog } from "@/components/tuh-modules/costume-rental/CostumeDetailDialog";
import { AddToBucketDialog } from "@/components/tuh-modules/costume-rental/AddToBucketDialog";
import { useCostumeCart } from "@/contexts/CostumeCartContext";

const STATUS_VARIANT = {
  active: "default" as const,
  inactive: "secondary" as const,
  retired: "destructive" as const,
};

export default function CostumeCatalog() {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { costumes, isLoading } = useCostumes(companyId);
  const { categories } = useRentalCategories(companyId);
  const cart = useCostumeCart();

  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editCostume, setEditCostume] = useState<Costume | null>(null);
  const [unitsCostume, setUnitsCostume] = useState<Costume | null>(null);
  const [detailCostume, setDetailCostume] = useState<Costume | null>(null);
  const [addCostume, setAddCostume] = useState<Costume | null>(null);
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
          <Button variant="outline" className="relative" onClick={() => setCartOpen(true)}>
            <ShoppingCart className="h-4 w-4 mr-2" /> Bucket
            {cart.count > 0 && (
              <Badge className="ml-2 px-1.5 py-0 h-5 min-w-5 justify-center">{cart.count}</Badge>
            )}
          </Button>
          <Button variant="outline" onClick={() => navigate("/tuh-modules/costume-stock")}>
            <Boxes className="h-4 w-4 mr-2" /> Stock
          </Button>
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
            <Card key={c.id} className="overflow-hidden group flex flex-col transition hover:shadow-md">
              <div className="relative aspect-[4/5] bg-muted overflow-hidden cursor-pointer"
                   onClick={() => setDetailCostume(c)} title="View details">
                {c.image_url
                  ? <img src={c.image_url} alt={c.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  : <div className="h-full w-full flex items-center justify-center"><Shirt className="h-10 w-10 text-muted-foreground" /></div>}
                <Badge variant={STATUS_VARIANT[c.status]} className="absolute top-2 right-2 capitalize shadow">{c.status}</Badge>
                {(c.image_urls?.length ?? 0) > 1 && (
                  <span className="absolute bottom-2 right-2 text-[10px] font-medium bg-background/90 shadow rounded-full px-1.5">{c.image_urls!.length} photos</span>
                )}
              </div>
              <CardContent className="p-3 flex flex-col flex-1 gap-2">
                <div className="min-w-0">
                  <button className="text-left w-full" onClick={() => setDetailCostume(c)}>
                    <p className="font-medium leading-tight truncate hover:underline">{c.name}</p>
                  </button>
                  <p className="text-xs text-muted-foreground font-mono">{c.costume_code}</p>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold">{formatCurrency(c.daily_rate)}<span className="text-xs font-normal text-muted-foreground">/day</span></span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn("h-2 w-2 rounded-full", (c.available_units ?? 0) > 0 ? "bg-green-500" : "bg-muted-foreground/40")} />
                    {c.available_units ?? 0}/{c.total_units ?? 0}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {c.category?.name && <Badge variant="outline" className="text-[10px]">{c.category.name}</Badge>}
                  {costumeSizeOptions(c).slice(0, 4).map((s) => (
                    <Badge key={s.size || "_one"} variant="secondary" className="text-[10px]">{sizeLabel(s.size)}</Badge>
                  ))}
                </div>

                <div className="flex items-center gap-2 mt-auto pt-1">
                  {cart.quantityOfCostume(c.id) > 0 ? (
                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => setAddCostume(c)} disabled={c.status !== "active"}>
                      <Check className="h-4 w-4 mr-1" /> In bucket ({cart.quantityOfCostume(c.id)})
                    </Button>
                  ) : (
                    <Button
                      size="sm" className="flex-1"
                      disabled={c.status !== "active"}
                      onClick={() => setAddCostume(c)}
                      title={c.status !== "active" ? "Costume is not active" : "Add to bucket"}
                    >
                      <ShoppingCart className="h-4 w-4 mr-1" /> Add
                    </Button>
                  )}
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setUnitsCostume(c)} title="Manage units">
                    <Boxes className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditCostume(c); setCreateOpen(true); }} title="Edit">
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
      <CostumeCartSheet open={cartOpen} onOpenChange={setCartOpen} companyId={companyId} />
      <CostumeDetailDialog
        open={!!detailCostume}
        onOpenChange={(o) => !o && setDetailCostume(null)}
        costume={detailCostume}
        onManageUnits={(c) => { setDetailCostume(null); setUnitsCostume(c); }}
        onEdit={(c) => { setDetailCostume(null); setEditCostume(c); setCreateOpen(true); }}
      />
      <AddToBucketDialog open={!!addCostume} onOpenChange={(o) => !o && setAddCostume(null)} costume={addCostume} />
    </div>
  );
}
