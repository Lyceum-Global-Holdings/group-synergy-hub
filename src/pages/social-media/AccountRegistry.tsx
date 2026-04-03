import { useState, useCallback } from "react";
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
import { toast } from "sonner";
import { Plus, Search, Facebook, Instagram, Linkedin, Twitter, Youtube, Loader2, Building2 } from "lucide-react";

const PLATFORMS = [
  "facebook", "instagram", "linkedin", "twitter", "youtube",
  "tiktok", "whatsapp", "pinterest", "snapchat", "other"
] as const;

const ACCOUNT_TYPES = ["business", "personal", "creator"] as const;
const STATUSES = ["active", "inactive", "suspended", "archived"] as const;

const platformIcons: Record<string, React.ReactNode> = {
  facebook: <Facebook className="h-4 w-4" />,
  instagram: <Instagram className="h-4 w-4" />,
  linkedin: <Linkedin className="h-4 w-4" />,
  twitter: <Twitter className="h-4 w-4" />,
  youtube: <Youtube className="h-4 w-4" />,
};

interface AccountForm {
  company_id: string;
  platform: string;
  account_name: string;
  account_handle: string;
  account_url: string;
  account_type: string;
  status: string;
  description: string;
  follower_count: number;
}

export default function AccountRegistry() {
  const { selectedCompany, companies } = useCompany();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fetchingFollowers, setFetchingFollowers] = useState(false);

  const emptyForm: AccountForm = {
    company_id: selectedCompany?.id || "",
    platform: "facebook",
    account_name: "",
    account_handle: "",
    account_url: "",
    account_type: "business",
    status: "active",
    description: "",
    follower_count: 0,
  };

  const [form, setForm] = useState<AccountForm>(emptyForm);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["social-media-accounts", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from("social_media_accounts")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  const fetchFollowerCount = useCallback(async (url: string, platform: string) => {
    if (!url || !url.startsWith("http")) return;
    setFetchingFollowers(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-social-stats", {
        body: { url, platform },
      });
      if (error) throw error;
      if (data?.follower_count != null) {
        setForm((prev) => ({ ...prev, follower_count: data.follower_count }));
        toast.success(`Follower count auto-detected: ${data.follower_count.toLocaleString()}`);
      } else {
        toast.info("Could not auto-detect follower count. You can enter it manually.");
      }
    } catch {
      toast.info("Could not fetch follower count. You can enter it manually.");
    } finally {
      setFetchingFollowers(false);
    }
  }, []);

  const saveMutation = useMutation({
    mutationFn: async (formData: AccountForm) => {
      const payload = {
        platform: formData.platform as "facebook" | "instagram" | "linkedin" | "twitter" | "youtube" | "tiktok" | "whatsapp" | "pinterest" | "snapchat" | "other",
        account_name: formData.account_name,
        account_handle: formData.account_handle,
        account_url: formData.account_url,
        account_type: formData.account_type,
        status: formData.status,
        description: formData.description,
        follower_count: formData.follower_count,
        company_id: formData.company_id,
      };
      if (editingId) {
        const { error } = await supabase
          .from("social_media_accounts")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("social_media_accounts")
          .insert({ ...payload, added_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-media-accounts"] });
      toast.success(editingId ? "Account updated" : "Account added");
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openEdit = (row: Record<string, unknown>) => {
    setEditingId(row.id as string);
    setForm({
      company_id: (row.company_id as string) || selectedCompany?.id || "",
      platform: row.platform as string,
      account_name: row.account_name as string,
      account_handle: (row.account_handle as string) || "",
      account_url: (row.account_url as string) || "",
      account_type: row.account_type as string,
      status: row.status as string,
      description: (row.description as string) || "",
      follower_count: (row.follower_count as number) || 0,
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm, company_id: selectedCompany?.id || "" });
    setDialogOpen(true);
  };

  const filtered = accounts.filter((a: Record<string, unknown>) => {
    const matchSearch = !search ||
      (a.account_name as string).toLowerCase().includes(search.toLowerCase()) ||
      ((a.account_handle as string) || "").toLowerCase().includes(search.toLowerCase());
    const matchPlatform = platformFilter === "all" || a.platform === platformFilter;
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchPlatform && matchStatus;
  });

  const columns: DataTableColumn<Record<string, unknown>>[] = [
    {
      key: "platform",
      header: "Platform",
      render: (row) => (
        <div className="flex items-center gap-2 capitalize">
          {platformIcons[row.platform as string] || null}
          {row.platform as string}
        </div>
      ),
    },
    { key: "account_name", header: "Account Name" },
    { key: "account_handle", header: "Handle" },
    {
      key: "account_type",
      header: "Type",
      render: (row) => <span className="capitalize">{row.account_type as string}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status as string} />,
    },
    {
      key: "follower_count",
      header: "Followers",
      render: (row) => ((row.follower_count as number) || 0).toLocaleString(),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Social Media Accounts</h1>
          <p className="text-sm text-muted-foreground">Manage company social media pages and profiles</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Add Account
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search accounts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Platform" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {PLATFORMS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={openEdit} emptyMessage="No social media accounts found." />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Account" : "Add Social Media Account"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Company Selector */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Company *
              </Label>
              <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Account Type</Label>
                <Select value={form.account_type} onValueChange={(v) => setForm({ ...form, account_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Account Name *</Label>
              <Input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} placeholder="e.g. NCG Holdings Official" />
            </div>
            <div className="space-y-2">
              <Label>Account URL</Label>
              <Input
                value={form.account_url}
                onChange={(e) => setForm({ ...form, account_url: e.target.value })}
                onBlur={(e) => {
                  const url = e.target.value.trim();
                  if (url && url.startsWith("http")) {
                    fetchFollowerCount(url, form.platform);
                  }
                }}
                placeholder="https://facebook.com/yourpage — paste to auto-fetch followers"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Handle</Label>
                <Input value={form.account_handle} onChange={(e) => setForm({ ...form, account_handle: e.target.value })} placeholder="@handle" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  Follower Count
                  {fetchingFollowers && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                </Label>
                <Input
                  type="number"
                  value={form.follower_count}
                  onChange={(e) => setForm({ ...form, follower_count: parseInt(e.target.value) || 0 })}
                  disabled={fetchingFollowers}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.account_name || !form.company_id || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : editingId ? "Update" : "Add Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
