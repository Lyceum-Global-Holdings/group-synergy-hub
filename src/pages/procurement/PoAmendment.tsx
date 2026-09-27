import { useMemo, useState } from "react";
import { CheckCircle, Clock, FileEdit, History, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, SearchField, Segmented, StatTile, Toolbar } from "@/components/warehouse/master/masterUi";
import { PoAmendmentCard } from "@/components/procurement/PoAmendmentCard";
import { amendmentStatus, amendmentTypeLabels } from "@/components/procurement/amendmentChanges";
import { CreatePoAmendmentDialog } from "@/components/procurement/CreatePoAmendmentDialog";
import { useCompany } from "@/contexts/CompanyContext";
import { useCompanyPoAmendments } from "@/hooks/usePoAmendments";
import { usePurchaseOrder, usePurchaseOrders } from "@/hooks/usePurchaseOrders";

type View = "pending" | "approved" | "rejected" | "all";
const AMENDABLE = ["approved", "sent", "acknowledged", "partially_received"];

export default function PoAmendment() {
  const { selectedCompany } = useCompany();
  const { data: amendments = [], isLoading } = useCompanyPoAmendments(selectedCompany?.id);
  const [view, setView] = useState<View>("pending");
  const [search, setSearch] = useState("");
  const [picking, setPicking] = useState(false);
  const [pickedPoId, setPickedPoId] = useState("");
  const [amendPoId, setAmendPoId] = useState("");

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, all: amendments.length };
    for (const a of amendments) c[amendmentStatus(a)]++;
    return c;
  }, [amendments]);

  const shown = amendments.filter((a) => {
    if (view !== "all" && amendmentStatus(a) !== view) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [a.amendment_number, a.reason, a.purchase_order?.po_number, a.purchase_order?.supplier?.name, amendmentTypeLabels[a.amendment_type]]
      .some((v) => v?.toLowerCase().includes(q));
  });

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PO Amendments</h1>
          <p className="text-muted-foreground">
            Changes to approved purchase orders. Each one is applied to the PO only after department head approval.
          </p>
        </div>
        <Button onClick={() => { setPickedPoId(""); setPicking(true); }} disabled={!selectedCompany}>
          <FileEdit className="mr-2 h-4 w-4" /> New Amendment
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile icon={Clock} label="Waiting for approval" value={counts.pending} loading={isLoading} tone={counts.pending ? "alert" : "default"}
          onClick={() => setView("pending")} active={view === "pending"} />
        <StatTile icon={CheckCircle} label="Approved and applied" value={counts.approved} loading={isLoading} tone="good"
          onClick={() => setView("approved")} active={view === "approved"} />
        <StatTile icon={XCircle} label="Rejected" value={counts.rejected} loading={isLoading}
          onClick={() => setView("rejected")} active={view === "rejected"} />
      </div>

      <Toolbar>
        <div className="flex flex-wrap items-center gap-3">
          <SearchField value={search} onChange={setSearch} placeholder="Search by amendment, PO, supplier or reason…" />
          <Segmented<View>
            label="Show"
            value={view}
            onChange={setView}
            options={[
              { value: "pending", label: "Pending", count: counts.pending },
              { value: "approved", label: "Approved", count: counts.approved },
              { value: "rejected", label: "Rejected", count: counts.rejected },
              { value: "all", label: "All", count: counts.all },
            ]}
          />
        </div>
      </Toolbar>

      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">Loading amendments…</p>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={view === "pending" ? Clock : History}
          title={view === "pending" ? "Nothing waiting for approval" : "No amendments here"}
          description="Raise an amendment from an approved purchase order, or with New Amendment above."
        />
      ) : (
        <div className="space-y-3">
          {shown.map((a) => <PoAmendmentCard key={a.id} amendment={a} showPo />)}
        </div>
      )}

      <PickPoDialog
        open={picking}
        onOpenChange={setPicking}
        value={pickedPoId}
        onChange={setPickedPoId}
        onContinue={() => { setPicking(false); setAmendPoId(pickedPoId); }}
      />
      {amendPoId && <AmendPo poId={amendPoId} onClose={() => setAmendPoId("")} />}
    </div>
  );
}

function PickPoDialog({ open, onOpenChange, value, onChange, onContinue }: {
  open: boolean; onOpenChange: (o: boolean) => void; value: string; onChange: (v: string) => void; onContinue: () => void;
}) {
  const { data: orders = [] } = usePurchaseOrders();
  const amendable = orders.filter((po) => AMENDABLE.includes(po.status));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Which purchase order?</DialogTitle>
          <DialogDescription>Approved orders that aren't complete can be amended. Drafts are edited directly.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="amend-po">Purchase order</Label>
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger id="amend-po"><SelectValue placeholder={amendable.length ? "Choose a PO" : "No approved POs to amend"} /></SelectTrigger>
            <SelectContent>
              {amendable.map((po) => (
                <SelectItem key={po.id} value={po.id}>
                  {po.po_number} · {(po as { supplier?: { name?: string } }).supplier?.name ?? "—"} · {po.status.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onContinue} disabled={!value}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Loads the full PO (with its lines) before opening the amendment form.
function AmendPo({ poId, onClose }: { poId: string; onClose: () => void }) {
  const { data: po } = usePurchaseOrder(poId);
  if (!po) return null;
  return <CreatePoAmendmentDialog open onOpenChange={(o) => !o && onClose()} purchaseOrder={po} />;
}
