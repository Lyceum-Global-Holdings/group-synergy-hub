import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, X, Send, Ban, PackageCheck, Undo2, CheckCircle2 } from "lucide-react";
import { CheckoutDialog } from "@/components/tuh-modules/costume-rental/CheckoutDialog";
import { ReturnDialog } from "@/components/tuh-modules/costume-rental/ReturnDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useCompany } from "@/contexts/CompanyContext";
import { useRentalOrder, useRentalOrders } from "@/hooks/useRentalOrders";
import { useIsAdmin, useSuperAdmin } from "@/hooks/useSuperAdmin";
import { formatCurrency } from "@/lib/utils";
import type { RentalOrderItem } from "@/types/costumeRental";

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function CostumeRentalView() {
  const { rentalId } = useParams();
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();
  const { data: order, isLoading } = useRentalOrder(rentalId);
  const { submitOrder, approveOrder, rejectOrder, cancelOrder, completeOrder, isMutating } = useRentalOrders(selectedCompany?.id);
  const { data: isAdmin } = useIsAdmin();
  const { data: isSuperAdmin } = useSuperAdmin();
  const canApprove = (isAdmin || isSuperAdmin) ?? false;
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [action, setAction] = useState<null | "approve" | "reject" | "cancel">(null);
  const [reason, setReason] = useState("");

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!order) return <div className="p-6 text-sm text-muted-foreground">Rental order not found.</div>;

  const s = order.status;

  const ACTION_META = {
    approve: { title: "Approve rental", label: "Comment (optional)", required: false, btn: "Approve", variant: "default" as const },
    reject: { title: "Reject rental", label: "Reason for rejection", required: true, btn: "Reject", variant: "destructive" as const },
    cancel: { title: "Cancel rental", label: "Cancellation reason (optional)", required: false, btn: "Cancel rental", variant: "destructive" as const },
  };

  const runAction = async () => {
    if (!action) return;
    const r = reason.trim() || undefined;
    try {
      if (action === "approve") await approveOrder(order.id, r);
      else if (action === "reject") await rejectOrder(order.id, r);
      else if (action === "cancel") await cancelOrder(order.id, r);
    } finally {
      setAction(null);
      setReason("");
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => navigate("/tuh-modules/costume-rental")}>
        <ArrowLeft className="h-4 w-4" /> Back to rentals
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold font-mono">{order.rental_number}</h1>
          <p className="text-sm text-muted-foreground">{order.customer?.customer_name ?? "No customer"}</p>
        </div>
        <Badge className="capitalize text-sm">{s.replace(/_/g, " ")}</Badge>
      </div>

      {/* Lifecycle actions */}
      <div className="flex flex-wrap gap-2">
        {s === "draft" && (
          <Button onClick={() => submitOrder(order.id)} disabled={isMutating}>
            <Send className="h-4 w-4 mr-2" /> Submit for approval
          </Button>
        )}
        {s === "pending_approval" && canApprove && (
          <>
            <Button onClick={() => { setReason(""); setAction("approve"); }} disabled={isMutating}>
              <Check className="h-4 w-4 mr-2" /> Approve
            </Button>
            <Button variant="outline" onClick={() => { setReason(""); setAction("reject"); }} disabled={isMutating}>
              <X className="h-4 w-4 mr-2" /> Reject
            </Button>
          </>
        )}
        {s === "approved" && canApprove && (
          <Button onClick={() => setCheckoutOpen(true)} disabled={isMutating}>
            <PackageCheck className="h-4 w-4 mr-2" /> Check out
          </Button>
        )}
        {s === "checked_out" && canApprove && (
          <Button onClick={() => setReturnOpen(true)} disabled={isMutating}>
            <Undo2 className="h-4 w-4 mr-2" /> Process return
          </Button>
        )}
        {s === "returned" && (
          <Button onClick={() => completeOrder(order.id)} disabled={isMutating}>
            <CheckCircle2 className="h-4 w-4 mr-2" /> Complete
          </Button>
        )}
        {["draft", "pending_approval", "approved", "rejected"].includes(s) && (
          <Button variant="ghost" className="text-destructive" onClick={() => { setReason(""); setAction("cancel"); }} disabled={isMutating}>
            <Ban className="h-4 w-4 mr-2" /> Cancel
          </Button>
        )}
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Pickup", value: fmtDate(order.pickup_date) },
          { label: "Due", value: fmtDate(order.due_date) },
          { label: "Booked", value: fmtDate(order.booking_date) },
          { label: "Returned", value: fmtDate(order.actual_return_date) },
        ].map((d) => (
          <div key={d.label}><p className="text-xs text-muted-foreground">{d.label}</p><p className="font-medium">{d.value}</p></div>
        ))}
      </div>

      {order.approval_comments && (
        <p className="text-sm"><span className="text-muted-foreground">Approval/Reject note: </span>{order.approval_comments}</p>
      )}

      {(order.approved_date || order.checked_out_at || order.returned_at) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {order.approved_date && <span>{order.status === "rejected" ? "Rejected" : "Approved"}: {fmtDate(order.approved_date)}</span>}
          {order.checked_out_at && <span>Checked out: {fmtDate(order.checked_out_at)}</span>}
          {order.returned_at && <span>Returned: {fmtDate(order.returned_at)}</span>}
        </div>
      )}

      {/* Items */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Costumes</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Costume</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead className="text-right">Rate/day</TableHead>
                <TableHead className="text-right">Line total</TableHead>
                <TableHead className="text-right">Deposit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(order.items ?? []).map((it: RentalOrderItem) => (
                <TableRow key={it.id}>
                  <TableCell>{it.costume?.name ?? "—"} <span className="text-xs text-muted-foreground font-mono">{it.costume?.costume_code}</span></TableCell>
                  <TableCell className="text-right">{it.quantity}</TableCell>
                  <TableCell className="text-right">{it.rental_days}</TableCell>
                  <TableCell className="text-right">{formatCurrency(it.daily_rate)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(it.line_total)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(it.security_deposit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Rental total</span><span>{formatCurrency(order.rental_total)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatCurrency(order.tax_amount)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>−{formatCurrency(order.discount_amount)}</span></div>
        <div className="flex justify-between font-medium border-t pt-1"><span>Payable</span><span>{formatCurrency(order.total_amount)}</span></div>
        <div className="flex justify-between text-muted-foreground"><span>Security deposit</span><span>{formatCurrency(order.deposit_total)}</span></div>
        {(order.status === "returned" || order.status === "completed") && (
          <>
            <div className="flex justify-between text-muted-foreground"><span>Late fee</span><span>−{formatCurrency(order.late_fee)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Damage fee</span><span>−{formatCurrency(order.damage_fee)}</span></div>
            <div className="flex justify-between font-medium border-t pt-1"><span>Deposit refund</span><span>{formatCurrency(order.deposit_refund)}</span></div>
          </>
        )}
      </div>

      <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} order={order} companyId={selectedCompany?.id} />
      <ReturnDialog open={returnOpen} onOpenChange={setReturnOpen} order={order} companyId={selectedCompany?.id} />

      <Dialog open={!!action} onOpenChange={(o) => { if (!o) { setAction(null); setReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{action ? ACTION_META[action].title : ""}</DialogTitle></DialogHeader>
          {action && (
            <div className="space-y-2">
              <Label>{ACTION_META[action].label}</Label>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder={ACTION_META[action].required ? "Required" : "Optional"} autoFocus />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAction(null); setReason(""); }}>Back</Button>
            <Button
              variant={action ? ACTION_META[action].variant : "default"}
              disabled={isMutating || (action ? ACTION_META[action].required && !reason.trim() : false)}
              onClick={runAction}
            >
              {action ? ACTION_META[action].btn : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
