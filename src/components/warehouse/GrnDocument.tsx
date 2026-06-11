import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Printer, Download, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { GoodsReceiptNote, GRN_REJECTION_REASON_LABELS } from "@/types/grn";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { downloadGrnPdf } from "@/utils/goodsReceiptPdfExport";
import { useState } from "react";
import { toast } from "sonner";

interface GrnDocumentProps {
  grn: GoodsReceiptNote;
  onClose?: () => void;
}

const qualityStatusColors = {
  good: "bg-green-100 text-green-800",
  damaged: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
};

const qualityStatusLabels = {
  good: "Good",
  damaged: "Damaged",
  rejected: "Rejected",
};

export function GrnDocument({ grn, onClose }: GrnDocumentProps) {
  const { selectedCompany } = useCompany();
  const auth = useAuth() as any;
  const [downloading, setDownloading] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      setDownloading(true);
      await downloadGrnPdf({
        grn,
        company: selectedCompany ?? null,
        generatedByName: auth?.profile?.full_name ?? auth?.user?.email ?? null,
      });
    } catch (e) {
      console.error("[GRN PDF]", e);
      toast.error("Failed to generate GRN PDF");
    } finally {
      setDownloading(false);
    }
  };

  const rejection = grn as unknown as {
    rejection_reason?: string | null;
    rejection_notes?: string | null;
    rejected_date?: string | null;
  };

  return (
    <div className="grn-document">
      {/* Action buttons - hidden when printing */}
      <div className="print:hidden flex gap-2 mb-4">
        {onClose && (
          <Button onClick={onClose} variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Details
          </Button>
        )}
        <Button onClick={handlePrint} className="flex-1">
          <Printer className="h-4 w-4 mr-2" />
          Print GRN
        </Button>
        <Button onClick={handleDownloadPDF} variant="outline" className="flex-1" disabled={downloading}>
          <Download className="h-4 w-4 mr-2" />
          {downloading ? 'Generating…' : 'Download PDF'}
        </Button>
      </div>

      {/* Document content - styled for printing */}
      <div className="bg-background p-8 print:p-0">
        <Card className="print:shadow-none print:border-0">
          <CardHeader className="space-y-4">
            {/* Company header band */}
            <div className="flex items-start justify-between gap-4 pb-3 border-b">
              <div className="flex items-start gap-3">
                {selectedCompany?.logo_url ? (
                  <img
                    src={selectedCompany.logo_url}
                    alt={`${selectedCompany.name} logo`}
                    className="h-14 w-14 object-contain rounded"
                  />
                ) : null}
                <div>
                  <p className="text-lg font-bold leading-tight">
                    {selectedCompany?.name ?? 'Company'}
                  </p>
                  {selectedCompany?.address && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap max-w-xs">
                      {selectedCompany.address}
                    </p>
                  )}
                  {selectedCompany?.code && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Company Code: {selectedCompany.code}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <h1 className="text-2xl font-bold">GOODS RECEIPT NOTE</h1>
                <p className="text-xs text-muted-foreground mt-1">Material Receipt Document</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-left text-sm">
              <div>
                <p className="font-semibold">GRN Number:</p>
                <p className="text-lg">{grn.grn_number}</p>
              </div>
              <div>
                <p className="font-semibold">GRN Date:</p>
                <p>{format(new Date(grn.grn_date), 'PPP')}</p>
              </div>
              <div>
                <p className="font-semibold">Status:</p>
                <Badge variant="outline" className="mt-1">
                  {grn.status.toUpperCase()}
                </Badge>
              </div>
              {grn.po_number && (
                <div>
                  <p className="font-semibold">PO Number:</p>
                  <p>{grn.po_number}</p>
                </div>
              )}
            </div>
          </CardHeader>


          <CardContent className="space-y-6">
            {/* Supplier Information */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground">Supplier Details</h3>
              <div className="space-y-1">
                <p className="font-medium">{grn.supplier_name || grn.purchase_order?.supplier?.name || 'N/A'}</p>
                {grn.supplier_address && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{grn.supplier_address}</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Invoice Information */}
            {(grn.invoice_number || grn.invoice_date) && (
              <>
                <div className="grid grid-cols-2 gap-6">
                  {grn.invoice_number && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm uppercase text-muted-foreground">Invoice Number</h3>
                      <p>{grn.invoice_number}</p>
                    </div>
                  )}
                  {grn.invoice_date && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm uppercase text-muted-foreground">Invoice Date</h3>
                      <p>{format(new Date(grn.invoice_date), 'PPP')}</p>
                    </div>
                  )}
                </div>
                <Separator />
              </>
            )}

            {/* Items Received Table */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground">Items Received</h3>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Item Code</TableHead>
                      <TableHead>UOM</TableHead>
                      <TableHead className="text-right">Qty Ordered</TableHead>
                      <TableHead className="text-right">Qty Received</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                      <TableHead>Quality</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grn.grn_items?.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{item.item_name}</TableCell>
                        <TableCell>{item.item_code || '-'}</TableCell>
                        <TableCell>{item.unit_of_measure}</TableCell>
                        <TableCell className="text-right">{item.quantity_ordered || '-'}</TableCell>
                        <TableCell className="text-right font-medium">{item.quantity_received}</TableCell>
                        <TableCell className="text-right">
                          LKR {item.unit_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          LKR {item.total_cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${qualityStatusColors[item.quality_status]}`}>
                            {qualityStatusLabels[item.quality_status]}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total Items:</span>
                  <span>{grn.grn_items?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Grand Total:</span>
                  <span>LKR {grn.total_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Personnel Information */}
            <div className="grid grid-cols-3 gap-6">
              {grn.created_by_profile && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm uppercase text-muted-foreground">Created By</h3>
                  <p className="font-medium">{grn.created_by_profile.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(grn.created_at), 'PPP p')}
                  </p>
                </div>
              )}
              {grn.received_by_profile && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm uppercase text-muted-foreground">Received By</h3>
                  <p className="font-medium">{grn.received_by_profile.full_name}</p>
                </div>
              )}
              {grn.approved_by_profile && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm uppercase text-muted-foreground">Approved By</h3>
                  <p className="font-medium">{grn.approved_by_profile.full_name}</p>
                  {grn.approved_date && (
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(grn.approved_date), 'PPP p')}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Remarks */}
            {grn.remarks && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm uppercase text-muted-foreground">Remarks</h3>
                  <p className="text-sm whitespace-pre-wrap">{grn.remarks}</p>
                </div>
              </>
            )}

            <Separator />

            {/* Signature Section */}
            <div className="grid grid-cols-3 gap-6 pt-8">
              <div className="space-y-2">
                <div className="border-b border-muted-foreground/40 pb-2 mb-2 h-16"></div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Received By</p>
                  <p className="text-xs text-muted-foreground">Name & Signature</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="border-b border-muted-foreground/40 pb-2 mb-2 h-16"></div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Quality Checked By</p>
                  <p className="text-xs text-muted-foreground">QC Signature</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="border-b border-muted-foreground/40 pb-2 mb-2 h-16"></div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Approved By</p>
                  <p className="text-xs text-muted-foreground">Signature & Date</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <Separator />
            <div className="text-center text-xs text-muted-foreground pt-4">
              <p>This is a computer-generated Goods Receipt Note.</p>
              <p className="mt-1">Generated on {format(new Date(), 'PPP p')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Print-specific styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .grn-document,
          .grn-document * {
            visibility: visible;
          }
          .grn-document {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            size: A4;
            margin: 1.5cm;
          }
          .no-break {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
