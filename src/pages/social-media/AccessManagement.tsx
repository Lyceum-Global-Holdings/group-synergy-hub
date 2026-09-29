import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { getCachedUserId } from "@/lib/currentUser";
import { DataTable, DataTableColumn } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search, ShieldCheck, ShieldAlert, UserPlus } from "lucide-react";
import {
  ACCESS_STATUS_LABEL,
  type AccessStatus,
  currentNda,
  useAccessBlockReason,
  useChangeSocialMediaAccessLevel,
  useDecideSocialMediaAccess,
  useRequestSocialMediaAccess,
  useRevokeSocialMediaAccess,
  useSocialMediaCompanyUsers,
  useSocialMediaRights,
} from "@/hooks/useSocialMediaAccess";

const ACCESS_LEVELS = ["admin", "editor", "viewer", "analyst"] as const;

interface AccessRow {
  id: string;
  account_id: string;
  user_id: string;
  access_level: string;
  status: AccessStatus;
  requested_by: string | null;
  decision_note: string | null;
  social_media_accounts: { account_name: string; platform: string } | null;
  [key: string]: unknown;
}

interface NdaRow {
  access_id: string;
  nda_signed: boolean | null;
  nda_signed_at: string | null;
  nda_expiry_date: string | null;
  created_at: string;
}

const statusClass: Record<AccessStatus, string> = {
  pending: "bg-warning/10 text-warning",
  active: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  revoked: "bg-muted text-muted-foreground",
  nda_expired: "bg-destructive/10 text-destructive",
};

/** Approve / Reject for a waiting request, as the database allows. */
function PendingActions({ row, canApprove, onReject }: { row: AccessRow; canApprove: boolean; onReject: () => void }) {
  const decide = useDecideSocialMediaAccess();
  const { data: blockReason, isSuccess } = useAccessBlockReason(row.id, canApprove);
  if (!canApprove) return null;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        <Button size="sm" onClick={() => decide.mutate({ accessId: row.id, approve: true })}
          disabled={!isSuccess || !!blockReason || decide.isPending}>
          Approve
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={onReject}>Reject</Button>
      </div>
      {blockReason && <span className="max-w-[220px] text-right text-xs text-muted-foreground">{blockReason}</span>}
    </div>
  );
}

