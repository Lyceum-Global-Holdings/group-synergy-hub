import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCompany } from "@/contexts/CompanyContext";
import { useRentalOrders } from "@/hooks/useRentalOrders";
import { formatCurrency } from "@/lib/utils";
import type { RentalOrder, RentalOrderStatus } from "@/types/costumeRental";
import { CreateRentalOrderDialog } from "@/components/tuh-modules/costume-rental/CreateRentalOrderDialog";

const STATUS_VARIANT: Record<RentalOrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  pending_approval: "secondary",
  approved: "default",
  rejected: "destructive",
  checked_out: "default",
  returned: "secondary",
  completed: "default",
  cancelled: "destructive",
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default function CostumeRental() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { orders, isLoading } = useRentalOrders(companyId);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const isOverdue = (o: RentalOrder) => o.status === "checked_out" && new Date(o.due_date) < new Date();

  const filtered = useMemo(() =>
    orders.filter((o: RentalOrder) => {
      const q = search.toLowerCase();
      const matchesSearch = o.rental_number.toLowerCase().includes(q) ||
        (o.customer?.customer_name ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || o.status === statusFilter;
      const matchesOverdue = !overdueOnly || isOverdue(o);
      return matchesSearch && matchesStatus && matchesOverdue;
    }), [orders, search, statusFilter, overdueOnly]);

  const stats = useMemo(() => ({
    pending: orders.filter((o) => o.status === "pending_approval").length,
    out: orders.filter((o) => o.status === "checked_out").length,
    overdue: orders.filter(isOverdue).length,
    revenue: orders.filter((o) => o.status === "returned" || o.status === "completed")
      .reduce((s, o) => s + Number(o.total_amount || 0), 0),
    depositsHeld: orders.filter((o) => o.status === "checked_out")
      .reduce((s, o) => s + Number(o.deposit_total || 0), 0),
  }), [orders]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <CalendarClock className="h-6 w-6" /> Costume Rentals
          </h1>
          <p className="text-sm text-muted-foreground">Book costumes for a date range, approve, check out and return.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={!companyId}>
          <Plus className="h-4 w-4 mr-2" /> New Rental
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Pending approval</p>
          <p className="text-2xl font-semibold">{stats.pending}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Checked out</p>
          <p className="text-2xl font-semibold">{stats.out}</p>
        </CardContent></Card>
        <Card
          className={`cursor-pointer transition ${overdueOnly ? "ring-2 ring-destructive" : ""}`}
          onClick={() => setOverdueOnly((v) => !v)}
          title="Click to filter overdue rentals"
        ><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Overdue</p>
          <p className={`text-2xl font-semibold ${stats.overdue > 0 ? "text-destructive" : ""}`}>{stats.overdue}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Revenue (returned)</p>
          <p className="text-2xl font-semibold">{formatCurrency(stats.revenue)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Deposits held</p>
          <p className="text-2xl font-semibold">{formatCurrency(stats.depositsHeld)}</p>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search by number or customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["draft", "pending_approval", "approved", "checked_out", "returned", "completed", "rejected", "cancelled"].map((st) => (
              <SelectItem key={st} value={st} className="capitalize">{st.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {overdueOnly && (
          <Button variant="ghost" size="sm" onClick={() => setOverdueOnly(false)}>Clear overdue filter</Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rental #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!companyId ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Select a company.</TableCell></TableRow>
              ) : isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No rental orders yet.</TableCell></TableRow>
              ) : filtered.map((o: RentalOrder) => {
                const overdue = o.status === "checked_out" && new Date(o.due_date) < new Date();
                return (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => navigate(`/tuh-modules/costume-rental/${o.id}`)}>
                    <TableCell className="font-mono">{o.rental_number}</TableCell>
                    <TableCell>{o.customer?.customer_name ?? "—"}</TableCell>
                    <TableCell>{fmtDate(o.pickup_date)}</TableCell>
                    <TableCell className={overdue ? "text-destructive font-medium" : ""}>{fmtDate(o.due_date)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(o.total_amount)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={STATUS_VARIANT[o.status]} className="capitalize">{o.status.replace(/_/g, " ")}</Badge>
                        {overdue && <Badge variant="destructive">Overdue</Badge>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateRentalOrderDialog open={createOpen} onOpenChange={setCreateOpen} companyId={companyId} />
    </div>
  );
}
