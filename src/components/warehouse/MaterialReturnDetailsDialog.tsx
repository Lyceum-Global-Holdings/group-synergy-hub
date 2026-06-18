import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MaterialReturnNote } from "@/types/materialIssueReturn";
import { useMaterialReturnItems } from "@/hooks/useMaterialReturnItems";
import { useMaterialReturns } from "@/hooks/useMaterialReturns";
import { format } from "date-fns";
import { CheckCircle, Plus, Trash2, XCircle } from "lucide-react";
import { useCurrentUserRoles } from "@/hooks/useCurrentUserRoles";
import { useEffect, useState } from "react";
import { MaterialAttachmentsPanel } from "./MaterialAttachmentsPanel";
import { ItemSelector } from "@/components/common/ItemSelector";
import { supabase } from "@/integrations/supabase/client";

type RepairItem = {
  item_id: string;
  item_code: string;
  item_name: string;
  quantity_returned: number;
  condition: 'good' | 'damaged' | 'expired';
  unit_cost: number;
  notes: string;
};

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
  const { updateMaterialReturn, approveMaterialReturn, addMissingReturnItemsAsync, isUpdating, isApproving, isRepairing } = useMaterialReturns();
  const { data: userRoles = [] } = useCurrentUserRoles();
  const canApprove = userRoles.some(r => r.role === 'admin' || r.role === 'super_admin');
  const [repairItems, setRepairItems] = useState<RepairItem[]>([]);

  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLocationLabel(null);
    const id = returnNote?.location_id;
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from('warehouse_locations')
        .select('name, location_code')
        .eq('id', id)
        .maybeSingle();
      if (cancelled || !data) return;
      const label = (data as any).location_code
        ? `${(data as any).location_code} · ${(data as any).name}`
        : (data as any).name;
      setLocationLabel(label);
    })();
    return () => { cancelled = true; };
  }, [returnNote?.location_id]);

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
  const isProcessing = isUpdating || isApproving || isRepairing;
  const hasReturnItems = (returnItems?.length ?? 0) > 0;
  const canRepairMissingItems = canApprove && !isLoading && !hasReturnItems && returnNote.company_id && returnNote.status !== 'cancelled';

  const addRepairItem = () => {
    setRepairItems((prev) => [...prev, { item_id: '', item_code: '', item_name: '', quantity_returned: 0, condition: 'good', unit_cost: 0, notes: '' }]);
  };

  const updateRepairItem = (index: number, patch: Partial<RepairItem>) => {
    setRepairItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const removeRepairItem = (index: number) => {
    setRepairItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddMissingItems = async () => {
    if (!returnNote || !canRepairMissingItems) return;
    const payload = repairItems
      .filter((item) => item.item_id && item.quantity_returned > 0)
      .map((item) => ({
        item_id: item.item_id,
        quantity_returned: item.quantity_returned,
        condition: item.condition,
        unit_cost: item.unit_cost,
        total_cost: item.quantity_returned * item.unit_cost,
        notes: item.notes || undefined,
      }));

    if (!payload.length) return;
    await addMissingReturnItemsAsync({ mrnId: returnNote.id, items: payload });
    setRepairItems([]);
  };

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
              <p className="text-sm text-muted-foreground">Location</p>
              <p className="text-sm">{locationLabel ?? (returnNote.location_id ? '…' : '—')}</p>
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
                      <TableCell>{item.item_code || item.item_id}</TableCell>
                      <TableCell>{item.item_name || `Item #${item.item_id.slice(0, 8)}`}</TableCell>
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
                    <TableCell colSpan={7} className="text-center">
                      No return items were saved for this MRN
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {canRepairMissingItems && (
              <div className="mt-4 rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-medium">Add missing return items</h4>
                    <p className="text-xs text-muted-foreground">
                      Use this only to repair MRNs that were saved before item lines were recorded.
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={addRepairItem} disabled={isProcessing}>
                    <Plus className="h-4 w-4 mr-2" /> Add item
                  </Button>
                </div>

                {repairItems.map((item, index) => (
                  <div key={index} className="rounded-md border p-3 space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <ItemSelector
                          value={item.item_id}
                          onSelect={(selected) => updateRepairItem(index, {
                            item_id: selected?.id ?? '',
                            item_code: selected?.item_code ?? '',
                            item_name: selected?.name ?? '',
                            unit_cost: selected?.unit_cost ?? 0,
                          })}
                        />
                      </div>
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeRepairItem(index)} disabled={isProcessing}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.quantity_returned || ''}
                          onChange={(event) => updateRepairItem(index, { quantity_returned: Math.max(0, parseFloat(event.target.value) || 0) })}
                        />
                      </div>
                      <div>
                        <Label>Condition</Label>
                        <Select value={item.condition} onValueChange={(value: any) => updateRepairItem(index, { condition: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="damaged">Damaged</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Unit Cost</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unit_cost || ''}
                          onChange={(event) => updateRepairItem(index, { unit_cost: Math.max(0, parseFloat(event.target.value) || 0) })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Input value={item.notes} onChange={(event) => updateRepairItem(index, { notes: event.target.value })} />
                    </div>
                  </div>
                ))}

                {repairItems.length > 0 && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={handleAddMissingItems}
                      disabled={isProcessing || !repairItems.some((item) => item.item_id && item.quantity_returned > 0)}
                    >
                      {isRepairing ? 'Saving…' : 'Save missing items'}
                    </Button>
                  </div>
                )}
              </div>
            )}

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
                    title={!hasReturnItems ? 'Add at least one return item before approval' : undefined}
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
