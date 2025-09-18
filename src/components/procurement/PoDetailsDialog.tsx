import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PurchaseOrder, PoStatus } from "@/types/purchaseOrder";
import { format } from "date-fns";
import { Send, Package, Edit, FileText } from "lucide-react";
import { useSendPurchaseOrder } from "@/hooks/usePurchaseOrders";

interface PoDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrder;
}

const statusColors: Record<PoStatus, string> = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  acknowledged: "bg-yellow-100 text-yellow-800",
  partially_received: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const statusLabels: Record<PoStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  acknowledged: "Acknowledged",
  partially_received: "Partially Received",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function PoDetailsDialog({ open, onOpenChange, purchaseOrder }: PoDetailsDialogProps) {
  const sendMutation = useSendPurchaseOrder();

  const canSend = purchaseOrder.status === 'draft';
  const canReceive = ['sent', 'acknowledged', 'partially_received'].includes(purchaseOrder.status);

  const handleSend = () => {
    sendMutation.mutate(purchaseOrder.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">Purchase Order Details</DialogTitle>
              <DialogDescription>
                PO Number: {purchaseOrder.po_number}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={statusColors[purchaseOrder.status]}>
                {statusLabels[purchaseOrder.status]}
              </Badge>
              {canSend && (
                <Button size="sm" onClick={handleSend} disabled={sendMutation.isPending}>
                  <Send className="h-4 w-4 mr-2" />
                  Send PO
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* PO Header Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Purchase Order Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">PO Number</p>
                    <p className="font-semibold">{purchaseOrder.po_number}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">PO Date</p>
                    <p>{format(new Date(purchaseOrder.po_date), 'MMM dd, yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Expected Delivery</p>
                    <p>
                      {purchaseOrder.expected_delivery_date 
                        ? format(new Date(purchaseOrder.expected_delivery_date), 'MMM dd, yyyy')
                        : 'Not specified'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Currency</p>
                    <p>{purchaseOrder.currency}</p>
                  </div>
                </div>
                {purchaseOrder.pr && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Source PR</p>
                    <p>{purchaseOrder.pr.pr_number} - {purchaseOrder.pr.title}</p>
                  </div>
                )}
                {purchaseOrder.payment_terms && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Payment Terms</p>
                    <p>{purchaseOrder.payment_terms}</p>
                  </div>
                )}
                {purchaseOrder.delivery_terms && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Delivery Terms</p>
                    <p>{purchaseOrder.delivery_terms}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Supplier Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Supplier Name</p>
                  <p className="font-semibold">{purchaseOrder.supplier?.name}</p>
                </div>
                {purchaseOrder.supplier?.email && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p>{purchaseOrder.supplier.email}</p>
                  </div>
                )}
                {purchaseOrder.supplier?.phone && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Phone</p>
                    <p>{purchaseOrder.supplier.phone}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Created By</p>
                  <p>{purchaseOrder.created_by_profile?.full_name || purchaseOrder.created_by_profile?.email}</p>
                </div>
                {purchaseOrder.buyer_profile && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Buyer</p>
                    <p>{purchaseOrder.buyer_profile.full_name || purchaseOrder.buyer_profile.email}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Financial Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Subtotal</p>
                  <p className="text-lg font-semibold">${purchaseOrder.total_amount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tax</p>
                  <p className="text-lg font-semibold">${purchaseOrder.tax_amount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Discount</p>
                  <p className="text-lg font-semibold">-${purchaseOrder.discount_amount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">${purchaseOrder.final_amount.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Specifications</TableHead>
                    <TableHead>Qty Ordered</TableHead>
                    <TableHead>Qty Received</TableHead>
                    <TableHead>Qty Pending</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total Price</TableHead>
                    <TableHead>UOM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrder.items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.item_name}</TableCell>
                      <TableCell>{item.specifications || '-'}</TableCell>
                      <TableCell>{item.quantity_ordered}</TableCell>
                      <TableCell>{item.quantity_received}</TableCell>
                      <TableCell>{item.quantity_pending}</TableCell>
                      <TableCell>${item.unit_price.toLocaleString()}</TableCell>
                      <TableCell>${item.total_price.toLocaleString()}</TableCell>
                      <TableCell>{item.unit_of_measure}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Delivery History */}
          {purchaseOrder.receipts && purchaseOrder.receipts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Delivery History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {purchaseOrder.receipts.map((receipt) => (
                    <Card key={receipt.id}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{receipt.receipt_number}</p>
                            <p className="text-sm text-muted-foreground">
                              Received on {format(new Date(receipt.received_date), 'MMM dd, yyyy')} 
                              by {receipt.received_by_profile?.full_name}
                            </p>
                            {receipt.notes && (
                              <p className="text-sm mt-2">{receipt.notes}</p>
                            )}
                          </div>
                          <Badge variant={receipt.status === 'complete' ? 'default' : 'secondary'}>
                            {receipt.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {purchaseOrder.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{purchaseOrder.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}