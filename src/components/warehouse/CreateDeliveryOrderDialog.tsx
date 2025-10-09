import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDeliveryOrders } from '@/hooks/useDeliveryOrders';
import { usePickPack } from '@/hooks/usePickPack';
import { useCompany } from '@/contexts/CompanyContext';
import { CreateDeliveryOrderItemData } from '@/types/pickPack';
import { Truck } from 'lucide-react';

interface CreateDeliveryOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesOrderId?: string;
}

export function CreateDeliveryOrderDialog({
  open,
  onOpenChange,
  salesOrderId,
}: CreateDeliveryOrderDialogProps) {
  const { selectedCompany } = useCompany();
  const { createDeliveryOrderWithItems, isCreatingDeliveryOrder } = useDeliveryOrders();
  const { useSalesOrders } = usePickPack();
  
  // Fetch sales order with items
  const { data: salesOrders } = useSalesOrders();
  const salesOrder = salesOrders?.find(so => so.id === salesOrderId);
  
  // Fetch sales order items separately
  const { data: salesOrderItems } = useQuery({
    queryKey: ['sales-order-items', salesOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_order_items')
        .select(`
          *,
          finished_good:finished_goods(id, product_name, product_code)
        `)
        .eq('sales_order_id', salesOrderId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!salesOrderId,
  });

  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryContact, setDeliveryContact] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState<'morning' | 'afternoon' | 'evening'>('morning');
  const [vehicleType, setVehicleType] = useState<'truck' | 'van' | 'motorcycle' | 'courier'>('van');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');

  useEffect(() => {
    if (salesOrder) {
      setDeliveryAddress(salesOrder.delivery_address || '');
      setPriority(salesOrder.priority);
    }
  }, [salesOrder]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!salesOrderId || !salesOrder) {
      return;
    }

    // Create items from sales order items with picked quantities
    const items: CreateDeliveryOrderItemData[] = (salesOrderItems || [])
      .filter(item => item.quantity_picked > 0)
      .map(item => ({
        sales_order_item_id: item.id,
        finished_good_id: item.finished_good_id || '',
        quantity_ordered: item.quantity_ordered,
        quantity_to_deliver: item.quantity_picked,
        item_condition: 'good' as const,
        quality_checked: false,
      }));

    if (items.length === 0) {
      return;
    }

    createDeliveryOrderWithItems({
      deliveryOrderData: {
        sales_order_id: salesOrderId,
        customer_id: salesOrder.customer_id,
        delivery_address: deliveryAddress,
        delivery_contact: deliveryContact || undefined,
        delivery_phone: deliveryPhone || undefined,
        delivery_date: deliveryDate,
        delivery_time_slot: deliveryTimeSlot,
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber || undefined,
        driver_name: driverName || undefined,
        driver_phone: driverPhone || undefined,
        priority,
        special_instructions: specialInstructions || undefined,
        delivery_instructions: deliveryInstructions || undefined,
        company_id: selectedCompany?.id,
      },
      items,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        resetForm();
      },
    });
  };

  const resetForm = () => {
    setDeliveryDate(new Date().toISOString().split('T')[0]);
    setDeliveryAddress('');
    setDeliveryContact('');
    setDeliveryPhone('');
    setDeliveryTimeSlot('morning');
    setVehicleType('van');
    setVehicleNumber('');
    setDriverName('');
    setDriverPhone('');
    setPriority('medium');
    setSpecialInstructions('');
    setDeliveryInstructions('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Create Delivery Order
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Order Info */}
          <div className="space-y-2">
            <h3 className="font-semibold">Order Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sales Order</Label>
                <Input value={salesOrder?.order_number || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label>Customer</Label>
                <Input value={salesOrder?.customer?.customer_name || ''} disabled />
              </div>
            </div>
          </div>

          {/* Delivery Details */}
          <div className="space-y-2">
            <h3 className="font-semibold">Delivery Details</h3>
            <div className="space-y-2">
              <Label htmlFor="deliveryAddress">Delivery Address *</Label>
              <Textarea
                id="deliveryAddress"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                required
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deliveryContact">Contact Person</Label>
                <Input
                  id="deliveryContact"
                  value={deliveryContact}
                  onChange={(e) => setDeliveryContact(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryPhone">Contact Phone</Label>
                <Input
                  id="deliveryPhone"
                  value={deliveryPhone}
                  onChange={(e) => setDeliveryPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deliveryDate">Delivery Date *</Label>
                <Input
                  id="deliveryDate"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryTimeSlot">Time Slot</Label>
                <Select value={deliveryTimeSlot} onValueChange={(val: any) => setDeliveryTimeSlot(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning (8AM-12PM)</SelectItem>
                    <SelectItem value="afternoon">Afternoon (12PM-5PM)</SelectItem>
                    <SelectItem value="evening">Evening (5PM-8PM)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Logistics */}
          <div className="space-y-2">
            <h3 className="font-semibold">Logistics Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicleType">Vehicle Type</Label>
                <Select value={vehicleType} onValueChange={(val: any) => setVehicleType(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="truck">Truck</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                    <SelectItem value="motorcycle">Motorcycle</SelectItem>
                    <SelectItem value="courier">Courier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicleNumber">Vehicle Number</Label>
                <Input
                  id="vehicleNumber"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  placeholder="ABC-1234"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="driverName">Driver Name</Label>
                <Input
                  id="driverName"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driverPhone">Driver Phone</Label>
                <Input
                  id="driverPhone"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Priority & Instructions */}
          <div className="space-y-2">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialInstructions">Special Instructions</Label>
              <Textarea
                id="specialInstructions"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryInstructions">Delivery Instructions</Label>
              <Textarea
                id="deliveryInstructions"
                value={deliveryInstructions}
                onChange={(e) => setDeliveryInstructions(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* Items Preview */}
          <div className="space-y-2">
            <h3 className="font-semibold">Items to Deliver</h3>
            <div className="text-sm text-muted-foreground">
              {salesOrderItems?.filter(item => item.quantity_picked > 0).length || 0} items ready for delivery
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreatingDeliveryOrder}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreatingDeliveryOrder}>
              {isCreatingDeliveryOrder ? 'Creating...' : 'Create Delivery Order'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}