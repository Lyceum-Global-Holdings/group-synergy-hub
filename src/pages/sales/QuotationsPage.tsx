import { useMemo, useState } from "react";
import { FileText, Plus, Search, Send, Check, X, Receipt, Pencil, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useCompany } from "@/contexts/CompanyContext";
import { useQuotations } from "@/hooks/useQuotations";
import { QuotationDialog } from "@/components/sales/QuotationDialog";
import { downloadQuotationPdf } from "@/utils/salesPdfExport";
import { QUOTATION_STATUS_META, type Quotation, type QuotationStatus } from "@/types/sales";

export default function QuotationsPage() {
  const { selectedCompany, formatCurrency } = useCompany();
  const companyId = selectedCompany?.id;
  const { quotations, isLoading, setStatus, convertToInvoice, deleteDraft } = useQuotations(companyId);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return quotations.filter((x) => {
      const matches =
        x.quote_number.toLowerCase().includes(q) ||
        (x.customer?.customer_name ?? "").toLowerCase().includes(q);
      const st = statusFilter === "all" || x.status === statusFilter;
      return matches && st;
    });
  }, [quotations, search, statusFilter]);

  const openValue = quotations
    .filter((q) => q.status === "sent")
    .reduce((s, q) => s + Number(q.total_amount), 0);
  const acceptedValue = quotations
    .filter((q) => q.status === "accepted" || q.status === "invoiced")
    .reduce((s, q) => s + Number(q.total_amount), 0);

  const pdf = (q: Quotation) =>
    downloadQuotationPdf(q, q.items ?? [], {
      companyName: selectedCompany?.name,
      formatCurrency,
    });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileText className="h-6 w-6" /> Quotations
          </h1>
          <p className="text-sm text-muted-foreground">
            Quote services to customers — accepted quotes convert to invoices in one click.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} disabled={!companyId}>
          <Plus className="h-4 w-4 mr-2" /> New Quotation
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total quotes", value: String(quotations.length) },
          { label: "Awaiting reply", value: String(quotations.filter((q) => q.status === "sent").length) },
          { label: "Open value (sent)", value: formatCurrency(openValue) },
          { label: "Won value", value: formatCurrency(acceptedValue) },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border p-3">
            <p className="text-xl font-semibold">{k.value}</p>
            <p className="text-xs text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search by number or customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(QUOTATION_STATUS_META) as QuotationStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{QUOTATION_STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quote #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Valid until</TableHead>
              <TableHead className="text-right">Total</TableHead>
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
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No quotations yet.</TableCell></TableRow>
            ) : filtered.map((q) => {
              const meta = QUOTATION_STATUS_META[q.status];
              return (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-xs">{q.quote_number}</TableCell>
                  <TableCell>{q.customer?.customer_name ?? "—"}</TableCell>
                  <TableCell>{q.quote_date}</TableCell>
                  <TableCell>{q.valid_until ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(Number(q.total_amount))}</TableCell>
                  <TableCell><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Download PDF" onClick={() => pdf(q)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    {q.status === "draft" && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit draft"
                                onClick={() => { setEditing(q); setDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Mark as sent"
                                onClick={() => setStatus.mutate({ id: q.id, status: "sent" })}>
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete draft"
                                onClick={() => deleteDraft.mutate(q.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {q.status === "sent" && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" title="Mark accepted"
                                onClick={() => setStatus.mutate({ id: q.id, status: "accepted" })}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Mark rejected"
                                onClick={() => setStatus.mutate({ id: q.id, status: "rejected" })}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {(q.status === "accepted" || q.status === "sent") && (
                      <Button variant="outline" size="sm" className="ml-1"
                              disabled={convertToInvoice.isPending}
                              onClick={() => convertToInvoice.mutate(q.id)}>
                        <Receipt className="h-4 w-4 mr-1" /> Invoice
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <QuotationDialog open={dialogOpen} onOpenChange={setDialogOpen} quotation={editing} companyId={companyId} />
    </div>
  );
}
