import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupplierContext } from "@/contexts/SupplierContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Send, FileText, Search, Receipt } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";

interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  status: string;
  match_status: string | null;
  direction: string;
  document_type: string | null;
  compliance_profile: string | null;
  corrected_einvoice_id: string | null;
  grand_total: number | null;
  currency: string | null;
  issue_date: string | null;
  peppol_message_id: string | null;
  ubl_xml_path: string | null;
}

const PROFILE_LABEL: Record<string, string> = {
  peppol_bis_3: "PEPPOL",
  ksa_zatca_phase2: "ZATCA",
  it_sdi: "SDI",
  fr_facturx: "Factur-X",
};

export default function PortalInvoices() {
  const { activeSupplierId, activeMembership } = useSupplierContext();
  const { toast } = useToast();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [matchOpen, setMatchOpen] = useState<InvoiceRow | null>(null);
  const [matchData, setMatchData] = useState<any | null>(null);
  const canSend = activeMembership && ["owner", "admin"].includes(activeMembership.portal_role);

  const refresh = async () => {
    if (!activeSupplierId) return;
    setLoading(true);
    const { data } = await supabase
      .from("einvoices")
      .select("id, invoice_number, status, match_status, direction, document_type, compliance_profile, corrected_einvoice_id, grand_total, currency, issue_date, peppol_message_id, ubl_xml_path")
      .eq("supplier_id", activeSupplierId)
      .order("issue_date", { ascending: false })
      .limit(100);
    setRows((data ?? []) as InvoiceRow[]);
    setLoading(false);
  };
  useEffect(() => { void refresh(); }, [activeSupplierId]);

  const sendInvoice = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.functions.invoke("peppol-send", { body: { einvoice_id: id } });
    setBusyId(null);
    if (error || (data as any)?.error) {
      toast({ title: "Send failed", description: String((data as any)?.error || error?.message), variant: "destructive" });
      return;
    }
    toast({ title: "Submitted to PEPPOL", description: `Status: ${(data as any).status}` });
    await refresh();
  };

  const downloadUbl = async (row: InvoiceRow) => {
    if (!row.ubl_xml_path) return;
    const { data, error } = await supabase.storage.from("einvoices").createSignedUrl(row.ubl_xml_path, 60);
    if (error || !data) {
      toast({ title: "Download failed", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const openMatch = async (row: InvoiceRow) => {
    setMatchOpen(row);
    setMatchData(null);
    const { data } = await supabase
      .from("einvoice_match_results")
      .select("*")
      .eq("einvoice_id", row.id)
      .order("evaluated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setMatchData(data);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">PEPPOL E-Invoices</h1>
      <Card>
        <CardHeader><CardTitle>Recent invoices</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>PEPPOL Msg</TableHead>
                  <TableHead className="w-[160px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const sendable = canSend && r.direction === "outbound" && ["validated","ready_to_send","submission_failed"].includes(r.status);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{r.invoice_number ?? r.id.slice(0, 8)}</TableCell>
                      <TableCell className="capitalize">{r.direction}</TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{r.status}</Badge></TableCell>
                      <TableCell>{r.match_status ? <Badge variant="outline" className="capitalize">{r.match_status}</Badge> : "—"}</TableCell>
                      <TableCell className="text-right">
                        {r.grand_total != null ? `${r.currency ?? ""} ${Number(r.grand_total).toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell>{r.issue_date ? new Date(r.issue_date).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.peppol_message_id ?? "—"}</TableCell>
                      <TableCell className="space-x-1">
                        {sendable && (
                          <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => sendInvoice(r.id)}>
                            {busyId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          </Button>
                        )}
                        {r.ubl_xml_path && (
                          <Button size="sm" variant="ghost" onClick={() => downloadUbl(r)}><FileText className="h-3 w-3" /></Button>
                        )}
                        {r.direction === "inbound" && (
                          <Button size="sm" variant="ghost" onClick={() => openMatch(r)}><Search className="h-3 w-3" /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No invoices yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!matchOpen} onOpenChange={(v) => !v && setMatchOpen(null)}>
        <SheetContent className="w-[520px] sm:max-w-[520px]">
          <SheetHeader><SheetTitle>3-Way Match — {matchOpen?.invoice_number}</SheetTitle></SheetHeader>
          {!matchData ? (
            <p className="text-sm text-muted-foreground mt-4">No match results yet.</p>
          ) : (
            <div className="space-y-4 mt-4 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <Badge variant={matchData.qty_match ? "default" : "destructive"}>Qty {matchData.qty_match ? "OK" : "Δ"}</Badge>
                <Badge variant={matchData.price_match ? "default" : "destructive"}>Price {matchData.price_match ? "OK" : "Δ"}</Badge>
                <Badge variant={matchData.total_match ? "default" : "destructive"}>Total {matchData.total_match ? "OK" : "Δ"}</Badge>
              </div>
              <div>Score: <strong>{matchData.score}/100</strong></div>
              <div>
                <div className="font-medium mb-1">Discrepancies</div>
                <pre className="text-xs bg-muted p-2 rounded max-h-80 overflow-auto">
                  {JSON.stringify(matchData.discrepancies, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
