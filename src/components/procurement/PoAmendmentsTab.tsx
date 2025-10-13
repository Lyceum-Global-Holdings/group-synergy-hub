import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, FileText } from "lucide-react";
import { usePoAmendments, useApprovePoAmendment } from "@/hooks/usePoAmendments";
import type { PoAmendment } from "@/types/purchaseOrder";

interface PoAmendmentsTabProps {
  poId: string;
  isAdmin: boolean;
}

const amendmentTypeLabels: Record<string, string> = {
  price_change: 'Price Change',
  quantity_change: 'Quantity Change',
  delivery_date_change: 'Delivery Date Change',
  terms_change: 'Terms Change',
  item_addition: 'Item Addition',
  item_removal: 'Item Removal',
  other: 'Other',
};

const amendmentTypeColors: Record<string, string> = {
  price_change: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  quantity_change: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  delivery_date_change: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  terms_change: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  item_addition: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
  item_removal: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

export function PoAmendmentsTab({ poId, isAdmin }: PoAmendmentsTabProps) {
  const { data: amendments, isLoading } = usePoAmendments(poId);
  const approveAmendment = useApprovePoAmendment();

  const handleApprove = async (amendmentId: string) => {
    await approveAmendment.mutateAsync({ id: amendmentId, poId });
  };

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading amendments...</div>;
  }

  if (!amendments || amendments.length === 0) {
    return (
      <div className="p-6 text-center">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <p className="mt-2 text-muted-foreground">No amendments found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {amendments.map((amendment: PoAmendment) => (
        <Card key={amendment.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {amendment.amendment_number}
                  </Badge>
                  <Badge className={amendmentTypeColors[amendment.amendment_type]}>
                    {amendmentTypeLabels[amendment.amendment_type]}
                  </Badge>
                  {amendment.approved_by ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Approved
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                      <Clock className="mr-1 h-3 w-3" />
                      Pending Approval
                    </Badge>
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium">Reason</p>
                  <p className="text-sm text-muted-foreground">{amendment.reason}</p>
                </div>

                {amendment.notes && (
                  <div>
                    <p className="text-sm font-medium">Notes</p>
                    <p className="text-sm text-muted-foreground">{amendment.notes}</p>
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Created: {format(new Date(amendment.created_at), 'PPp')}</span>
                  {amendment.approved_date && amendment.approver_profile && (
                    <span>
                      Approved by {amendment.approver_profile.full_name || amendment.approver_profile.email} 
                      {' '}on {format(new Date(amendment.approved_date), 'PPp')}
                    </span>
                  )}
                </div>
              </div>

              {isAdmin && !amendment.approved_by && (
                <Button
                  size="sm"
                  onClick={() => handleApprove(amendment.id)}
                  disabled={approveAmendment.isPending}
                >
                  {approveAmendment.isPending ? "Approving..." : "Approve"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
