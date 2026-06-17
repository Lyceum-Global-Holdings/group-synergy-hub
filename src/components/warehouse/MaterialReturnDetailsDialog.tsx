import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MaterialReturnNote } from "@/types/materialIssueReturn";
import { useMaterialReturnItems } from "@/hooks/useMaterialReturnItems";
import { useMaterialReturns } from "@/hooks/useMaterialReturns";
import { format } from "date-fns";
import { CheckCircle, XCircle } from "lucide-react";
import { useCurrentUserRoles } from "@/hooks/useCurrentUserRoles";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MaterialAttachmentsPanel } from "./MaterialAttachmentsPanel";

interface MaterialReturnDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnNote: MaterialReturnNote | null;
}

const getStatusColor = (status: string): "default" | "destructive" | "secondary" => {
  switch (status) {
    case 'draft':
      return 'secondary';
    case 'returned':
      return 'default';
    case 'cancelled':
      return 'destructive';
    default:
      return 'secondary';
  }
};

export function MaterialReturnDetailsDialog({ open, onOpenChange, returnNote }: MaterialReturnDetailsDialogProps) {
  const { returnItems, isLoading } = useMaterialReturnItems(returnNote?.id);
  const { updateMaterialReturn, approveMaterialReturn, isUpdating, isApproving } = useMaterialReturns();
  const { data: userRoles = [] } = useCurrentUserRoles();
  const canApprove = userRoles.some(r => r.role === 'admin' || r.role === 'super_admin');
  const [itemDetails, setItemDetails] = useState<Record<string, { name: string; item_code: string }>>({});

  useEffect(() => {
    if (!returnItems || returnItems.length === 0) {
      setItemDetails({});
      return;
    }
    const ids = Array.from(new Set(returnItems.map((i) => i.item_id).filter(Boolean)));
    if (ids.length === 0) return;
    supabase
      .from('warehouse_items_full')
      .select('id, name, item_code')
      .in('id', ids)
      .then(({ data }) => {
        setItemDetails(
          Object.fromEntries(
            (data ?? []).map((r: any) => [r.id, { name: r.name ?? '', item_code: r.item_code ?? '' }])
          )
        );
      });
  }, [returnItems]);

  if (!returnNote) return null;

  const handleApprove = () => {
    // Use the new approveMaterialReturn mutation that handles stock updates
    approveMaterialReturn({
      id: returnNote.id,
      mrnNumber: returnNote.mrn_number
    });
  };

  const handleCancel = () => {
    updateMaterialReturn({
      id: returnNote.id,
      status: 'cancelled'
    });
  };

  const totalValue = returnItems?.reduce((sum, item) => sum + (item.total_cost || 0), 0) || 0;
  const isProcessing = isUpdating || isApproving;
  const hasReturnItems = (returnItems?.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Material Return Note Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">MRN Number</p>
              <p className="font-semibold">{returnNote.mrn_number}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={getStatusColor(returnNote.status)} className="capitalize">
                {returnNote.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Return Date</p>
              <p>{format(new Date(returnNote.return_date), 'PPP')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Returned By</p>
              <p>{returnNote.returned_by}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Return Type</p>
              <Badge variant="outline" className="capitalize">{returnNote.return_type}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Reference</p>
              <p className="text-sm">
                {returnNote.reference_type ? (
                  <span className="capitalize">{returnNote.reference_type}</span>
                ) : 'N/A'}
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Reason</p>
            <p className="mt-1">{returnNote.reason}</p>
          </div>

          {returnNote.notes && (
            <div>
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="mt-1">{returnNote.notes}</p>
            </div>
          )}

          <Separator />

          {/* Return Items */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Return Items</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Unit Cost</TableHead>
                  <TableHead>Total Cost</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">Loading items...</TableCell>
                  </TableRow>
                ) : returnItems && returnItems.length > 0 ? (
                  returnItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{itemDetails[item.item_id]?.item_code || item.item_id}</TableCell>
                      <TableCell>{itemDetails[item.item_id]?.name || `Item #${item.item_id.slice(0, 8)}`}</TableCell>
                      <TableCell>{item.quantity_returned}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {item.condition}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.unit_cost?.toFixed(2)}</TableCell>
                      <TableCell>{item.total_cost?.toFixed(2)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.notes || '-'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">No items found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <div className="mt-4 flex justify-end">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-lg font-semibold">{totalValue.toFixed(2)}</p>
              </div>
            </div>
          </div>



          {returnNote.company_id && (
            <div className="border rounded-lg p-4 space-y-2">
              <h3 className="font-semibold">Attachments</h3>
              <MaterialAttachmentsPanel
                parentType="material_return"
                parentId={returnNote.id}
                companyId={returnNote.company_id}
                disabled={returnNote.status === 'cancelled'}
                label="Supporting Files"
              />
            </div>
          )}

          {/* Actions */}
          {returnNote.status === 'draft' && (
            <>
              <Separator />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isProcessing}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Return
                </Button>
                {canApprove ? (
                  <Button
                    onClick={handleApprove}
                    disabled={isProcessing || isLoading || !hasReturnItems}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {isApproving ? 'Processing...' : 'Approve Return'}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground self-center">
                    Only admins can approve
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
