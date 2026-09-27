import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Plus, Undo2, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCachedUserId } from "@/lib/currentUser";
import {
  useBpoReleaseBlockReason,
  useBpoReleases,
  useCancelBpoRelease,
  useCreateBpoRelease,
  useDecideBpoRelease,
} from "@/hooks/useBlanketPoReleases";
import { contractPrice } from "@/lib/blanketPo";
import type { BlanketPoRelease, BlanketPurchaseOrder, UrgencyLevel } from "@/types/blanketPurchaseOrder";

interface BlanketPoDetailsDialogProps {
  bpo: BlanketPurchaseOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const releaseStatusLabel: Record<string, string> = {
  draft: "Draft",
  submitted: "Waiting for approval",
  approved: "Approved",
  sent: "Sent",
  received: "Received",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function BlanketPoDetailsDialog({ bpo, open, onOpenChange }: BlanketPoDetailsDialogProps) {
  const currency = bpo.currency || "LKR";
  const money = (n: number) => `${currency} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const { data: releases = [], isLoading } = useBpoReleases(bpo.id);
  const [creating, setCreating] = useState(false);
  const inDates = (() => {
    const today = new Date().toISOString().slice(0, 10);
    return bpo.contract_start_date <= today && today <= bpo.contract_end_date;
  })();
  const canRelease = bpo.contract_status === "active" && inDates;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Blanket PO {bpo.bpo_number}</DialogTitle>
          <DialogDescription>
            {bpo.supplier?.name ?? "Supplier"} · {format(new Date(bpo.contract_start_date), "dd MMM yyyy")} to{" "}
            {format(new Date(bpo.contract_end_date), "dd MMM yyyy")}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="releases">Releases ({releases.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card className="p-4">
              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p><Badge>{bpo.contract_status}</Badge></p>
                </div>
                <div>
                  <span className="text-muted-foreground">Contract value</span>
                  <p className="font-medium">{money(bpo.total_contract_value)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Left to release</span>
                  <p className="font-medium">{money(bpo.remaining_value)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment terms</span>
                  <p>{bpo.payment_terms || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Delivery terms</span>
                  <p>{bpo.delivery_terms || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Activated</span>
                  <p>{bpo.approved_date ? format(new Date(bpo.approved_date), "dd MMM yyyy") : "Not yet"}</p>
                </div>
              </div>
            </Card>
            {bpo.contract_status === "draft" && (
              <p className="text-sm text-muted-foreground">
                Someone with department head approval rights, other than its author, must activate this blanket PO before releases can be raised.
              </p>
            )}
          </TabsContent>

          <TabsContent value="items">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Contract price</TableHead>
                  <TableHead className="text-right">Limit</TableHead>
                  <TableHead className="text-right">Released</TableHead>
                  <TableHead className="text-right">Left</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(bpo.items ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.item_name}</div>
                      {item.item_code && <div className="text-xs text-muted-foreground">{item.item_code}</div>}
                    </TableCell>
                    <TableCell className="text-right">
                      {money(contractPrice(item))} / {item.unit_of_measure}
                      {Number(item.discount_percentage) > 0 && (
                        <div className="text-xs text-muted-foreground">{item.discount_percentage}% off {money(item.unit_price)}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{item.total_quantity_limit ?? "No limit"}</TableCell>
                    <TableCell className="text-right">{Number(item.quantity_released || 0)}</TableCell>
                    <TableCell className="text-right">{item.total_quantity_limit == null ? "—" : Number(item.remaining_quantity ?? item.total_quantity_limit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="releases" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                A release calls off goods at the contract price. Once approved it becomes a purchase order, received with a normal GRN.
              </p>
              {!creating && (
                <Button size="sm" onClick={() => setCreating(true)} disabled={!canRelease}
                  title={canRelease ? undefined : "The blanket PO must be active and within its dates"}>
                  <Plus className="mr-2 h-4 w-4" /> New release
                </Button>
              )}
            </div>

            {creating && <NewReleaseForm bpo={bpo} money={money} onDone={() => setCreating(false)} />}

            {isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading releases…</p>
            ) : releases.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No releases yet.</p>
            ) : (
              releases.map((r) => <ReleaseCard key={r.id} release={r} money={money} />)
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function NewReleaseForm({ bpo, money, onDone }: { bpo: BlanketPurchaseOrder; money: (n: number) => string; onDone: () => void }) {
  const [qty, setQty] = useState<Record<string, string>>({});
  const [expected, setExpected] = useState("");
  const [location, setLocation] = useState("");
  const [urgency, setUrgency] = useState<UrgencyLevel>("normal");
  const [notes, setNotes] = useState("");
  const create = useCreateBpoRelease();
  const items = useMemo(() => bpo.items ?? [], [bpo.items]);

  const lines = useMemo(
    () =>
      items
        .map((item) => ({ item, q: Number(qty[item.id] ?? "") }))
        .filter(({ item, q }) => (qty[item.id] ?? "").trim() !== "" && !Number.isNaN(q)),
    [items, qty],
  );
  const total = lines.reduce((s, { item, q }) => s + contractPrice(item) * q, 0);
  const problem =
    lines.length === 0 ? "Enter a quantity for at least one item"
    : lines.find(({ q }) => q <= 0) ? "Quantities must be above zero"
    : lines.find(({ item, q }) => item.min_order_quantity != null && q < Number(item.min_order_quantity))
      ? "A quantity is below the item's minimum order"
    : lines.find(({ item, q }) => item.max_order_quantity != null && q > Number(item.max_order_quantity))
      ? "A quantity is above the item's maximum order"
    : lines.find(({ item, q }) => item.total_quantity_limit != null && q > Number(item.remaining_quantity ?? item.total_quantity_limit))
      ? "A quantity is more than what's left on the contract"
    : total > Number(bpo.remaining_value) ? "The release is more than the value left on the contract"
    : null;

  const submit = () =>
    create.mutate(
      {
        bpo_id: bpo.id,
        expected_delivery_date: expected || undefined,
        delivery_location: location || undefined,
        urgency_level: urgency,
        notes: notes || undefined,
        items: lines.map(({ item, q }) => ({ bpo_item_id: item.id, quantity_requested: q })),
      },
      { onSuccess: onDone },
    );

  return (
    <Card className="space-y-4 p-4">
      <h4 className="font-medium">New release</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Left</TableHead>
            <TableHead className="w-36">Quantity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                {item.item_name}
                {(item.min_order_quantity != null || item.max_order_quantity != null) && (
                  <div className="text-xs text-muted-foreground">
                    Order {item.min_order_quantity ?? 0}–{item.max_order_quantity ?? "any"} {item.unit_of_measure}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right">{money(contractPrice(item))}</TableCell>
              <TableCell className="text-right">
                {item.total_quantity_limit == null ? "No limit" : `${Number(item.remaining_quantity ?? item.total_quantity_limit)} ${item.unit_of_measure}`}
              </TableCell>
              <TableCell>
                <Input inputMode="decimal" aria-label={`Quantity of ${item.item_name}`} value={qty[item.id] ?? ""}
                  onChange={(e) => setQty((p) => ({ ...p, [item.id]: e.target.value }))} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="rel-expected">Needed by</Label>
          <Input id="rel-expected" type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rel-location">Deliver to</Label>
          <Input id="rel-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Site or store" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rel-urgency">Urgency</Label>
          <Select value={urgency} onValueChange={(v) => setUrgency(v as UrgencyLevel)}>
            <SelectTrigger id="rel-urgency"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="emergency">Emergency</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Textarea aria-label="Release notes" placeholder="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          Total <span className="font-semibold">{money(total)}</span> of {money(bpo.remaining_value)} left
          {problem && <span className="ml-2 text-muted-foreground">· {problem}</span>}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDone} disabled={create.isPending}>Cancel</Button>
          <Button onClick={submit} disabled={!!problem || create.isPending}>
            {create.isPending ? "Submitting…" : "Submit for approval"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ReleaseCard({ release: r, money }: { release: BlanketPoRelease; money: (n: number) => string }) {
  const submitted = r.release_status === "submitted";
  const { data: blockReason, isSuccess: rightsKnown } = useBpoReleaseBlockReason(r.id, submitted);
  const decide = useDecideBpoRelease();
  const cancel = useCancelBpoRelease();
  const [comments, setComments] = useState("");
  const canDecide = submitted && rightsKnown && !blockReason;
  const isRequester = r.requested_by === getCachedUserId();

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono">{r.release_number}</Badge>
        <Badge variant={r.release_status === "cancelled" ? "secondary" : "default"}>{releaseStatusLabel[r.release_status] ?? r.release_status}</Badge>
        {r.urgency_level !== "normal" && <Badge variant="destructive">{r.urgency_level}</Badge>}
        <span className="ml-auto font-semibold">{money(r.total_amount)}</span>
      </div>
      <ul className="space-y-0.5 text-sm">
        {(r.items ?? []).map((i) => (
          <li key={i.id}>
            {i.bpo_item?.item_name ?? "Item"}: {Number(i.quantity_requested)} {i.bpo_item?.unit_of_measure} × {money(i.unit_price)}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Requested {format(new Date(r.created_at), "dd MMM yyyy")}{r.requested_by_profile?.full_name ? ` by ${r.requested_by_profile.full_name}` : ""}</span>
        {r.expected_delivery_date && <span>Needed by {format(new Date(r.expected_delivery_date), "dd MMM yyyy")}</span>}
        {r.delivery_location && <span>To {r.delivery_location}</span>}
        {r.approved_date && <span>Approved {format(new Date(r.approved_date), "dd MMM yyyy")}{r.approved_by_profile?.full_name ? ` by ${r.approved_by_profile.full_name}` : ""}</span>}
        {r.po && <span className="font-medium text-foreground">PO {r.po.po_number} · {r.po.status.replace(/_/g, " ")}</span>}
      </div>
      {r.decision_notes && <p className="text-sm text-muted-foreground">{r.decision_notes}</p>}

      {canDecide && (
        <div className="space-y-2 border-t pt-3">
          <Textarea aria-label={`Comments on ${r.release_number}`} placeholder="Comments (required to reject)" rows={2}
            value={comments} onChange={(e) => setComments(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => decide.mutate({ releaseId: r.id, bpoId: r.bpo_id, approve: true, comments })} disabled={decide.isPending}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Approve and create PO
            </Button>
            <Button size="sm" variant="destructive" onClick={() => decide.mutate({ releaseId: r.id, bpoId: r.bpo_id, approve: false, comments })}
              disabled={decide.isPending || !comments.trim()}>
              <XCircle className="mr-2 h-4 w-4" /> Reject
            </Button>
          </div>
        </div>
      )}
      {submitted && rightsKnown && blockReason && <p className="text-xs text-muted-foreground">{blockReason}.</p>}
      {submitted && isRequester && (
        <Button size="sm" variant="ghost" onClick={() => cancel.mutate({ releaseId: r.id, bpoId: r.bpo_id })} disabled={cancel.isPending}>
          <Undo2 className="mr-2 h-4 w-4" /> Withdraw
        </Button>
      )}
    </Card>
  );
}
