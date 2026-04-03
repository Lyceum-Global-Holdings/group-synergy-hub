import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { DataTable, DataTableColumn } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, ShieldCheck, ShieldAlert, UserPlus } from "lucide-react";

const ACCESS_LEVELS = ["admin", "editor", "viewer", "analyst"] as const;

export default function AccessManagement() {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ account_id: "", user_id: "", access_level: "viewer", notes: "" });

  const { data: accessRecords = [], isLoading } = useQuery({
    queryKey: ["social-media-access", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from("social_media_access")
        .select("*, social_media_accounts(account_name, platform)")
        .eq("company_id", selectedCompany.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["social-media-accounts-list", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data } = await supabase
        .from("social_media_accounts")
        .select("id, account_name, platform")
        .eq("company_id", selectedCompany.id)
        .eq("status", "active");
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["company-users-for-access", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  const { data: ndas = [] } = useQuery({
    queryKey: ["social-media-ndas-lookup", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data } = await supabase
        .from("social_media_ndas")
        .select("access_id, nda_signed, nda_expiry_date")
        .eq("company_id", selectedCompany.id);
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  const ndaMap = new Map(ndas.map((n: Record<string, unknown>) => [n.access_id as string, n]));

  const grantMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("social_media_access").insert({
        company_id: selectedCompany!.id,
        account_id: form.account_id,
        user_id: form.user_id,
        access_level: form.access_level,
        access_granted_by: user?.id,
        notes: form.notes || null,
      });
      if (error) throw error;
      // Log activity
      await supabase.from("social_media_activity_log").insert({
        company_id: selectedCompany!.id,
        account_id: form.account_id,
        action: "access_granted",
        performed_by: user?.id,
        details: { user_id: form.user_id, access_level: form.access_level },
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-media-access"] });
      toast.success("Access granted");
      setDialogOpen(false);
      setForm({ account_id: "", user_id: "", access_level: "viewer", notes: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: async (accessId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("social_media_access").update({
        is_active: false,
        access_revoked_at: new Date().toISOString(),
      }).eq("id", accessId);
      if (error) throw error;
      const record = accessRecords.find((r: Record<string, unknown>) => r.id === accessId);
      await supabase.from("social_media_activity_log").insert({
        company_id: selectedCompany!.id,
        account_id: (record as Record<string, unknown>)?.account_id as string,
        action: "access_revoked",
        performed_by: user?.id,
        details: { access_id: accessId },
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-media-access"] });
      toast.success("Access revoked");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const getUserName = (userId: string) => {
    const u = users.find((u: Record<string, unknown>) => u.id === userId);
    return u ? ((u as Record<string, unknown>).full_name as string) || ((u as Record<string, unknown>).email as string) : userId?.slice(0, 8);
  };

  const getNdaStatus = (accessId: string) => {
    const nda = ndaMap.get(accessId) as Record<string, unknown> | undefined;
    if (!nda) return "pending";
    if (nda.nda_signed && nda.nda_expiry_date) {
      return new Date(nda.nda_expiry_date as string) < new Date() ? "expired" : "signed";
    }
    return nda.nda_signed ? "signed" : "pending";
  };

  const filtered = accessRecords.filter((r: Record<string, unknown>) => {
    const matchSearch = !search || getUserName(r.user_id as string).toLowerCase().includes(search.toLowerCase());
    const matchLevel = levelFilter === "all" || r.access_level === levelFilter;
    return matchSearch && matchLevel;
  });

  const columns: DataTableColumn<Record<string, unknown>>[] = [
    {
      key: "user_id",
      header: "User",
      render: (row) => getUserName(row.user_id as string),
    },
    {
      key: "account_name",
      header: "Account",
      render: (row) => {
        const acc = row.social_media_accounts as Record<string, unknown> | null;
        return acc ? (
          <span className="capitalize">{acc.platform as string} — {acc.account_name as string}</span>
        ) : "—";
      },
    },
    {
      key: "access_level",
      header: "Access Level",
      render: (row) => <Badge variant="outline" className="capitalize">{row.access_level as string}</Badge>,
    },
    {
      key: "nda_status",
      header: "NDA Status",
      render: (row) => {
        const status = getNdaStatus(row.id as string);
        return status === "signed" ? (
          <Badge className="bg-success/10 text-success border-0"><ShieldCheck className="h-3 w-3 mr-1" /> Signed</Badge>
        ) : status === "expired" ? (
          <Badge className="bg-destructive/10 text-destructive border-0"><ShieldAlert className="h-3 w-3 mr-1" /> Expired</Badge>
        ) : (
          <Badge className="bg-warning/10 text-warning border-0">Pending</Badge>
        );
      },
    },
    {
      key: "is_active",
      header: "Status",
      render: (row) => <StatusBadge status={row.is_active ? "active" : "inactive"} />,
    },
    {
      key: "actions",
      header: "",
      render: (row) => row.is_active ? (
        <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); revokeMutation.mutate(row.id as string); }}>
          Revoke
        </Button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Access Management</h1>
          <p className="text-sm text-muted-foreground">Control who has access to company social media accounts</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Grant Access
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by user..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Access Level" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            {ACCESS_LEVELS.map((l) => <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} emptyMessage="No access records found." />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Grant Account Access</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Social Media Account *</Label>
              <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a: Record<string, unknown>) => (
                    <SelectItem key={a.id as string} value={a.id as string} className="capitalize">
                      {a.platform as string} — {a.account_name as string}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>User *</Label>
              <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  {users.map((u: Record<string, unknown>) => (
                    <SelectItem key={u.id as string} value={u.id as string}>
                      {(u.full_name as string) || (u.email as string)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Access Level</Label>
              <Select value={form.access_level} onValueChange={(v) => setForm({ ...form, access_level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCESS_LEVELS.map((l) => <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => grantMutation.mutate()} disabled={!form.account_id || !form.user_id || grantMutation.isPending}>
              {grantMutation.isPending ? "Granting..." : "Grant Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
