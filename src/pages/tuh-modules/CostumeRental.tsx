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
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() =>
    orders.filter((o: RentalOrder) => {
      const q = search.toLowerCase();
      return o.rental_number.toLowerCase().includes(q) ||
        (o.customer?.customer_name ?? "").toLowerCase().includes(q);
    }), [orders, search]);

  const stats = useMemo(() => ({
    total: orders.length,
    pending: orders.filter((o) => o.status === "pending_approval").length,
    out: orders.filter((o) => o.status === "checked_out").length,
    overdue: orders.filter((o) => o.status === "checked_out" && new Date(o.due_date) < new Date()).length,
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total },
          { label: "Pending approval", value: stats.pending },
          { label: "Checked out", value: stats.out },
          { label: "Overdue", value: stats.overdue },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-semibold">{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="relative w-72">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search by number or customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                      <Badge variant={STATUS_VARIANT[o.status]} className="capitalize">{o.status.replace(/_/g, " ")}</Badge>
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
