import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePickPack } from '@/hooks/usePickPack';
import { format } from 'date-fns';

interface CreateSalesOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cpoId?: string;
  customerId?: string;
}

export function CreateSalesOrderDialog({
  open,
  onOpenChange,
  cpoId,
  customerId
}: CreateSalesOrderDialogProps) {
  const { createSalesOrder, isCreatingSalesOrder } = usePickPack();
  const [formData, setFormData] = useState({
    cpo_id: cpoId || '',
    customer_id: customerId || '',
    required_date: '',
    priority: 'medium' as const,
    delivery_address: '',
    special_instructions: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    createSalesOrder(formData, {
      onSuccess: () => {
        onOpenChange(false);
        setFormData({
          cpo_id: '',
          customer_id: '',
          required_date: '',
          priority: 'medium',
          delivery_address: '',
          special_instructions: ''
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Sales Order</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="required_date">Required Date</Label>
              <Input
                id="required_date"
                type="date"
                value={formData.required_date}
                onChange={(e) => setFormData(prev => ({ ...prev, required_date: e.target.value }))}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as any }))}>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery_address">Delivery Address</Label>
            <Textarea
              id="delivery_address"
              value={formData.delivery_address}
              onChange={(e) => setFormData(prev => ({ ...prev, delivery_address: e.target.value }))}
              placeholder="Enter delivery address..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="special_instructions">Special Instructions</Label>
            <Textarea
              id="special_instructions"
              value={formData.special_instructions}
              onChange={(e) => setFormData(prev => ({ ...prev, special_instructions: e.target.value }))}
              placeholder="Enter special instructions..."
              rows={2}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreatingSalesOrder}>
              {isCreatingSalesOrder ? "Creating..." : "Create Sales Order"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}