import { useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useDecidePoAmendment, usePoAmendmentBlockReason } from "@/hooks/usePoAmendments";
import { amendmentStatus, amendmentTypeLabels, describeAmendment } from "@/components/procurement/amendmentChanges";
import type { PoAmendment } from "@/types/purchaseOrder";

export function PoAmendmentCard({ amendment, showPo = false }: { amendment: PoAmendment; showPo?: boolean }) {
  const status = amendmentStatus(amendment);
  const pending = status === 'pending';
  const { data: blockReason, isSuccess: rightsKnown } = usePoAmendmentBlockReason(amendment.id, pending);
  const decide = useDecidePoAmendment();
  const [comments, setComments] = useState('');
  const canDecide = pending && rightsKnown && !blockReason;
  const changes = describeAmendment(amendment.amendment_type, amendment.previous_value, amendment.new_value);
  const prevTotal = amendment.previous_value?.total;
  const newTotal = amendment.new_value?.total;
  const currency = amendment.purchase_order?.currency ?? '';

  const run = (approve: boolean) =>
    decide.mutate({ id: amendment.id, poId: amendment.po_id, approve, comments: comments.trim() || undefined });

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">{amendment.amendment_number}</Badge>
          <Badge variant="secondary">{amendmentTypeLabels[amendment.amendment_type] ?? amendment.amendment_type}</Badge>
          {status === 'approved' && (
            <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
              <CheckCircle2 className="mr-1 h-3 w-3" /> {amendment.applied_at ? 'Approved and applied' : 'Approved'}
            </Badge>
          )}
          {status === 'rejected' && (
            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
              <XCircle className="mr-1 h-3 w-3" /> Rejected
            </Badge>
          )}
          {pending && (
            <Badge variant="outline" className="border-yellow-200 bg-yellow-50 text-yellow-700">
              <Clock className="mr-1 h-3 w-3" /> Pending approval
            </Badge>
          )}
          {showPo && amendment.purchase_order && (
            <span className="text-sm text-muted-foreground">
              {amendment.purchase_order.po_number}
              {amendment.purchase_order.supplier?.name ? ` · ${amendment.purchase_order.supplier.name}` : ''}
            </span>
          )}
        </div>

        {changes.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {changes.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        ) : (
          amendment.amendment_type !== 'other' && !amendment.new_value && (
            <p className="text-sm text-muted-foreground">No change was recorded with this amendment, so approving it changes nothing on the PO.</p>
          )
        )}
        {prevTotal != null && newTotal != null && Number(prevTotal) !== Number(newTotal) && (
          <p className="text-sm">
            Line total {currency} {Number(prevTotal).toLocaleString()} → <span className="font-semibold">{currency} {Number(newTotal).toLocaleString()}</span>
          </p>
        )}

        <div>
          <p className="text-sm font-medium">Reason</p>
          <p className="text-sm text-muted-foreground">{amendment.reason}</p>
        </div>
        {amendment.notes && (
          <div>
            <p className="text-sm font-medium">Notes</p>
            <p className="whitespace-pre-line text-sm text-muted-foreground">{amendment.notes}</p>
          </div>
        )}
        {status === 'rejected' && amendment.rejection_reason && (
          <p className="text-sm text-red-700">Rejected: {amendment.rejection_reason}</p>
        )}

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>Requested {format(new Date(amendment.created_at), 'PPp')}</span>
          {amendment.approved_date && (
            <span>
              Approved{amendment.approver_profile ? ` by ${amendment.approver_profile.full_name || amendment.approver_profile.email}` : ''} on{' '}
              {format(new Date(amendment.approved_date), 'PPp')}
            </span>
          )}
        </div>

        {canDecide && (
          <div className="space-y-2 border-t pt-3">
            <Textarea
              aria-label={`Comments on ${amendment.amendment_number}`}
              placeholder="Comments (required to reject)"
              rows={2}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => run(true)} disabled={decide.isPending}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Approve and apply
              </Button>
              <Button size="sm" variant="destructive" onClick={() => run(false)} disabled={decide.isPending || !comments.trim()}>
                <XCircle className="mr-2 h-4 w-4" /> Reject
              </Button>
            </div>
          </div>
        )}
        {pending && rightsKnown && blockReason && (
          <p className="text-xs text-muted-foreground">{blockReason}.</p>
        )}
      </CardContent>
    </Card>
  );
}
