import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Printer, Download } from "lucide-react";
import { format } from "date-fns";

interface DeliveryNoteDocumentProps {
  issueId: string;
  issueDetails: any;
  issueItems: any[];
}

export function DeliveryNoteDocument({ issueId, issueDetails, issueItems }: DeliveryNoteDocumentProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  return (
    <div className="delivery-note-document">
      {/* Print buttons - hidden when printing */}
      <div className="print:hidden flex gap-2 mb-4">
        <Button onClick={handlePrint} className="flex-1">
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
        <Button onClick={handleDownloadPDF} variant="outline" className="flex-1">
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </div>

      {/* Document content - styled for printing */}
      <div className="bg-background p-8 print:p-0">
        <Card className="print:shadow-none print:border-0">
          <CardHeader className="text-center space-y-4">
            <div>
              <h1 className="text-3xl font-bold">DELIVERY NOTE</h1>
              <p className="text-muted-foreground mt-2">Goods Issue Document</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-left text-sm">
              <div>
                <p className="font-semibold">Issue Number:</p>
                <p className="text-lg">{issueDetails?.issue_number}</p>
              </div>
              <div>
                <p className="font-semibold">Issue Date:</p>
                <p>{issueDetails?.issue_date ? format(new Date(issueDetails.issue_date), 'PPP') : 'N/A'}</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Customer & Order Information */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm uppercase text-muted-foreground">Customer Details</h3>
                <div className="space-y-1">
                  <p className="font-medium">{issueDetails?.sales_orders?.customers?.customer_name || 'N/A'}</p>
                  <p className="text-sm text-muted-foreground">
                    {issueDetails?.sales_orders?.customers?.email || ''}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {issueDetails?.sales_orders?.customers?.phone || ''}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-sm uppercase text-muted-foreground">Sales Order</h3>
                <div className="space-y-1">
                  <p className="font-medium">{issueDetails?.sales_orders?.order_number || 'N/A'}</p>
                  <p className="text-sm text-muted-foreground">
                    Order Date: {issueDetails?.sales_orders?.order_date 
                      ? format(new Date(issueDetails.sales_orders.order_date), 'PP') 
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Delivery Address */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground">Delivery Address</h3>
              <p className="text-sm">{issueDetails?.sales_orders?.delivery_address || 'N/A'}</p>
            </div>

            <Separator />

            {/* Items Table */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground">Items Issued</h3>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Product Code</TableHead>
                      <TableHead className="text-center">Quantity</TableHead>
                      <TableHead>Batch Number</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issueItems?.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">
                          {item.finished_good?.product_name || 'N/A'}
                        </TableCell>
                        <TableCell>{item.finished_good?.product_code || 'N/A'}</TableCell>
                        <TableCell className="text-center">{item.quantity_issued}</TableCell>
                        <TableCell>{item.batch_number || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Notes */}
            {issueDetails?.notes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm uppercase text-muted-foreground">Notes</h3>
                  <p className="text-sm whitespace-pre-wrap">{issueDetails.notes}</p>
                </div>
              </>
            )}

            {/* Acceptance Information */}
            {issueDetails?.accepted_at && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm uppercase text-muted-foreground">Acceptance Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Accepted Date:</p>
                      <p className="font-medium">
                        {format(new Date(issueDetails.accepted_at), 'PPP p')}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Vehicle & Driver Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground">Transport Details</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Vehicle Number:</p>
                  <div className="border-b border-dashed border-muted-foreground/40 py-2">
                    <span className="text-sm">_________________________________</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Driver Name:</p>
                  <div className="border-b border-dashed border-muted-foreground/40 py-2">
                    <span className="text-sm">_________________________________</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Signature Section */}
            <div className="grid grid-cols-3 gap-6 pt-8">
              <div className="space-y-2">
                <div className="border-b border-muted-foreground/40 pb-2 mb-2 h-16"></div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Issued By</p>
                  <p className="text-xs text-muted-foreground">Name & Signature</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="border-b border-muted-foreground/40 pb-2 mb-2 h-16"></div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Delivered By</p>
                  <p className="text-xs text-muted-foreground">Driver Signature</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="border-b border-muted-foreground/40 pb-2 mb-2 h-16"></div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Received By</p>
                  <p className="text-xs text-muted-foreground">Customer Signature & Date</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <Separator />
            <div className="text-center text-xs text-muted-foreground pt-4">
              <p>This is a computer-generated delivery note.</p>
              <p className="mt-1">Please verify all items upon receipt and report any discrepancies immediately.</p>
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
          .delivery-note-document,
          .delivery-note-document * {
            visibility: visible;
          }
          .delivery-note-document {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            size: A4;
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  );
}
