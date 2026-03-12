import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Eye, Loader2 } from "lucide-react";
import { useProductionOrders, useProductionSectors } from "@/hooks/useProduction";
import { PRODUCTION_ORDER_STATUSES } from "@/constants/productionSectors";
import CreateProductionOrderDialog from "./CreateProductionOrderDialog";
import { format } from "date-fns";

interface Props {
  onViewOrder: (id: string) => void;
}

export default function ProductionOrdersList({ onViewOrder }: Props) {
  const { data: orders, isLoading } = useProductionOrders();
  const { data: sectors } = useProductionSectors();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o) => {
      const matchSearch = !search || o.product_name.toLowerCase().includes(search.toLowerCase()) || o.order_number.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || o.status === statusFilter;
      const matchSector = sectorFilter === "all" || o.sector_id === sectorFilter;
      return matchSearch && matchStatus && matchSector;
    });
  }, [orders, search, statusFilter, sectorFilter]);

  const getStatusBadge = (status: string) => {
    const s = PRODUCTION_ORDER_STATUSES.find((st) => st.value === status);
    return <Badge variant="outline" className={s?.color || ""}>{s?.label || status}</Badge>;
  };

  return (
    <>
      <Card className="mt-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Production Orders</CardTitle>
            <Button onClick={() => setDialogOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" /> New Order
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {PRODUCTION_ORDER_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sector" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sectors</SelectItem>
                {sectors?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No production orders found</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Sector</TableHead>
                    <TableHead>Target Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o) => {
                    const stages = (o as any).production_order_stages || [];
                    const done = stages.filter((s: any) => s.status === "completed").length;
                    const pct = stages.length > 0 ? Math.round((done / stages.length) * 100) : 0;
                    return (
                      <TableRow key={o.id} className="cursor-pointer hover:bg-accent/50" onClick={() => onViewOrder(o.id)}>
                        <TableCell className="font-medium">{o.order_number}</TableCell>
                        <TableCell>{o.product_name}{o.style_no ? ` (${o.style_no})` : ""}</TableCell>
                        <TableCell>{(o as any).production_sectors?.name || "—"}</TableCell>
                        <TableCell>{o.target_qty?.toLocaleString()}</TableCell>
                        <TableCell>{getStatusBadge(o.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs">{pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell>{format(new Date(o.created_at), "dd MMM yyyy")}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onViewOrder(o.id); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateProductionOrderDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
