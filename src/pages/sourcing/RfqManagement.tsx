import { useMemo, useState } from "react";
import { FileQuestion, FilePlus, Hourglass, Scale, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GenerateReportButton } from "@/components/management/reports/GenerateReportButton";
import { CreateRfqRfpDialog } from "@/components/procurement/CreateRfqRfpDialog";
import { RfqWorkspaceSheet } from "@/components/sourcing/rfq/RfqWorkspaceSheet";
import { RfqStatusChip, deadlineHint, formatDeadline, formatMoney, isOpenForQuotes } from "@/components/sourcing/rfq/rfqStatus";
import { DataCard, EmptyState, SearchField, Segmented, StatTile, Toolbar } from "@/components/warehouse/master/masterUi";
import { useCompany } from "@/contexts/CompanyContext";
import { useOpenFromQuery } from "@/hooks/useOpenFromQuery";
import { useRfqRfpRequests } from "@/hooks/useRfqRfp";
import type { RfqRfpRequest } from "@/types/rfqRfp";

type Filter = "all" | "draft" | "open" | "evaluation" | "done";

const matchesFilter = (r: RfqRfpRequest, f: Filter) =>
  f === "all" ||
  (f === "draft" && r.status === "draft") ||
  (f === "open" && isOpenForQuotes(r.status)) ||
  (f === "evaluation" && r.status === "evaluation") ||
  (f === "done" && ["awarded", "closed", "cancelled"].includes(r.status));

const closingSoon = (r: RfqRfpRequest) =>
  isOpenForQuotes(r.status) &&
  !!r.submission_deadline &&
  new Date(r.submission_deadline).getTime() - Date.now() < 3 * 86_400_000;

export default function RfqManagement() {
  const { selectedCompany } = useCompany();
  const { data: rfqs = [], isLoading } = useRfqRfpRequests(selectedCompany?.id);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  useOpenFromQuery("new", { "1": () => setCreating(true) });

  const counts = useMemo(() => {
    const c = { all: rfqs.length, draft: 0, open: 0, evaluation: 0, done: 0, soon: 0, awarded: 0 };
    for (const r of rfqs) {
      for (const f of ["draft", "open", "evaluation", "done"] as const) if (matchesFilter(r, f)) c[f] += 1;
      if (closingSoon(r)) c.soon += 1;
      if (r.status === "awarded") c.awarded += 1;
    }
    return c;
  }, [rfqs]);

  const q = search.trim().toLowerCase();
  const rows = rfqs.filter(
    (r) => matchesFilter(r, filter) && (!q || r.title.toLowerCase().includes(q) || r.request_number.toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">RFQ Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite approved suppliers to quote, collect their prices through the supplier portal, then compare and award.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GenerateReportButton template="SR-RFQ-REG-001" />
          <Button className="rounded-full" onClick={() => setCreating(true)}>
            <FilePlus className="mr-2 h-4 w-4" /> New RFQ
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={FileQuestion} label="Open for quotes" value={counts.open} loading={isLoading} onClick={() => setFilter("open")} active={filter === "open"} />
        <StatTile icon={Hourglass} label="Closing within 3 days" value={counts.soon} tone={counts.soon ? "alert" : "default"} loading={isLoading} />
        <StatTile icon={Scale} label="Evaluating" value={counts.evaluation} loading={isLoading} onClick={() => setFilter("evaluation")} active={filter === "evaluation"} />
        <StatTile icon={Trophy} label="Awarded" value={counts.awarded} tone="good" loading={isLoading} />
      </div>

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={search} onChange={setSearch} placeholder="Search RFQ number or title…" />
          <Segmented<Filter>
            label="Status"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "draft", label: "Draft", count: counts.draft },
              { value: "open", label: "Open", count: counts.open },
              { value: "evaluation", label: "Evaluating", count: counts.evaluation },
              { value: "done", label: "Finished", count: counts.done },
            ]}
          />
        </div>
      </Toolbar>

      <DataCard footer={`${rows.length} of ${rfqs.length} RFQs`}>
        {!isLoading && rows.length === 0 ? (
          <EmptyState
            icon={FileQuestion}
            title={rfqs.length === 0 ? "No RFQs yet" : "No RFQs match"}
            description={rfqs.length === 0 ? "Create an RFQ, invite approved suppliers and publish it to collect quotes." : "Try another search or status."}
            action={rfqs.length === 0 ? <Button className="rounded-full" onClick={() => setCreating(true)}>New RFQ</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RFQ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quotes due</TableHead>
                  <TableHead className="text-right">Suppliers</TableHead>
                  <TableHead className="text-right">Quotes</TableHead>
                  <TableHead className="text-right">Lowest total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const submitted = (r.quotes ?? []).filter((x) => x.status !== "draft");
                  const lowest = submitted.length ? Math.min(...submitted.map((x) => Number(x.total_quoted_amount ?? 0))) : null;
                  return (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
                      <TableCell>
                        <div className="font-medium">{r.title}</div>
                        <div className="font-mono text-xs text-muted-foreground">{r.request_number}</div>
                      </TableCell>
                      <TableCell><RfqStatusChip status={r.status} /></TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div>{formatDeadline(r.submission_deadline)}</div>
                        {isOpenForQuotes(r.status) && (
                          <div className={closingSoon(r) ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{deadlineHint(r.submission_deadline)}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.invited_suppliers?.length ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{submitted.length}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{formatMoney(lowest, r.currency)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DataCard>

      <CreateRfqRfpDialog open={creating} onOpenChange={setCreating} />
      <RfqWorkspaceSheet requestId={openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </div>
  );
}