export default function AccessManagement() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const me = getCachedUserId();
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ account_id: "", user_id: "", access_level: "viewer", notes: "" });
  const [reasonFor, setReasonFor] = useState<{ kind: "reject" | "revoke" | "withdraw"; row: AccessRow } | null>(null);
  const [reason, setReason] = useState("");

  const { data: rights } = useSocialMediaRights(companyId);
  const canApprove = !!rights?.can_approve;
  const { data: users = [] } = useSocialMediaCompanyUsers(companyId);
  const requestAccess = useRequestSocialMediaAccess();
  const decide = useDecideSocialMediaAccess();
  const changeLevel = useChangeSocialMediaAccessLevel();
  const revoke = useRevokeSocialMediaAccess();

  const { data: accessRecords = [], isLoading } = useQuery({
    queryKey: ["social-media-access", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_media_access")
        .select("*, social_media_accounts(account_name, platform)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AccessRow[];
    },
    enabled: !!companyId,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["social-media-accounts-list", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("social_media_accounts")
        .select("id, account_name, platform")
        .eq("company_id", companyId!)
        .eq("status", "active");
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: ndas = [] } = useQuery({
    queryKey: ["social-media-ndas-lookup", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("social_media_ndas")
        .select("access_id, nda_signed, nda_signed_at, nda_expiry_date, created_at")
        .eq("company_id", companyId!);
      return (data ?? []) as NdaRow[];
    },
    enabled: !!companyId,
  });

  const userName = (userId: string | null) => {
    if (!userId) return "—";
    const u = users.find((x) => x.user_id === userId);
    return u?.full_name || u?.email || "Former user";
  };

  const ndaStatus = (accessId: string) => {
    const nda = currentNda(ndas, accessId);
    if (!nda?.nda_signed) return "missing";
    if (nda.nda_expiry_date && nda.nda_expiry_date < new Date().toISOString().slice(0, 10)) return "expired";
    return "signed";
  };

  const filtered = accessRecords.filter((r) => {
    const matchSearch = !search || userName(r.user_id).toLowerCase().includes(search.toLowerCase());
    const matchLevel = levelFilter === "all" || r.access_level === levelFilter;
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchLevel && matchStatus;
  });

  const closeReason = () => { setReasonFor(null); setReason(""); };
  const submitReason = () => {
    if (!reasonFor) return;
    const done = { onSuccess: closeReason };
    if (reasonFor.kind === "reject") decide.mutate({ accessId: reasonFor.row.id, approve: false, note: reason }, done);
    else revoke.mutate({ accessId: reasonFor.row.id, note: reason }, done);
  };

  const columns: DataTableColumn<AccessRow>[] = [
    {
      key: "user_id",
      header: "User",
      render: (row) => (
        <div>
          <div>{userName(row.user_id)}</div>
          {row.requested_by && row.requested_by !== row.user_id && (
            <div className="text-xs text-muted-foreground">Asked by {userName(row.requested_by)}</div>
          )}
        </div>
      ),
    },
    {
      key: "account_name",
      header: "Account",
      render: (row) => row.social_media_accounts
        ? <span className="capitalize">{row.social_media_accounts.platform} — {row.social_media_accounts.account_name}</span>
        : "—",
    },
    {
      key: "access_level",
      header: "Access Level",
      render: (row) => canApprove && row.status === "active" && row.user_id !== me ? (
        <Select value={row.access_level} onValueChange={(level) => level !== row.access_level && changeLevel.mutate({ accessId: row.id, level })}>
          <SelectTrigger className="w-[120px] h-8 capitalize" aria-label={`Access level for ${userName(row.user_id)}`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {ACCESS_LEVELS.map((l) => <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Badge variant="outline" className="capitalize">{row.access_level}</Badge>
      ),
    },
    {
      key: "nda_status",
      header: "NDA",
      render: (row) => {
        const s = ndaStatus(row.id);
        return s === "signed" ? (
          <Badge className="bg-success/10 text-success border-0"><ShieldCheck className="h-3 w-3 mr-1" /> Signed</Badge>
        ) : s === "expired" ? (
          <Badge className="bg-destructive/10 text-destructive border-0"><ShieldAlert className="h-3 w-3 mr-1" /> Expired</Badge>
        ) : (
          <Badge className="bg-warning/10 text-warning border-0">Not recorded</Badge>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <div>
          <Badge className={`${statusClass[row.status]} border-0`}>{ACCESS_STATUS_LABEL[row.status] ?? row.status}</Badge>
          {row.decision_note && ["rejected", "revoked"].includes(row.status) && (
            <div className="mt-1 max-w-[200px] text-xs text-muted-foreground">{row.decision_note}</div>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => {
        if (row.status === "pending") {
          return (
            <div className="flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
              <PendingActions row={row} canApprove={canApprove} onReject={() => setReasonFor({ kind: "reject", row })} />
              {!canApprove && row.requested_by === me && (
                <Button size="sm" variant="ghost" onClick={() => setReasonFor({ kind: "withdraw", row })}>Withdraw</Button>
              )}
            </div>
          );
        }
        if (canApprove && (row.status === "active" || row.status === "nda_expired")) {
          return (
            <Button variant="ghost" size="sm" className="text-destructive"
              onClick={(e) => { e.stopPropagation(); setReasonFor({ kind: "revoke", row }); }}>
              Revoke
            </Button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Access Management</h1>
          <p className="text-sm text-muted-foreground">
            Access is requested, the NDA is recorded, then a manager or admin approves it.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Request Access
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by user..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]" aria-label="Status filter"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(ACCESS_STATUS_LABEL) as AccessStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{ACCESS_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[160px]" aria-label="Access level filter"><SelectValue placeholder="Access Level" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            {ACCESS_LEVELS.map((l) => <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} emptyMessage="No access records found." />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Account Access</DialogTitle>
            <DialogDescription>After the request, record the signed NDA in NDA Compliance; a manager or admin then approves it.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Social Media Account *</Label>
              <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                <SelectTrigger aria-label="Account"><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="capitalize">{a.platform} — {a.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>User *</Label>
              <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                <SelectTrigger aria-label="User"><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Access Level</Label>
              <Select value={form.access_level} onValueChange={(v) => setForm({ ...form, access_level: v })}>
                <SelectTrigger aria-label="Access level"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCESS_LEVELS.map((l) => <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="access-notes">Why is it needed?</Label>
              <Textarea id="access-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => requestAccess.mutate(
                { accountId: form.account_id, userId: form.user_id, level: form.access_level, notes: form.notes },
                { onSuccess: () => { setDialogOpen(false); setForm({ account_id: "", user_id: "", access_level: "viewer", notes: "" }); } },
              )}
              disabled={!form.account_id || !form.user_id || requestAccess.isPending}
            >
              {requestAccess.isPending ? "Requesting..." : "Request Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reasonFor} onOpenChange={(open) => !open && closeReason()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reasonFor?.kind === "reject" ? "Reject request" : reasonFor?.kind === "withdraw" ? "Withdraw request" : "Revoke access"}
            </DialogTitle>
            <DialogDescription>{reasonFor && `${userName(reasonFor.row.user_id)} · ${reasonFor.row.social_media_accounts?.account_name ?? ""}`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="access-reason">{reasonFor?.kind === "reject" ? "Reason *" : "Note"}</Label>
            <Textarea id="access-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeReason}>Cancel</Button>
            <Button variant="destructive" onClick={submitReason}
              disabled={(reasonFor?.kind === "reject" && !reason.trim()) || decide.isPending || revoke.isPending}>
              {reasonFor?.kind === "reject" ? "Reject" : reasonFor?.kind === "withdraw" ? "Withdraw" : "Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
