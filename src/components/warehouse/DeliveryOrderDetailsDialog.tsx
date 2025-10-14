import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDeliveryOrders } from '@/hooks/useDeliveryOrders';
import { Truck, User, MapPin, Calendar, Package, Phone, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';

interface DeliveryOrderDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryOrderId?: string;
}

export function DeliveryOrderDetailsDialog({
  open,
  onOpenChange,
  deliveryOrderId,
}: DeliveryOrderDetailsDialogProps) {
  const { 
    useDeliveryOrder, 
    updateDeliveryOrderStatus, 
    isUpdatingStatus,
    cancelDeliveryOrder,
    isCancelling
  } = useDeliveryOrders();
  const { data: deliveryOrder } = useDeliveryOrder(deliveryOrderId || '');

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { variant: 'secondary' as const, label: 'Draft' },
      approved: { variant: 'default' as const, label: 'Approved' },
      ready_for_dispatch: { variant: 'default' as const, label: 'Ready for Dispatch' },
      dispatched: { variant: 'default' as const, label: 'Dispatched' },
      in_transit: { variant: 'secondary' as const, label: 'In Transit' },
      delivered: { variant: 'default' as const, label: 'Delivered' },
      failed: { variant: 'destructive' as const, label: 'Failed' },
      cancelled: { variant: 'outline' as const, label: 'Cancelled' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { variant: 'default' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      low: { variant: 'outline' as const, label: 'Low' },
      medium: { variant: 'secondary' as const, label: 'Medium' },
      high: { variant: 'default' as const, label: 'High' },
      urgent: { variant: 'destructive' as const, label: 'Urgent' }
    };

    const config = priorityConfig[priority as keyof typeof priorityConfig] || { variant: 'default' as const, label: priority };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleApprove = () => {
    if (deliveryOrderId) {
      updateDeliveryOrderStatus({
        doId: deliveryOrderId,
        status: 'approved',
        notes: 'Approved via details dialog',
      });
    }
  };

  const handleReject = () => {
    if (deliveryOrderId) {
      updateDeliveryOrderStatus({
        doId: deliveryOrderId,
        status: 'cancelled',
        notes: 'Rejected via details dialog',
      });
    }
  };

  const handleCancel = () => {
    if (!deliveryOrderId) return;
    if (window.confirm('Are you sure you want to cancel this delivery order?')) {
      cancelDeliveryOrder({
        doId: deliveryOrderId,
        notes: 'Order cancelled by user'
      });
    }
  };

  if (!deliveryOrder) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Delivery Order: {deliveryOrder.do_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {getStatusBadge(deliveryOrder.status)}
                {getPriorityBadge(deliveryOrder.priority)}
              </div>
              <p className="text-sm text-muted-foreground">
                Created {format(new Date(deliveryOrder.created_at), 'MMM dd, yyyy HH:mm')}
              </p>
            </div>
            {deliveryOrder.status === 'draft' && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleReject}
                  disabled={isUpdatingStatus}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={isUpdatingStatus}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </div>
            )}
            {['approved', 'ready_for_dispatch', 'dispatched'].includes(deliveryOrder.status) && (
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={isCancelling}
              >
                <XCircle className="h-4 w-4 mr-1" />
                {isCancelling ? 'Cancelling...' : 'Cancel Order'}
              </Button>
            )}
          </div>

          <Separator />

          {/* Order Information */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                Order Information
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sales Order:</span>
                  <span className="font-medium">{deliveryOrder.sales_order?.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">{deliveryOrder.customer?.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Packages:</span>
                  <span className="font-medium">{deliveryOrder.total_packages}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Delivery Schedule
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery Date:</span>
                  <span className="font-medium">
                    {format(new Date(deliveryOrder.delivery_date), 'MMM dd, yyyy')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time Slot:</span>
                  <span className="font-medium capitalize">
                    {deliveryOrder.delivery_time_slot || 'Not specified'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Delivery Details */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Delivery Address
            </h3>
            <p className="text-sm">{deliveryOrder.delivery_address}</p>
            {deliveryOrder.delivery_contact && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{deliveryOrder.delivery_contact}</span>
                {deliveryOrder.delivery_phone && (
                  <>
                    <Phone className="h-4 w-4 text-muted-foreground ml-2" />
                    <span>{deliveryOrder.delivery_phone}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Logistics */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Vehicle Information
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vehicle Type:</span>
                  <span className="font-medium capitalize">{deliveryOrder.vehicle_type || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vehicle Number:</span>
                  <span className="font-medium">{deliveryOrder.vehicle_number || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Driver Information
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Driver Name:</span>
                  <span className="font-medium">{deliveryOrder.driver_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Driver Phone:</span>
                  <span className="font-medium">{deliveryOrder.driver_phone || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Items */}
          <div className="space-y-3">
            <h3 className="font-semibold">Delivery Items</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Product Code</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">To Deliver</TableHead>
                  <TableHead>Condition</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveryOrder.items?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.finished_good?.product_name}</TableCell>
                    <TableCell>{item.finished_good?.product_code}</TableCell>
                    <TableCell className="text-right">{item.quantity_ordered}</TableCell>
                    <TableCell className="text-right font-medium">{item.quantity_to_deliver}</TableCell>
                    <TableCell>
                      <Badge variant={item.item_condition === 'good' ? 'default' : 'destructive'}>
                        {item.item_condition}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Instructions */}
          {(deliveryOrder.special_instructions || deliveryOrder.delivery_instructions) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-semibold">Instructions</h3>
                {deliveryOrder.special_instructions && (
                  <div>
                    <p className="text-sm font-medium">Special Instructions:</p>
                    <p className="text-sm text-muted-foreground">{deliveryOrder.special_instructions}</p>
                  </div>
                )}
                {deliveryOrder.delivery_instructions && (
                  <div>
                    <p className="text-sm font-medium">Delivery Instructions:</p>
                    <p className="text-sm text-muted-foreground">{deliveryOrder.delivery_instructions}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}