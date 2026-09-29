import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, ExternalLink, RefreshCw, Search, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GenerateReportButton } from "@/components/management/reports/GenerateReportButton";
import {
  APPROVAL_TYPE_LABEL,
  type ApprovalItemType,
  type ApprovalQueueItem,
  useApprovalQueue,
  useDecideApprovalItem,
} from "@/hooks/useApprovalConsole";

const money = (n: number | null, cur: string | null) =>
  n == null ? null : `${cur || "LKR"} ${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

function QueueList({ items, isLoading, canDecide, onDecide }: {
  items: ApprovalQueueItem[];
  isLoading: boolean;
  canDecide: boolean;
  onDecide: (item: ApprovalQueueItem, approve: boolean) => void;
}) {
  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  if (items.length === 0) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">{canDecide ? "Nothing is waiting for you." : "Nothing you sent is waiting."}</CardContent></Card>;
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={`${item.item_type}-${item.item_id}`}>
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{APPROVAL_TYPE_LABEL[item.item_type] ?? item.item_type}</Badge>
                <span className="font-mono text-sm">{item.reference}</span>
                <Badge variant="secondary">{item.stage}</Badge>
              </div>
              <p className="mt-1 truncate font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                {money(item.amount, item.currency) && <>{money(item.amount, item.currency)} · </>}
                {item.submitted_at ? `waiting ${formatDistanceToNow(new Date(item.submitted_at))}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link to={item.view_url}><ExternalLink className="mr-1 h-4 w-4" /> Open</Link>
              </Button>
              {canDecide && (
                <>
                  <Button size="sm" onClick={() => onDecide(item, true)}>
                    <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => onDecide(item, false)}>
                    <XCircle className="mr-1 h-4 w-4" /> Reject
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Everything waiting for the signed-in user's decision, from every module, as
 * the database decides it. Approve and Reject go through each module's own
 * rules, so they can't do more than the module's screen allows.
 */
export default function ApprovalConsole() {
  const [tab, setTab] = useState<"to_decide" | "submitted">("to_decide");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ApprovalItemType | "all">("all");
  const [deciding, setDeciding] = useState<{ item: ApprovalQueueItem; approve: boolean } | null>(null);
  const [comments, setComments] = useState("");

  const toDecide = useApprovalQueue("to_decide");
  const submitted = useApprovalQueue("submitted");
  const decide = useDecideApprovalItem();

  const filter = (items: ApprovalQueueItem[] = []) =>
    items.filter((i) =>
      (typeFilter === "all" || i.item_type === typeFilter)
      && (!search || `${i.reference} ${i.title}`.toLowerCase().includes(search.toLowerCase())));
  const typesPresent = useMemo(
    () => [...new Set([...(toDecide.data ?? []), ...(submitted.data ?? [])].map((i) => i.item_type))],
    [toDecide.data, submitted.data],
  );

  const close = () => { setDeciding(null); setComments(""); };
  const confirm = () => {
    if (!deciding) return;
    decide.mutate(
      { type: deciding.item.item_type, id: deciding.item.item_id, approve: deciding.approve, comments },
      { onSuccess: close },
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Approval Console</h1>
          <p className="mt-1 text-muted-foreground">Everything waiting for your decision, from every module.</p>
        </div>
        <div className="flex items-center gap-2">
          <GenerateReportButton size="sm" template="MG-APR-PEND-001" />
          <Button variant="outline" size="icon" aria-label="Refresh"
            onClick={() => { void toDecide.refetch(); void submitted.refetch(); }}>
            <RefreshCw className={`h-4 w-4 ${toDecide.isRefetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search reference or title…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ApprovalItemType | "all")}>
          <SelectTrigger className="w-[220px]" aria-label="Type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {typesPresent.map((t) => <SelectItem key={t} value={t}>{APPROVAL_TYPE_LABEL[t] ?? t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="to_decide">Waiting for me ({toDecide.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="submitted">Sent by me ({submitted.data?.length ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="to_decide" className="mt-4">
          {toDecide.error
            ? <p className="text-sm text-destructive">Couldn't load the queue: {(toDecide.error as Error).message}</p>
            : <QueueList items={filter(toDecide.data)} isLoading={toDecide.isLoading} canDecide onDecide={(item, approve) => setDeciding({ item, approve })} />}
        </TabsContent>
        <TabsContent value="submitted" className="mt-4">
          <QueueList items={filter(submitted.data)} isLoading={submitted.isLoading} canDecide={false} onDecide={() => {}} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!deciding} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deciding?.approve ? "Approve" : "Reject"} {deciding?.item.reference}</DialogTitle>
            <DialogDescription>
              {deciding && `${APPROVAL_TYPE_LABEL[deciding.item.item_type]} · ${deciding.item.title} · ${deciding.item.stage}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="approval-comments">{deciding?.approve ? "Comments" : "Reason *"}</Label>
            <Textarea id="approval-comments" rows={3} value={comments} onChange={(e) => setComments(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button
              variant={deciding?.approve ? "default" : "destructive"}
              onClick={confirm}
              disabled={decide.isPending || (!deciding?.approve && !comments.trim())}
            >
              {deciding?.approve ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
