import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { CustomerPurchaseOrder } from "@/types/customer";

const statusColors = {
  draft: "default",
  confirmed: "secondary",
  in_production: "outline",
  delivered: "default",
  completed: "default",
  cancelled: "destructive"
} as const;

interface CustomerPoDetailsDialogProps {
  cpoId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CustomerPoDetailsDialog({
  cpoId,
  open,
  onOpenChange,
}: CustomerPoDetailsDialogProps) {
  const { data: cpo, isLoading } = useQuery({
    queryKey: ['customer-purchase-order', cpoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_purchase_orders')
        .select(`
          *,
          customer:customers(customer_name, customer_code, contact_person, email, phone),
          items:customer_po_items(*)
        `)
        .eq('id', cpoId)
        .single();
      
      if (error) throw error;
      return data as CustomerPurchaseOrder;
    },
    enabled: !!cpoId,
  });

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">Loading...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!cpo) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Customer PO Details: {cpo.cpo_number}
            <Badge variant={statusColors[cpo.status as keyof typeof statusColors]}>
              {cpo.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            View customer purchase order details and items
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Customer Name</p>
                <p className="font-medium">{cpo.customer?.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Customer Code</p>
                <p className="font-medium">{cpo.customer?.customer_code}</p>
              </div>
              {cpo.customer?.contact_person && (
                <div>
                  <p className="text-sm text-muted-foreground">Contact Person</p>
                  <p className="font-medium">{cpo.customer.contact_person}</p>
                </div>
              )}
              {cpo.customer?.email && (
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{cpo.customer.email}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Information */}
          <Card>
            <CardHeader>
              <CardTitle>Order Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">PO Date</p>
                <p className="font-medium">{new Date(cpo.po_date).toLocaleDateString()}</p>
              </div>
              {cpo.delivery_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Date</p>
                  <p className="font-medium">{new Date(cpo.delivery_date).toLocaleDateString()}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="font-medium text-lg">{formatCurrency(cpo.total_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={statusColors[cpo.status as keyof typeof statusColors]}>
                  {cpo.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              {cpo.notes && (
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="font-medium">{cpo.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
              <CardDescription>
                {cpo.items?.length || 0} item(s) in this order
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cpo.items?.map((item, index) => (
                  <div key={item.id}>
                    {index > 0 && <Separator />}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Item Name</p>
                        <p className="font-medium">{item.item_name}</p>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Quantity</p>
                        <p className="font-medium">{item.quantity_ordered}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Unit Price</p>
                        <p className="font-medium">{formatCurrency(item.unit_price)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="font-medium">{formatCurrency(item.total_price)}</p>
                      </div>
                      {item.delivery_date && (
                        <div className="md:col-span-4">
                          <p className="text-sm text-muted-foreground">Delivery Date</p>
                          <p className="font-medium">{new Date(item.delivery_date).toLocaleDateString()}</p>
                        </div>
                      )}
                      <div className="md:col-span-4">
                        <p className="text-sm text-muted-foreground">Status</p>
                        <Badge variant="outline">
                          {item.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}