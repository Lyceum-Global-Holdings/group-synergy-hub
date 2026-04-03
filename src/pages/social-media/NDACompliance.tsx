import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { DataTable, DataTableColumn } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Search, ShieldCheck, ShieldAlert, Clock, FileText, Upload } from "lucide-react";
import { format, differenceInDays } from "date-fns";

export default function NDACompliance() {
  const { selectedCompany } = useCompanyContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [selectedAccess, setSelectedAccess] = useState<Record<string, unknown> | null>(null);
  const [signForm, setSignForm] = useState({ nda_version: "1.0", nda_expiry_date: "", witnessed_by: "", notes: "" });

  const { data: accessRecords = [], isLoading } = useQuery({
    queryKey: ["social-media-access-nda", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from("social_media_access")
        .select("*, social_media_accounts(account_name, platform)")
        .eq("company_id", selectedCompany.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  const { data: ndas = [] } = useQuery({
    queryKey: ["social-media-ndas-all", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data } = await supabase
        .from("social_media_ndas")
        .select("*")
        .eq("company_id", selectedCompany.id);
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["profiles-nda-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      return data || [];
    },
  });

  const ndaMap = new Map(ndas.map((n: Record<string, unknown>) => [n.access_id as string, n]));
  const userMap = new Map(users.map((u: Record<string, unknown>) => [u.id as string, u]));

  const getUserName = (userId: string) => {
    const u = userMap.get(userId);
    return u ? ((u as Record<string, unknown>).full_name as string) || ((u as Record<string, unknown>).email as string) : userId?.slice(0, 8);
  };

  const getNdaInfo = (accessId: string) => {
    const nda = ndaMap.get(accessId) as Record<string, unknown> | undefined;
    if (!nda) return { status: "pending" as const, nda: null };
    if (!nda.nda_signed) return { status: "pending" as const, nda };
    if (nda.nda_expiry_date && new Date(nda.nda_expiry_date as string) < new Date()) {
      return { status: "expired" as const, nda };
    }
    if (nda.nda_expiry_date && differenceInDays(new Date(nda.nda_expiry_date as string), new Date()) <= 30) {
      return { status: "expiring_soon" as const, nda };
    }
    return { status: "signed" as const, nda };
  };

  // Stats
  const totalAccess = accessRecords.length;
  const signedCount = accessRecords.filter((r: Record<string, unknown>) => getNdaInfo(r.id as string).status === "signed").length;
  const pendingCount = accessRecords.filter((r: Record<string, unknown>) => getNdaInfo(r.id as string).status === "pending").length;
  const expiredCount = accessRecords.filter((r: Record<string, unknown>) => {
    const s = getNdaInfo(r.id as string).status;
    return s === "expired" || s === "expiring_soon";
  }).length;

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAccess) return;
      const { data: { user } } = await supabase.auth.getUser();
      const existingNda = ndaMap.get(selectedAccess.id as string);
      const payload = {
        company_id: selectedCompany!.id,
        access_id: selectedAccess.id as string,
        user_id: selectedAccess.user_id as string,
        nda_signed: true,
        nda_signed_at: new Date().toISOString(),
        nda_expiry_date: signForm.nda_expiry_date || null,
        nda_version: signForm.nda_version,
        witnessed_by: signForm.witnessed_by || null,
        notes: signForm.notes || null,
      };
      if (existingNda) {
        const { error } = await supabase.from("social_media_ndas").update(payload).eq("id", (existingNda as Record<string, unknown>).id as string);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("social_media_ndas").insert(payload);
        if (error) throw error;
      }
      await supabase.from("social_media_activity_log").insert({
        company_id: selectedCompany!.id,
        account_id: selectedAccess.account_id as string,
        action: "nda_signed",
        performed_by: user?.id,
        details: { user_id: selectedAccess.user_id, access_id: selectedAccess.id },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-media-ndas"] });
      toast.success("NDA marked as signed");
      setSignDialogOpen(false);
      setSelectedAccess(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = accessRecords.filter((r: Record<string, unknown>) => {
    if (!search) return true;
    return getUserName(r.user_id as string).toLowerCase().includes(search.toLowerCase());
  });

  const columns: DataTableColumn<Record<string, unknown>>[] = [
    { key: "user_id", header: "User", render: (row) => getUserName(row.user_id as string) },
    {
      key: "account",
      header: "Account",
      render: (row) => {
        const acc = row.social_media_accounts as Record<string, unknown> | null;
        return acc ? <span className="capitalize">{acc.platform as string} — {acc.account_name as string}</span> : "—";
      },
    },
    {
      key: "nda_status",
      header: "NDA Status",
      render: (row) => {
        const { status } = getNdaInfo(row.id as string);
        if (status === "signed") return <Badge className="bg-success/10 text-success border-0"><ShieldCheck className="h-3 w-3 mr-1" /> Signed</Badge>;
        if (status === "expiring_soon") return <Badge className="bg-warning/10 text-warning border-0"><Clock className="h-3 w-3 mr-1" /> Expiring Soon</Badge>;
        if (status === "expired") return <Badge className="bg-destructive/10 text-destructive border-0"><ShieldAlert className="h-3 w-3 mr-1" /> Expired</Badge>;
        return <Badge className="bg-muted text-muted-foreground border-0">Pending</Badge>;
      },
    },
    {
      key: "signed_at",
      header: "Signed Date",
      render: (row) => {
        const { nda } = getNdaInfo(row.id as string);
        return nda && (nda as Record<string, unknown>).nda_signed_at
          ? format(new Date((nda as Record<string, unknown>).nda_signed_at as string), "dd MMM yyyy")
          : "—";
      },
    },
    {
      key: "expiry",
      header: "Expiry Date",
      render: (row) => {
        const { nda } = getNdaInfo(row.id as string);
        return nda && (nda as Record<string, unknown>).nda_expiry_date
          ? format(new Date((nda as Record<string, unknown>).nda_expiry_date as string), "dd MMM yyyy")
          : "—";
      },
    },
    {
      key: "actions",
      header: "",
      render: (row) => {
        const { status } = getNdaInfo(row.id as string);
        return status !== "signed" ? (
          <Button size="sm" variant="outline" onClick={(e) => {
            e.stopPropagation();
            setSelectedAccess(row);
            setSignDialogOpen(true);
          }}>
            <FileText className="h-3 w-3 mr-1" /> {status === "pending" ? "Mark Signed" : "Renew"}
          </Button>
        ) : null;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">NDA Compliance</h1>
        <p className="text-sm text-muted-foreground">Track NDA signing status for social media account access</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center">
          <div className="text-2xl font-bold text-foreground">{totalAccess}</div>
          <p className="text-sm text-muted-foreground">Total Access Grants</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <div className="text-2xl font-bold text-success">{signedCount}</div>
          <p className="text-sm text-muted-foreground">NDAs Signed</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <div className="text-2xl font-bold text-warning">{pendingCount}</div>
          <p className="text-sm text-muted-foreground">Pending</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <div className="text-2xl font-bold text-destructive">{expiredCount}</div>
          <p className="text-sm text-muted-foreground">Expired / Expiring</p>
        </CardContent></Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by user..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} emptyMessage="No access records found." />

      <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark NDA as Signed</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>NDA Version</Label>
              <Input value={signForm.nda_version} onChange={(e) => setSignForm({ ...signForm, nda_version: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Expiry Date</Label>
              <Input type="date" value={signForm.nda_expiry_date} onChange={(e) => setSignForm({ ...signForm, nda_expiry_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Witnessed By</Label>
              <Input value={signForm.witnessed_by} onChange={(e) => setSignForm({ ...signForm, witnessed_by: e.target.value })} placeholder="Name of witness" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={signForm.notes} onChange={(e) => setSignForm({ ...signForm, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => signMutation.mutate()} disabled={signMutation.isPending}>
              {signMutation.isPending ? "Saving..." : "Confirm Signed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
