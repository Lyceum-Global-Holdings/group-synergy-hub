import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Receipt, Search, Download, Eye, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useCompany } from "@/contexts/CompanyContext";
import { useInvoiceItems } from "@/hooks/useQuotations";
import { downloadSalesInvoicePdf } from "@/utils/salesPdfExport";

interface SalesInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  gross_amount: number;
  tax_amount: number | null;
  net_amount: number;
  amount_received: number | null;
  status: string;
  notes: string | null;
  quotation_id: string | null;
  customer?: { customer_name: string } | null;
  quotation?: { quote_number: string } | null;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary", pending: "outline", posted: "outline",
  partially_paid: "outline", paid: "default", cancelled: "destructive", written_off: "destructive",
};

function InvoiceDetailsDialog({ invoice, onClose, companyName, formatCurrency }: {
  invoice: SalesInvoice | null; onClose: () => void;
  companyName?: string | null; formatCurrency: (v: number) => string;
}) {
  const { items } = useInvoiceItems(invoice?.id);
  if (!invoice) return null;
  const received = Number(invoice.amount_received ?? 0);
  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {invoice.invoice_number}
            <Badge variant={STATUS_VARIANT[invoice.status] ?? "outline"} className="capitalize">
              {invoice.status.replace("_", " ")}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          {invoice.customer?.customer_name ?? "—"} · {invoice.invoice_date}
          {invoice.due_date ? ` · due ${invoice.due_date}` : ""}
          {invoice.quotation?.quote_number ? ` · from ${invoice.quotation.quote_number}` : ""}
        </p>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-md border p-3">
            No line items — this is a header-only invoice (created before line
            support, or directly in Accounts Receivable).
          </p>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      <p className="font-medium">{it.item_name}</p>
                      {it.description && <p className="text-xs text-muted-foreground">{it.description}</p>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{it.unit}</TableCell>
                    <TableCell className="text-right">{Number(it.quantity)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(it.unit_price))}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(it.line_total))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="rounded-md border p-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(Number(invoice.gross_amount))}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatCurrency(Number(invoice.tax_amount ?? 0))}</span></div>
          <div className="flex justify-between font-medium"><span>Total</span><span>{formatCurrency(Number(invoice.net_amount))}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Received</span><span>{formatCurrency(received)}</span></div>
          <div className="flex justify-between font-semibold border-t pt-1">
            <span>Balance due</span><span>{formatCurrency(Number(invoice.net_amount) - received)}</span>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() =>
            downloadSalesInvoicePdf(invoice, items, { companyName, formatCurrency })}>
            <Download className="h-4 w-4 mr-2" /> Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SalesInvoicesPage() {
  const navigate = useNavigate();
  const { selectedCompany, formatCurrency } = useCompany();
  const companyId = selectedCompany?.id;

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["customer-invoices", companyId, "sales-page"],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("customer_invoices")
        .select("*, customer:customers(customer_name), quotation:sales_quotations(quote_number)")
        .eq("company_id", companyId)
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SalesInvoice[];
    },
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewing, setViewing] = useState<SalesInvoice | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter((i) => {
      const m = i.invoice_number.toLowerCase().includes(q) ||
        (i.customer?.customer_name ?? "").toLowerCase().includes(q);
      const st = statusFilter === "all" || i.status === statusFilter;
      return m && st;
    });
  }, [invoices, search, statusFilter]);

  const outstanding = invoices
    .filter((i) => !["paid", "cancelled", "written_off"].includes(i.status))
    .reduce((s, i) => s + (Number(i.net_amount) - Number(i.amount_received ?? 0)), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Receipt className="h-6 w-6" /> Invoices
          </h1>
          <p className="text-sm text-muted-foreground">
            One ledger with Accounts Receivable — payments and receipts are recorded there.
          </p>
        </div>
        <Button onClick={() => navigate("/sales/quotations")}>
          <FileText className="h-4 w-4 mr-2" /> New via Quotation
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Invoices", value: String(invoices.length) },
          { label: "Outstanding", value: formatCurrency(outstanding) },
          { label: "Paid", value: String(invoices.filter((i) => i.status === "paid").length) },
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
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.keys(STATUS_VARIANT).map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Quote</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!companyId ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Select a company.</TableCell></TableRow>
            ) : isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                No invoices yet — create a quotation and convert it.
              </TableCell></TableRow>
            ) : filtered.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-mono text-xs">{i.invoice_number}</TableCell>
                <TableCell>{i.customer?.customer_name ?? "—"}</TableCell>
                <TableCell>{i.invoice_date}</TableCell>
                <TableCell>{i.due_date ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{i.quotation?.quote_number ?? "—"}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(Number(i.net_amount))}</TableCell>
                <TableCell className="text-right">{formatCurrency(Number(i.net_amount) - Number(i.amount_received ?? 0))}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[i.status] ?? "outline"} className="capitalize">{i.status.replace("_", " ")}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="View" onClick={() => setViewing(i)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <InvoiceDetailsDialog
        invoice={viewing}
        onClose={() => setViewing(null)}
        companyName={selectedCompany?.name}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}
