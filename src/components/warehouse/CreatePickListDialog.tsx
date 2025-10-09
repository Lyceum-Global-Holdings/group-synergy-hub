import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePickPack } from '@/hooks/usePickPack';
import { useUsers } from '@/hooks/useUsers';

interface CreatePickListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesOrderId?: string;
  onPickListCreated?: (pickListId: string) => void;
}

export function CreatePickListDialog({
  open,
  onOpenChange,
  salesOrderId,
  onPickListCreated
}: CreatePickListDialogProps) {
  const { createPickListWithItems, isCreatingPickList } = usePickPack();
  const { data: users } = useUsers();
  const [formData, setFormData] = useState({
    sales_order_id: salesOrderId || '',
    picker_id: '',
    pick_zone: '',
    priority: 'medium' as const,
    estimated_pick_time: '',
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.sales_order_id) {
      return;
    }

    const submitData = {
      sales_order_id: formData.sales_order_id,
      picker_id: formData.picker_id || undefined,
      pick_zone: formData.pick_zone || undefined,
      priority: formData.priority,
      estimated_pick_time: formData.estimated_pick_time ? parseInt(formData.estimated_pick_time) : undefined,
      notes: formData.notes || undefined,
    };

    createPickListWithItems(submitData, {
      onSuccess: (pickList) => {
        onOpenChange(false);
        onPickListCreated?.(pickList.id);
        setFormData({
          sales_order_id: salesOrderId || '',
          picker_id: '',
          pick_zone: '',
          priority: 'medium',
          estimated_pick_time: '',
          notes: ''
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Pick List</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="picker_id">Assign Picker</Label>
              <Select value={formData.picker_id} onValueChange={(value) => setFormData(prev => ({ ...prev, picker_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select picker..." />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pick_zone">Pick Zone</Label>
              <Input
                id="pick_zone"
                value={formData.pick_zone}
                onChange={(e) => setFormData(prev => ({ ...prev, pick_zone: e.target.value }))}
                placeholder="e.g., Zone A, Aisle 1-5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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

            <div className="space-y-2">
              <Label htmlFor="estimated_pick_time">Est. Pick Time (minutes)</Label>
              <Input
                id="estimated_pick_time"
                type="number"
                value={formData.estimated_pick_time}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_pick_time: e.target.value }))}
                placeholder="30"
                min="1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any special picking instructions..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreatingPickList}>
              {isCreatingPickList ? "Creating..." : "Create Pick List"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}