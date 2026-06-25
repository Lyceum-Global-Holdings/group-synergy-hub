import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ItemBatch, BatchStatus } from "@/types/batch";
import { format, parseISO, isAfter, isBefore, addDays } from "date-fns";
import { 
  Package, 
  Calendar, 
  Hash, 
  DollarSign, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  History,
  FileText
} from "lucide-react";
import { useUpdateBatchStatus } from "@/hooks/useBatches";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface BatchDetailsDialogProps {
  batch: ItemBatch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<BatchStatus, { label: string; color: string; icon: React.ReactNode }> = {
  active: { 
    label: 'Active', 
    color: 'bg-green-500/10 text-green-600 border-green-500/20',
    icon: <CheckCircle className="h-4 w-4" />
  },
  depleted: { 
    label: 'Depleted', 
    color: 'bg-muted text-muted-foreground border-border',
    icon: <Package className="h-4 w-4" />
  },
  expired: { 
    label: 'Expired', 
    color: 'bg-red-500/10 text-red-600 border-red-500/20',
    icon: <XCircle className="h-4 w-4" />
  },
  quarantine: { 
    label: 'Quarantine', 
    color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    icon: <Shield className="h-4 w-4" />
  },
};

export function BatchDetailsDialog({ batch, open, onOpenChange }: BatchDetailsDialogProps) {
  const [newStatus, setNewStatus] = useState<BatchStatus | ''>('');
  const [notes, setNotes] = useState('');
  const updateStatus = useUpdateBatchStatus();

  // Fetch consumption history
  const { data: consumptionHistory = [] } = useQuery({
    queryKey: ['batch-consumption', batch?.id],
    queryFn: async () => {
      if (!batch?.id) return [];
      const { data, error } = await supabase
        .from('batch_issue_details')
        .select(`
          id,
          quantity_from_batch,
          created_at,
          issue_item:material_issue_items(
            id,
            issue:material_issues(
              issue_number,
              issue_date,
              issued_to
            )
          )
        `)
        .eq('batch_id', batch.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!batch?.id && open,
  });

  // Fetch source GRN info
  const { data: sourceGrn } = useQuery({
    queryKey: ['batch-source-grn', batch?.grn_item_id],
    queryFn: async () => {
      if (!batch?.grn_item_id) return null;
      const { data, error } = await supabase
        .from('grn_items')
        .select('grn_id, grn:goods_receipt_notes(grn_number, grn_date)')
        .eq('id', batch.grn_item_id)
        .single();

      if (error) return null;
      return data;
    },
    enabled: !!batch?.grn_item_id && open,
  });

  if (!batch) return null;

  const today = new Date();
  const thirtyDaysFromNow = addDays(today, 30);
  const expiryDate = batch.expiry_date ? parseISO(batch.expiry_date) : null;
  const isExpired = expiryDate && isBefore(expiryDate, today);
  const isExpiringSoon = expiryDate && isAfter(expiryDate, today) && isBefore(expiryDate, thirtyDaysFromNow);
  
  const usagePercentage = batch.quantity_received > 0 
    ? ((batch.quantity_received - batch.quantity_remaining) / batch.quantity_received) * 100 
    : 0;

  const handleStatusUpdate = async () => {
    if (!newStatus) return;
    
    await updateStatus.mutateAsync({
      batchId: batch.id,
      status: newStatus,
      notes: notes || undefined,
    });
    
    setNewStatus('');
    setNotes('');
    onOpenChange(false);
  };

  const config = statusConfig[batch.status];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Batch Details: {batch.batch_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Basic Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={config.color}>
                {config.icon}
                <span className="ml-1">{config.label}</span>
              </Badge>
              {isExpired && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Expired
                </Badge>
              )}
              {isExpiringSoon && !isExpired && (
                <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Expiring Soon
                </Badge>
              )}
            </div>
          </div>

          {/* Item Information */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Item Information</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Item Name:</span>
                <p className="font-medium">{batch.warehouse_item?.name || 'N/A'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Item Code:</span>
                <p className="font-medium">{batch.warehouse_item?.item_code || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Source GRN */}
          {sourceGrn && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
              <h4 className="font-medium flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Source GRN
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">GRN Number:</span>
                  <p className="font-medium">{(sourceGrn as any).grn?.grn_number || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">GRN Date:</span>
                  <p className="font-medium">
                    {(sourceGrn as any).grn?.grn_date 
                      ? format(parseISO((sourceGrn as any).grn.grn_date), 'PP') 
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Quantity and Dates */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Quantities
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Quantity Received:</span>
                  <span className="font-medium">{batch.quantity_received}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Quantity Remaining:</span>
                  <span className="font-medium">{batch.quantity_remaining}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Quantity Used:</span>
                  <span className="font-medium">{batch.quantity_received - batch.quantity_remaining}</span>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Usage</span>
                    <span>{usagePercentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${usagePercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Dates
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Manufacturing Date:</span>
                  <span className="font-medium">
                    {batch.manufacturing_date 
                      ? format(parseISO(batch.manufacturing_date), 'PP') 
                      : 'Not set'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Expiry Date:</span>
                  <span className={`font-medium ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-orange-600' : ''}`}>
                    {batch.expiry_date 
                      ? format(parseISO(batch.expiry_date), 'PP') 
                      : 'Not set'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Created At:</span>
                  <span className="font-medium">
                    {format(parseISO(batch.created_at), 'PP')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Cost Information */}
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Cost Information
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unit Cost:</span>
                <span className="font-medium">{formatCurrency(batch.unit_cost || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Value (Remaining):</span>
                <span className="font-medium">
                  {formatCurrency((batch.unit_cost || 0) * batch.quantity_remaining)}

                </span>
              </div>
            </div>
          </div>

          {/* Consumption History */}
          {consumptionHistory.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Consumption History
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issue #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Issued To</TableHead>
                      <TableHead className="text-right">Qty Consumed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumptionHistory.map((record: any) => {
                      const issue = record.issue_item?.issue;
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            {issue?.issue_number || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {issue?.issue_date 
                              ? format(parseISO(issue.issue_date), 'PP') 
                              : record.created_at 
                                ? format(parseISO(record.created_at), 'PP')
                                : '-'}
                          </TableCell>
                          <TableCell>{issue?.issued_to || '-'}</TableCell>
                          <TableCell className="text-right font-medium">
                            {record.quantity_from_batch}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Notes */}
          {batch.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium">Notes</h4>
                <p className="text-sm text-muted-foreground">{batch.notes}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Update Status Section */}
          <div className="space-y-4 bg-muted/30 p-4 rounded-lg">
            <h4 className="font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Update Status
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>New Status</Label>
                <Select value={newStatus} onValueChange={(v) => setNewStatus(v as BatchStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="quarantine">Quarantine</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="depleted">Depleted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea 
                  placeholder="Add notes about this status change..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button 
                onClick={handleStatusUpdate} 
                disabled={!newStatus || updateStatus.isPending}
              >
                {updateStatus.isPending ? 'Updating...' : 'Update Status'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}