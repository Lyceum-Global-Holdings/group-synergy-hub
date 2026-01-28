import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useGrnById,
  useApproveGoodsReceiptNote,
  useSubmitGoodsReceiptNote,
  useDeleteGoodsReceiptNote,
} from '@/hooks/useGoodsReceiptNotes';
import { useCurrentUserRoles } from '@/hooks/useCurrentUserRoles';
import { GrnStatus } from '@/types/grn';
import { format } from 'date-fns';
import { useState } from 'react';
import { FileText } from 'lucide-react';
import { GrnDocument } from './GrnDocument';

const statusColors: Record<GrnStatus, string> = {
  draft: 'bg-gray-500',
  submitted: 'bg-yellow-500',
  approved: 'bg-green-500',
  completed: 'bg-blue-500',
  cancelled: 'bg-red-500',
};

const statusLabels: Record<GrnStatus, string> = {
  draft: 'Draft',
  submitted: 'Pending Approval',
  approved: 'Approved',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

interface GrnDetailsDialogProps {
  grnId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GrnDetailsDialog({ grnId, open, onOpenChange }: GrnDetailsDialogProps) {
  const { data: grn } = useGrnById(grnId);
  const { data: userRoles = [] } = useCurrentUserRoles();
  const isAdmin = userRoles.some(role => role.role === 'admin' || role.role === 'super_admin');
  const approveGrn = useApproveGoodsReceiptNote();
  const submitGrn = useSubmitGoodsReceiptNote();
  const deleteGrn = useDeleteGoodsReceiptNote();
  const [showDocument, setShowDocument] = useState(false);

  if (!grn) return null;

  const handleApprove = async () => {
    await approveGrn.mutateAsync(grn.id);
  };

  const handleSubmit = async () => {
    await submitGrn.mutateAsync(grn.id);
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this GRN?')) {
      await deleteGrn.mutateAsync(grn.id);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-6 overflow-y-auto">
        {showDocument ? (
          <GrnDocument grn={grn} onClose={() => setShowDocument(false)} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>GRN Details - {grn.grn_number}</span>
                <Badge className={statusColors[grn.status]}>
                  {statusLabels[grn.status]}
                </Badge>
              </DialogTitle>
            </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">GRN Information</h3>
                <div className="space-y-1 text-sm">
                  <p><strong>GRN Number:</strong> {grn.grn_number}</p>
                  <p><strong>GRN Date:</strong> {format(new Date(grn.grn_date), 'PP')}</p>
                  <p><strong>PO Number:</strong> {grn.po_number || 'N/A'}</p>
                  <p><strong>Invoice Number:</strong> {grn.invoice_number || 'N/A'}</p>
                  {grn.invoice_date && (
                    <p><strong>Invoice Date:</strong> {format(new Date(grn.invoice_date), 'PP')}</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Supplier Information</h3>
                <div className="space-y-1 text-sm">
                  <p><strong>Supplier:</strong> {grn.supplier_name || 'N/A'}</p>
                  <p><strong>Address:</strong> {grn.supplier_address || 'N/A'}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Personnel</h3>
                <div className="space-y-1 text-sm">
                  <p><strong>Received By:</strong> {grn.received_by_profile?.full_name || 'N/A'}</p>
                  <p><strong>Created By:</strong> {grn.created_by_profile?.full_name || 'N/A'}</p>
                  {grn.approved_by_profile && (
                    <>
                      <p><strong>Approved By:</strong> {grn.approved_by_profile.full_name}</p>
                      {grn.approved_date && (
                        <p><strong>Approved Date:</strong> {format(new Date(grn.approved_date), 'PP')}</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Financial Summary</h3>
                <div className="space-y-1 text-sm">
                  <p className="text-lg font-bold">
                    Total Value: {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'LKR',
                    }).format(grn.total_value || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Remarks</h3>
              <p className="text-sm text-muted-foreground">
                {grn.remarks || 'No remarks added'}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="items">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead className="text-right">Qty Ordered</TableHead>
                  <TableHead className="text-right">Qty Received</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead>Quality</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grn.grn_items?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.item_name}</TableCell>
                    <TableCell>{item.item_code || '-'}</TableCell>
                    <TableCell>{item.unit_of_measure}</TableCell>
                    <TableCell className="text-right">{item.quantity_ordered || '-'}</TableCell>
                    <TableCell className="text-right">{item.quantity_received}</TableCell>
                    <TableCell className="text-right">{item.unit_price.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{item.total_cost.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.quality_status === 'good'
                            ? 'default'
                            : item.quality_status === 'damaged'
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {item.quality_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={() => setShowDocument(true)}>
            <FileText className="h-4 w-4 mr-2" />
            Generate Document
          </Button>
          
          <div className="flex gap-2">
            {grn.status === 'draft' && (
              <>
                <Button variant="destructive" onClick={handleDelete}>
                  Delete
                </Button>
                <Button onClick={handleSubmit}>
                  Submit for Approval
                </Button>
              </>
            )}
            {grn.status === 'submitted' && isAdmin && (
              <Button onClick={handleApprove}>
                Approve GRN
              </Button>
            )}
          </div>
        </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
