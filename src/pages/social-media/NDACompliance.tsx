import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { DataTable, DataTableColumn } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, ShieldCheck, ShieldAlert, Clock, FileText, Paperclip } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import {
  ACCESS_STATUS_LABEL,
  type AccessStatus,
  currentNda,
  ndaFileProblem,
  openNdaDocument,
  useRecordSocialMediaNda,
  useSocialMediaCompanyUsers,
} from "@/hooks/useSocialMediaAccess";

interface AccessRow {
  id: string;
  user_id: string;
  status: AccessStatus;
  social_media_accounts: { account_name: string; platform: string } | null;
  [key: string]: unknown;
}

interface NdaRow {
  id: string;
  access_id: string;
  nda_signed: boolean | null;
  nda_signed_at: string | null;
  nda_expiry_date: string | null;
  nda_document_url: string | null;
  nda_version: string | null;
  witness_name: string | null;
  created_at: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_FORM = { signed_on: today(), expiry: "", version: "1.0", witness: "", notes: "" };

export default function NDACompliance() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [search, setSearch] = useState("");
  const [selectedAccess, setSelectedAccess] = useState<AccessRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const recordNda = useRecordSocialMediaNda();
  const { data: users = [] } = useSocialMediaCompanyUsers(companyId);

  // Everyone who has, or is waiting for, access needs a current NDA.
  const { data: accessRecords = [], isLoading } = useQuery({
    queryKey: ["social-media-access-nda", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_media_access")
        .select("*, social_media_accounts(account_name, platform)")
        .eq("company_id", companyId!)
        .in("status" as never, ["pending", "active", "nda_expired"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AccessRow[];
    },
    enabled: !!companyId,
  });

  const { data: ndas = [] } = useQuery({
    queryKey: ["social-media-ndas-all", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("social_media_ndas").select("*").eq("company_id", companyId!);
      return (data ?? []) as unknown as NdaRow[];
    },
    enabled: !!companyId,
  });

  const userName = (userId: string) => {
    const u = users.find((x) => x.user_id === userId);
    return u?.full_name || u?.email || "Former user";
  };

  const ndaInfo = (accessId: string) => {
    const nda = currentNda(ndas, accessId);
    if (!nda?.nda_signed) return { status: "pending" as const, nda };
    if (nda.nda_expiry_date && nda.nda_expiry_date < today()) return { status: "expired" as const, nda };
    if (nda.nda_expiry_date && differenceInDays(new Date(nda.nda_expiry_date), new Date()) <= 30) {
      return { status: "expiring_soon" as const, nda };
    }
    return { status: "signed" as const, nda };
  };

  const count = (pred: (s: string) => boolean) => accessRecords.filter((r) => pred(ndaInfo(r.id).status)).length;
  const fileProblem = ndaFileProblem(file);
  const dateProblem =
    !form.signed_on || form.signed_on > today() ? "Enter the signing date (not in the future)"
    : form.expiry && form.expiry <= form.signed_on ? "The expiry date must be after the signing date"
    : form.expiry && form.expiry < today() ? "This NDA has already expired"
    : null;

  const openDialog = (row: AccessRow) => {
    setSelectedAccess(row);
    setForm({ ...EMPTY_FORM, signed_on: today() });
    setFile(null);
  };

  const submit = () => {
    if (!selectedAccess || !companyId || !file || fileProblem || dateProblem) return;
    recordNda.mutate(
      {
        companyId,
        accessId: selectedAccess.id,
        file,
        signedOn: form.signed_on,
        expiryDate: form.expiry || undefined,
        version: form.version,
        witnessName: form.witness,
        notes: form.notes,
      },
      { onSuccess: () => setSelectedAccess(null) },
    );
  };

  const filtered = accessRecords.filter((r) => !search || userName(r.user_id).toLowerCase().includes(search.toLowerCase()));

  const columns: DataTableColumn<AccessRow>[] = [
    { key: "user_id", header: "User", render: (row) => userName(row.user_id) },
    {
      key: "account",
      header: "Account",
      render: (row) => row.social_media_accounts
        ? <span className="capitalize">{row.social_media_accounts.platform} — {row.social_media_accounts.account_name}</span>
        : "—",
    },
    { key: "access", header: "Access", render: (row) => ACCESS_STATUS_LABEL[row.status] ?? row.status },
    {
      key: "nda_status",
      header: "NDA Status",
      render: (row) => {
        const { status } = ndaInfo(row.id);
        if (status === "signed") return <Badge className="bg-success/10 text-success border-0"><ShieldCheck className="h-3 w-3 mr-1" /> Signed</Badge>;
        if (status === "expiring_soon") return <Badge className="bg-warning/10 text-warning border-0"><Clock className="h-3 w-3 mr-1" /> Expiring Soon</Badge>;
        if (status === "expired") return <Badge className="bg-destructive/10 text-destructive border-0"><ShieldAlert className="h-3 w-3 mr-1" /> Expired</Badge>;
        return <Badge className="bg-muted text-muted-foreground border-0">Not recorded</Badge>;
      },
    },
    {
      key: "signed_at",
      header: "Signed",
      render: (row) => {
        const { nda } = ndaInfo(row.id);
        return nda?.nda_signed_at ? format(new Date(nda.nda_signed_at), "dd MMM yyyy") : "—";
      },
    },
    {
      key: "expiry",
      header: "Expires",
      render: (row) => {
        const { nda } = ndaInfo(row.id);
        return nda?.nda_expiry_date ? format(new Date(nda.nda_expiry_date), "dd MMM yyyy") : "—";
      },
    },
    {
      key: "document",
      header: "Document",
      render: (row) => {
        const { nda } = ndaInfo(row.id);
        return nda?.nda_document_url ? (
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); void openNdaDocument(nda.nda_document_url!); }}>
            <Paperclip className="h-3 w-3 mr-1" /> View
          </Button>
        ) : "—";
      },
    },
    {
      key: "actions",
      header: "",
      render: (row) => {
        const { status } = ndaInfo(row.id);
        return status !== "signed" ? (
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openDialog(row); }}>
            <FileText className="h-3 w-3 mr-1" /> {status === "pending" ? "Record NDA" : "Renew"}
          </Button>
        ) : null;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">NDA Compliance</h1>
        <p className="text-sm text-muted-foreground">
          Access is approved only with a signed NDA on file. When an NDA expires, access is suspended until it is renewed.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center">
          <div className="text-2xl font-bold text-foreground">{accessRecords.length}</div>
          <p className="text-sm text-muted-foreground">Access requests and grants</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <div className="text-2xl font-bold text-success">{count((s) => s === "signed")}</div>
          <p className="text-sm text-muted-foreground">NDAs Signed</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <div className="text-2xl font-bold text-warning">{count((s) => s === "pending")}</div>
          <p className="text-sm text-muted-foreground">Not recorded</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <div className="text-2xl font-bold text-destructive">{count((s) => s === "expired" || s === "expiring_soon")}</div>
          <p className="text-sm text-muted-foreground">Expired / Expiring</p>
        </CardContent></Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by user..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} emptyMessage="No access requests or grants." />

      <Dialog open={!!selectedAccess} onOpenChange={(open) => !open && setSelectedAccess(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record signed NDA</DialogTitle>
            <DialogDescription>
              {selectedAccess && `${userName(selectedAccess.user_id)} · ${selectedAccess.social_media_accounts?.account_name ?? ""}`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nda-file">Signed NDA (PDF, JPG or PNG, up to 10 MB) *</Label>
              <Input id="nda-file" type="file" accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {file && fileProblem && <p className="text-xs text-destructive">{fileProblem}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="nda-signed">Signed on *</Label>
                <Input id="nda-signed" type="date" value={form.signed_on} max={today()} onChange={(e) => setForm({ ...form, signed_on: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nda-expiry">Expires on</Label>
                <Input id="nda-expiry" type="date" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} />
              </div>
            </div>
            {dateProblem && <p className="text-xs text-destructive">{dateProblem}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="nda-version">NDA version</Label>
                <Input id="nda-version" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nda-witness">Witnessed by</Label>
                <Input id="nda-witness" value={form.witness} onChange={(e) => setForm({ ...form, witness: e.target.value })} placeholder="Name of witness" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nda-notes">Notes</Label>
              <Textarea id="nda-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAccess(null)}>Cancel</Button>
            <Button onClick={submit} disabled={!!fileProblem || !!dateProblem || recordNda.isPending}>
              {recordNda.isPending ? "Saving..." : "Record NDA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
