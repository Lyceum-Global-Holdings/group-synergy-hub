import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Calendar, User, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface ViewRelatedOrdersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finishedGoodId: string;
  productName: string;
}

export function ViewRelatedOrdersDialog({ 
  open, 
  onOpenChange, 
  finishedGoodId,
  productName 
}: ViewRelatedOrdersDialogProps) {
  const navigate = useNavigate();

  const { data: relatedOrders, isLoading } = useQuery({
    queryKey: ['related-orders', finishedGoodId],
    queryFn: async () => {
      // Get sales order items for this finished good
      const { data: items, error: itemsError } = await supabase
        .from('sales_order_items')
        .select(`
          *,
          sales_orders (
            id,
            order_number,
            status,
            required_date,
            priority,
            customer:customers (
              customer_name
            )
          )
        `)
        .eq('finished_good_id', finishedGoodId);

      if (itemsError) throw itemsError;

      // Filter for orders that are still pending fulfillment
      const pendingItems = items?.filter(item => 
        (item.quantity_ordered - (item.quantity_picked || 0)) > 0 &&
        ['confirmed', 'picking', 'picked', 'packing', 'packed'].includes(item.sales_orders?.status)
      ) || [];

      return pendingItems;
    },
    enabled: open
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }> = {
      confirmed: { variant: 'default', label: 'Confirmed' },
      picking: { variant: 'secondary', label: 'Picking' },
      picked: { variant: 'default', label: 'Picked' },
      packing: { variant: 'secondary', label: 'Packing' },
      packed: { variant: 'default', label: 'Packed' }
    };

    const config = statusConfig[status] || { variant: 'default', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }> = {
      low: { variant: 'outline', label: 'Low' },
      medium: { variant: 'secondary', label: 'Medium' },
      high: { variant: 'default', label: 'High' },
      urgent: { variant: 'destructive', label: 'Urgent' }
    };

    const config = priorityConfig[priority] || { variant: 'default', label: priority };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleGoToFulfillment = () => {
    onOpenChange(false);
    navigate('/warehouse/pick-pack');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Sales Orders for {productName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : relatedOrders && relatedOrders.length > 0 ? (
            <>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Total Pending Orders</p>
                  <p className="text-2xl font-bold">{relatedOrders.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Demand</p>
                  <p className="text-2xl font-bold">
                    {relatedOrders.reduce((sum, item) => 
                      sum + (item.quantity_ordered - (item.quantity_picked || 0)), 0
                    )}
                  </p>
                </div>
                <Button onClick={handleGoToFulfillment}>
                  Go to Fulfillment
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Qty Ordered</TableHead>
                    <TableHead>Qty Picked</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Required Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relatedOrders.map((item: any) => {
                    const remaining = item.quantity_ordered - (item.quantity_picked || 0);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.sales_orders?.order_number}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {item.sales_orders?.customer?.customer_name}
                          </div>
                        </TableCell>
                        <TableCell>{item.quantity_ordered}</TableCell>
                        <TableCell>{item.quantity_picked || 0}</TableCell>
                        <TableCell>
                          <Badge variant={remaining > 0 ? 'destructive' : 'default'}>
                            {remaining}
                          </Badge>
                        </TableCell>
                        <TableCell>{getPriorityBadge(item.sales_orders?.priority)}</TableCell>
                        <TableCell>{getStatusBadge(item.sales_orders?.status)}</TableCell>
                        <TableCell>
                          {item.sales_orders?.required_date ? (
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {format(new Date(item.sales_orders.required_date), 'MMM dd, yyyy')}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>
          ) : (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Pending Orders</h3>
              <p className="text-muted-foreground">
                This product has no pending sales orders at the moment
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
