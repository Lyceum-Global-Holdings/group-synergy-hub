import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/contexts/CompanyContext";
import { DataTable, DataTableColumn } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { format } from "date-fns";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  account_added: { label: "Account Added", color: "bg-info/10 text-info" },
  access_granted: { label: "Access Granted", color: "bg-success/10 text-success" },
  access_revoked: { label: "Access Revoked", color: "bg-destructive/10 text-destructive" },
  nda_signed: { label: "NDA Signed", color: "bg-success/10 text-success" },
  nda_expired: { label: "NDA Expired", color: "bg-warning/10 text-warning" },
  account_deactivated: { label: "Account Deactivated", color: "bg-muted text-muted-foreground" },
};

export default function ActivityLog() {
  const { selectedCompany } = useCompanyContext();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["social-media-activity-log", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from("social_media_activity_log")
        .select("*, social_media_accounts(account_name, platform)")
        .eq("company_id", selectedCompany.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["profiles-activity-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      return data || [];
    },
  });

  const userMap = new Map(users.map((u: Record<string, unknown>) => [u.id as string, u]));
  const getUserName = (userId: string | null) => {
    if (!userId) return "System";
    const u = userMap.get(userId);
    return u ? ((u as Record<string, unknown>).full_name as string) || ((u as Record<string, unknown>).email as string) : userId.slice(0, 8);
  };

  const filtered = logs.filter((l: Record<string, unknown>) => {
    const matchSearch = !search || getUserName(l.performed_by as string | null).toLowerCase().includes(search.toLowerCase());
    const matchAction = actionFilter === "all" || l.action === actionFilter;
    return matchSearch && matchAction;
  });

  const columns: DataTableColumn<Record<string, unknown>>[] = [
    {
      key: "created_at",
      header: "Timestamp",
      render: (row) => format(new Date(row.created_at as string), "dd MMM yyyy HH:mm"),
    },
    {
      key: "performed_by",
      header: "User",
      render: (row) => getUserName(row.performed_by as string | null),
    },
    {
      key: "action",
      header: "Action",
      render: (row) => {
        const cfg = ACTION_LABELS[row.action as string] || { label: row.action as string, color: "bg-muted text-muted-foreground" };
        return <Badge className={`${cfg.color} border-0`}>{cfg.label}</Badge>;
      },
    },
    {
      key: "account",
      header: "Account",
      render: (row) => {
        const acc = row.social_media_accounts as Record<string, unknown> | null;
        return acc ? <span className="capitalize">{acc.platform as string} — {acc.account_name as string}</span> : "—";
      },
    },
    {
      key: "details",
      header: "Details",
      render: (row) => {
        const details = row.details as Record<string, unknown> | null;
        if (!details || Object.keys(details).length === 0) return "—";
        return <span className="text-xs text-muted-foreground">{JSON.stringify(details)}</span>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Activity Log</h1>
        <p className="text-sm text-muted-foreground">Audit trail for social media account and access changes</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by user..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {Object.entries(ACTION_LABELS).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} emptyMessage="No activity logged yet." />
    </div>
  );
}
