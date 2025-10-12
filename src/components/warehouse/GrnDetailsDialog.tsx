import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { useGoodsReceiptNote, useUpdateGoodsReceiptNote } from '@/hooks/useGoodsReceiptNotes';
import { GrnStatus } from '@/types/grn';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const statusStyles: Record<GrnStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800'
};

const statusLabels: Record<GrnStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  completed: 'Completed'
};

const qualityStatusStyles = {
  good: 'bg-green-100 text-green-800',
  damaged: 'bg-yellow-100 text-yellow-800',
  rejected: 'bg-red-100 text-red-800'
};

const qualityStatusLabels = {
  good: 'Good',
  damaged: 'Damaged',
  rejected: 'Rejected'
};

interface GrnDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grnId: string;
}

export function GrnDetailsDialog({ open, onOpenChange, grnId }: GrnDetailsDialogProps) {
  const { data: grn, isLoading } = useGoodsReceiptNote(grnId);
  const updateGrnMutation = useUpdateGoodsReceiptNote();

  const handleStatusChange = async (newStatus: GrnStatus) => {
    if (!grn) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await updateGrnMutation.mutateAsync({
        id: grn.id,
        updates: { 
          status: newStatus,
          ...(newStatus === 'approved' && { 
            approved_date: new Date().toISOString(),
            approved_by: user?.id
          })
        }
      });
    } catch (error) {
      console.error('Error updating GRN status:', error);
    }
  };

  if (isLoading || !grn) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex justify-center items-center py-8">
            Loading GRN details...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl">Goods Receipt Note</DialogTitle>
              <DialogDescription>
                GRN Details - {grn.grn_number}
              </DialogDescription>
            </div>
            <Badge className={cn(statusStyles[grn.status])}>
              {statusLabels[grn.status]}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">GRN Number</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold">{grn.grn_number}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">GRN Date</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold">{format(new Date(grn.grn_date), 'MMM dd, yyyy')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Branch</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold">{grn.branch || '-'}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Value</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold">
                  LKR {grn.total_value.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice Number:</span>
                  <span className="font-medium">{grn.invoice_number || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice Date:</span>
                  <span className="font-medium">
                    {grn.invoice_date ? format(new Date(grn.invoice_date), 'MMM dd, yyyy') : '-'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Reference Numbers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">P.O. Number:</span>
                  <span className="font-medium">{grn.po_number || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">P.R. Number:</span>
                  <span className="font-medium">{grn.pr_number || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">M.R. Number:</span>
                  <span className="font-medium">{grn.mr_number || '-'}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Supplier Information */}
          <Card>
            <CardHeader>
              <CardTitle>Supplier Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Supplier Name</p>
                  <p className="font-semibold">{grn.supplier_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Supplier Address</p>
                  <p className="font-medium">{grn.supplier_address || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Qty Ordered</TableHead>
                      <TableHead>Qty Received</TableHead>
                      <TableHead>UOM</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total Cost</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grn.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.item_code || '-'}</TableCell>
                        <TableCell>{item.item_name}</TableCell>
                        <TableCell>{item.quantity_ordered}</TableCell>
                        <TableCell>{item.quantity_received}</TableCell>
                        <TableCell>{item.unit_of_measure}</TableCell>
                        <TableCell>
                          {item.unit_price ? `LKR ${item.unit_price.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell>
                          {item.total_cost ? `LKR ${item.total_cost.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(qualityStatusStyles[item.quality_status])}>
                            {qualityStatusLabels[item.quality_status]}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.remarks || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <Separator className="my-4" />
              
              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-lg font-semibold">
                    Total Value: LKR {grn.total_value.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Remarks */}
          {grn.remarks && (
            <Card>
              <CardHeader>
                <CardTitle>Remarks</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{grn.remarks}</p>
              </CardContent>
            </Card>
          )}

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{format(new Date(grn.created_at), 'MMM dd, yyyy HH:mm')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="font-medium">{format(new Date(grn.updated_at), 'MMM dd, yyyy HH:mm')}</p>
                </div>
                {grn.approved_date && (
                  <div>
                    <p className="text-sm text-muted-foreground">Approved</p>
                    <p className="font-medium">{format(new Date(grn.approved_date), 'MMM dd, yyyy HH:mm')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            <div className="flex gap-2">
              {grn.status === 'draft' && (
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange('submitted')}
                  disabled={updateGrnMutation.isPending}
                >
                  Submit for Approval
                </Button>
              )}
              {grn.status === 'submitted' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleStatusChange('draft')}
                    disabled={updateGrnMutation.isPending}
                  >
                    Return to Draft
                  </Button>
                  <Button
                    onClick={() => handleStatusChange('approved')}
                    disabled={updateGrnMutation.isPending}
                  >
                    Approve GRN
                  </Button>
                </>
              )}
              {grn.status === 'approved' && (
                <Button
                  onClick={() => handleStatusChange('completed')}
                  disabled={updateGrnMutation.isPending}
                >
                  Mark as Completed
                </Button>
              )}
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}