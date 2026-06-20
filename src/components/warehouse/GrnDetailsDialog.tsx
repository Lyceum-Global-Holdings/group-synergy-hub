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
  useRejectGoodsReceiptNote,
  useReopenGoodsReceiptNote,
} from '@/hooks/useGoodsReceiptNotes';
import { useCurrentUserRoles } from '@/hooks/useCurrentUserRoles';
import { GrnStatus, GrnRejectionReason, GRN_REJECTION_REASON_LABELS } from '@/types/grn';
import { format } from 'date-fns';
import { useState } from 'react';
import { FileText, Eye, Download } from 'lucide-react';
import { GrnDocument } from './GrnDocument';
import { GrnBinAllocationDialog, BinAllocation } from './GrnBinAllocationDialog';
import { RejectGrnDialog } from './RejectGrnDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const statusColors: Record<GrnStatus, string> = {
  draft: 'bg-gray-500',
  submitted: 'bg-yellow-500',
  approved: 'bg-green-500',
  completed: 'bg-blue-500',
  cancelled: 'bg-red-500',
  rejected: 'bg-red-600',
};

const statusLabels: Record<GrnStatus, string> = {
  draft: 'Draft',
  submitted: 'Pending Approval',
  approved: 'Approved',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
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
  const rejectGrn = useRejectGoodsReceiptNote();
  const reopenGrn = useReopenGoodsReceiptNote();
  const [showDocument, setShowDocument] = useState(false);
  const [showBinAllocation, setShowBinAllocation] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const handleViewInvoice = async () => {
    if (!grn?.invoice_document_url) return;
    try {
      setInvoiceLoading(true);
      const { data, error } = await supabase.storage
        .from('grn-invoices')
        .createSignedUrl(grn.invoice_document_url, 300);
      if (error) throw error;
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast.error(e.message || 'Could not open invoice');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!grn?.invoice_document_url) return;
    try {
      setInvoiceLoading(true);
      const { data, error } = await supabase.storage
        .from('grn-invoices')
        .download(grn.invoice_document_url);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = grn.invoice_document_url.split('/').pop() || 'invoice';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e.message || 'Download failed');
    } finally {
      setInvoiceLoading(false);
    }
  };

  if (!grn) return null;

  const handleApprove = () => {
    setShowBinAllocation(true);
  };

  const handleBinAllocationConfirm = async (
    allocations: BinAllocation[],
    itemLinks: Record<string, string>,
  ) => {
    await approveGrn.mutateAsync({
      id: grn.id,
      binAllocations: allocations.map((a) => ({
        warehouse_item_id: a.warehouse_item_id,
        bin_id: a.bin_id,
        location_id: a.location_id,
        quantity: a.quantity,
      })),
      itemLinks,
    });
    setShowBinAllocation(false);
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
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
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
                  <div className="flex items-center gap-2 pt-1">
                    <strong>Invoice Document:</strong>
                    {grn.invoice_document_url ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleViewInvoice}
                          disabled={invoiceLoading}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          View
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleDownloadInvoice}
                          disabled={invoiceLoading}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Download
                        </Button>
                      </>
                    ) : (
                      <span className="text-muted-foreground">No invoice attached</span>
                    )}
                  </div>
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

            {grn.status === 'rejected' && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
                <h3 className="font-semibold text-destructive mb-2">Rejection</h3>
                <div className="space-y-1 text-sm">
                  <p>
                    <strong>Reason:</strong>{' '}
                    {(grn as any).rejection_reason
                      ? GRN_REJECTION_REASON_LABELS[
                          (grn as any).rejection_reason as GrnRejectionReason
                        ] ?? (grn as any).rejection_reason
                      : '—'}
                  </p>
                  {(grn as any).rejection_notes && (
                    <p><strong>Notes:</strong> {(grn as any).rejection_notes}</p>
                  )}
                  {(grn as any).rejected_date && (
                    <p>
                      <strong>Rejected On:</strong>{' '}
                      {format(new Date((grn as any).rejected_date), 'PPpp')}
                    </p>
                  )}
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => reopenGrn.mutate(grn.id)}
                    disabled={reopenGrn.isPending}
                  >
                    {reopenGrn.isPending ? 'Reopening…' : 'Reopen as Draft'}
                  </Button>
                </div>
              </div>
            )}
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
                  {grn.grn_items?.some((i: any) => i.batch_number) && (
                    <>
                      <TableHead>Batch #</TableHead>
                      <TableHead>Mfg Date</TableHead>
                      <TableHead>Expiry</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {grn.grn_items?.map((item: any) => {
                  const fallbackName = item.catalog?.name;
                  const fallbackCode = item.catalog?.item_code;
                  return (
                  <TableRow key={item.id}>
                    <TableCell>{item.item_name || fallbackName || '-'}</TableCell>
                    <TableCell>{item.item_code || fallbackCode || '-'}</TableCell>
                    <TableCell>{item.unit_of_measure || '-'}</TableCell>
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
                    {grn.grn_items?.some((i: any) => i.batch_number) && (
                      <>
                        <TableCell>{item.batch_number || '-'}</TableCell>
                        <TableCell>{item.manufacturing_date ? format(new Date(item.manufacturing_date), 'PP') : '-'}</TableCell>
                        <TableCell>{item.expiry_date ? format(new Date(item.expiry_date), 'PP') : '-'}</TableCell>
                      </>
                    )}
                  </TableRow>
                  );
                })}
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
              <>
                <Button variant="destructive" onClick={() => setShowReject(true)}>
                  Reject GRN
                </Button>
                <Button onClick={handleApprove}>
                  Approve GRN
                </Button>
              </>
            )}
          </div>
        </div>
          </>
        )}
      </DialogContent>

      <GrnBinAllocationDialog
        open={showBinAllocation}
        onOpenChange={setShowBinAllocation}
        items={grn.grn_items || []}
        companyId={grn.company_id}
        onConfirm={handleBinAllocationConfirm}
        isLoading={approveGrn.isPending}
      />

      <RejectGrnDialog
        open={showReject}
        onOpenChange={setShowReject}
        grnNumber={grn.grn_number}
        isLoading={rejectGrn.isPending}
        onConfirm={async (reason, notes) => {
          await rejectGrn.mutateAsync({ id: grn.id, reason, notes });
          setShowReject(false);
        }}
      />
    </Dialog>
  );
}
