import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import { FileText, Eye, Download, Building2, User, CalendarDays, Receipt, Package, Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GrnDocument } from './GrnDocument';
import { GrnBinAllocationDialog, BinAllocation } from './GrnBinAllocationDialog';
import { RejectGrnDialog } from './RejectGrnDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const statusBadge: Record<GrnStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const statusLabels: Record<GrnStatus, string> = {
  draft: 'Draft',
  submitted: 'Pending Approval',
  approved: 'Approved',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

const lkr = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'LKR' }).format(n || 0);

interface GrnDetailsDialogProps {
  grnId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditDraft?: (grn: any) => void;
}

// Small labelled info cell.
function Info({ icon: Icon, label, children }: { icon?: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{children}</p>
      </div>
    </div>
  );
}

export function GrnDetailsDialog({ grnId, open, onOpenChange, onEditDraft }: GrnDetailsDialogProps) {
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

  const items: any[] = grn.grn_items || [];
  const hasBatch = items.some((i) => i.batch_number);
  const totalReceived = items.reduce((s, i) => s + (Number(i.quantity_received) || 0), 0);
  const grandTotal = items.reduce((s, i) => s + (Number(i.total_cost) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden max-h-[92vh] flex flex-col">
        {showDocument ? (
          <div className="overflow-y-auto p-6">
            <GrnDocument grn={grn} onClose={() => setShowDocument(false)} />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b shrink-0">
              <div className="flex items-start justify-between gap-3 pr-8">
                <div className="min-w-0">
                  <DialogTitle className="text-xl font-semibold font-mono">{grn.grn_number}</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Goods Receipt Note · {format(new Date(grn.grn_date), 'dd MMM yyyy')}
                    {grn.supplier_name ? ` · ${grn.supplier_name}` : ''}
                  </p>
                </div>
                <Badge className={cn('shrink-0 border-0', statusBadge[grn.status])}>
                  {statusLabels[grn.status]}
                </Badge>
              </div>

              {/* KPI strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Total value</p>
                  <p className="text-lg font-bold">{lkr(grn.total_value || 0)}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Line items</p>
                  <p className="text-lg font-bold">{items.length}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Qty received</p>
                  <p className="text-lg font-bold">{totalReceived.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">PO number</p>
                  <p className="text-lg font-bold truncate">{grn.po_number || '—'}</p>
                </div>
              </div>
            </div>

            <Tabs defaultValue="details" className="flex-1 min-h-0 flex flex-col">
              <TabsList className="grid grid-cols-2 mx-6 mt-3 shrink-0">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="items">Items ({items.length})</TabsTrigger>
              </TabsList>

              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                <TabsContent value="details" className="mt-0 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* GRN info */}
                    <div className="rounded-lg border p-4 space-y-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2"><Receipt className="h-4 w-4" /> GRN information</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <Info icon={CalendarDays} label="GRN date">{format(new Date(grn.grn_date), 'dd MMM yyyy')}</Info>
                        <Info label="PO number">{grn.po_number || 'N/A'}</Info>
                        <Info label="Invoice number">{grn.invoice_number || 'N/A'}</Info>
                        {grn.invoice_date && <Info label="Invoice date">{format(new Date(grn.invoice_date), 'dd MMM yyyy')}</Info>}
                      </div>
                      <div className="pt-1">
                        <p className="text-xs text-muted-foreground mb-1">Invoice document</p>
                        {grn.invoice_document_url ? (
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={handleViewInvoice} disabled={invoiceLoading}>
                              <Eye className="h-3.5 w-3.5 mr-1" /> View
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={handleDownloadInvoice} disabled={invoiceLoading}>
                              <Download className="h-3.5 w-3.5 mr-1" /> Download
                            </Button>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No invoice attached</span>
                        )}
                      </div>
                    </div>

                    {/* Supplier */}
                    <div className="rounded-lg border p-4 space-y-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" /> Supplier</h3>
                      <Info label="Name">{grn.supplier_name || 'N/A'}</Info>
                      <Info label="Address">{grn.supplier_address || 'N/A'}</Info>
                    </div>

                    {/* Personnel */}
                    <div className="rounded-lg border p-4 space-y-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4" /> Personnel</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <Info label="Received by">{grn.received_by_profile?.full_name || 'N/A'}</Info>
                        <Info label="Created by">{grn.created_by_profile?.full_name || 'N/A'}</Info>
                        {grn.approved_by_profile && <Info label="Approved by">{grn.approved_by_profile.full_name}</Info>}
                        {grn.approved_date && <Info label="Approved date">{format(new Date(grn.approved_date), 'dd MMM yyyy')}</Info>}
                      </div>
                    </div>

                    {/* Financial */}
                    <div className="rounded-lg border p-4 space-y-1.5 bg-muted/30">
                      <h3 className="text-sm font-semibold flex items-center gap-2 mb-1"><Package className="h-4 w-4" /> Financial summary</h3>
                      {(() => {
                        const lineDisc = items.reduce((s, i) => s + (Number(i.line_discount_amount) || 0), 0);
                        const subtotal = Number(grn.subtotal_value) || (grandTotal + lineDisc + (Number(grn.discount_amount) || 0));
                        return (
                          <>
                            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{lkr(subtotal)}</span></div>
                            {lineDisc > 0 && <div className="flex justify-between text-sm text-muted-foreground"><span>Line discounts</span><span>−{lkr(lineDisc)}</span></div>}
                            {Number(grn.discount_amount) > 0 && (
                              <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Overall discount{grn.discount_type === 'percent' ? ` (${grn.discount_value}%)` : ''}</span>
                                <span>−{lkr(Number(grn.discount_amount))}</span>
                              </div>
                            )}
                            <div className="flex items-end justify-between border-t pt-1.5 mt-1">
                              <span className="text-sm font-medium">Net total</span>
                              <span className="text-2xl font-bold">{lkr(grn.total_value || 0)}</span>
                            </div>
                          </>
                        );
                      })()}
                      <p className="text-xs text-muted-foreground pt-1">{items.length} item(s) · {totalReceived.toLocaleString()} units received</p>
                    </div>
                  </div>

                  {/* Remarks */}
                  <div className="rounded-lg border p-4">
                    <h3 className="text-sm font-semibold mb-1">Remarks</h3>
                    <p className="text-sm text-muted-foreground">{grn.remarks || 'No remarks added'}</p>
                  </div>

                  {grn.status === 'rejected' && (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                      <h3 className="font-semibold text-destructive mb-2">Rejection</h3>
                      <div className="space-y-1 text-sm">
                        <p><strong>Reason:</strong>{' '}
                          {(grn as any).rejection_reason
                            ? GRN_REJECTION_REASON_LABELS[(grn as any).rejection_reason as GrnRejectionReason] ?? (grn as any).rejection_reason
                            : '—'}
                        </p>
                        {(grn as any).rejection_notes && <p><strong>Notes:</strong> {(grn as any).rejection_notes}</p>}
                        {(grn as any).rejected_date && <p><strong>Rejected on:</strong> {format(new Date((grn as any).rejected_date), 'PPpp')}</p>}
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button type="button" size="sm" variant="outline" onClick={() => reopenGrn.mutate(grn.id)} disabled={reopenGrn.isPending}>
                          {reopenGrn.isPending ? 'Reopening…' : 'Reopen as Draft'}
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="items" className="mt-0">
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0">
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>UOM</TableHead>
                          <TableHead className="text-right">Ordered</TableHead>
                          <TableHead className="text-right">Received</TableHead>
                          <TableHead className="text-right">Unit price</TableHead>
                          <TableHead className="text-right">Disc.</TableHead>
                          <TableHead className="text-right">Net total</TableHead>
                          <TableHead>Quality</TableHead>
                          {hasBatch && <><TableHead>Batch #</TableHead><TableHead>Mfg</TableHead><TableHead>Expiry</TableHead></>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item: any) => {
                          const name = item.item_name || item.catalog?.name || '-';
                          const code = item.item_code || item.catalog?.item_code || '-';
                          return (
                            <TableRow key={item.id} className="hover:bg-muted/30">
                              <TableCell>
                                <p className="font-medium leading-tight">{name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{code}</p>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{item.unit_of_measure || '-'}</TableCell>
                              <TableCell className="text-right">{item.quantity_ordered || '-'}</TableCell>
                              <TableCell className="text-right font-medium">{item.quantity_received}</TableCell>
                              <TableCell className="text-right">{Number(item.unit_price).toFixed(2)}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{Number(item.line_discount_amount || 0) > 0 ? `−${Number(item.line_discount_amount).toFixed(2)}` : '—'}</TableCell>
                              <TableCell className="text-right font-medium">{Number(item.total_cost).toFixed(2)}</TableCell>
                              <TableCell>
                                <Badge variant={item.quality_status === 'good' ? 'default' : item.quality_status === 'damaged' ? 'secondary' : 'destructive'} className="capitalize">
                                  {item.quality_status}
                                </Badge>
                              </TableCell>
                              {hasBatch && (
                                <>
                                  <TableCell className="font-mono text-xs">{item.batch_number || '-'}</TableCell>
                                  <TableCell className="text-xs">{item.manufacturing_date ? format(new Date(item.manufacturing_date), 'dd MMM yy') : '-'}</TableCell>
                                  <TableCell className="text-xs">{item.expiry_date ? format(new Date(item.expiry_date), 'dd MMM yy') : '-'}</TableCell>
                                </>
                              )}
                            </TableRow>
                          );
                        })}
                        {items.length === 0 && (
                          <TableRow><TableCell colSpan={hasBatch ? 11 : 8} className="text-center text-muted-foreground py-8">No items.</TableCell></TableRow>
                        )}
                      </TableBody>
                      {items.length > 0 && (
                        <tfoot>
                          <TableRow className="bg-muted/40 font-medium">
                            <TableCell className="flex items-center gap-2"><Boxes className="h-4 w-4 text-muted-foreground" /> Total</TableCell>
                            <TableCell />
                            <TableCell />
                            <TableCell className="text-right">{totalReceived.toLocaleString()}</TableCell>
                            <TableCell />
                            <TableCell />
                            <TableCell className="text-right">{grandTotal.toFixed(2)}</TableCell>
                            <TableCell colSpan={hasBatch ? 4 : 1} />
                          </TableRow>
                        </tfoot>
                      )}
                    </Table>
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            {/* Footer actions */}
            <div className="flex items-center justify-between gap-2 border-t px-6 py-4 shrink-0">
              <Button variant="outline" onClick={() => setShowDocument(true)}>
                <FileText className="h-4 w-4 mr-2" /> Generate Document
              </Button>
              <div className="flex gap-2">
                {grn.status === 'draft' && (
                  <>
                    <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                    {onEditDraft && (
                      <Button variant="secondary" onClick={() => { onEditDraft(grn); onOpenChange(false); }}>Edit Draft</Button>
                    )}
                    <Button onClick={handleSubmit}>Submit for Approval</Button>
                  </>
                )}
                {grn.status === 'submitted' && isAdmin && (
                  <>
                    <Button variant="destructive" onClick={() => setShowReject(true)}>Reject GRN</Button>
                    <Button onClick={handleApprove}>Approve GRN</Button>
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
