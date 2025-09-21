import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMaterialReturns } from '@/hooks/useMaterialReturns';
import { MaterialReturnNote, MaterialReturnType, MaterialReferenceType } from '@/types/materialIssueReturn';

interface MaterialReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingReturn?: MaterialReturnNote | null;
}

export function MaterialReturnDialog({ open, onOpenChange, editingReturn }: MaterialReturnDialogProps) {
  const [formData, setFormData] = useState({
    return_date: new Date().toISOString().split('T')[0],
    returned_by: '',
    return_type: 'internal' as MaterialReturnType,
    reason: '',
    reference_type: '' as MaterialReferenceType | '',
    reference_id: '',
    notes: '',
  });

  const { createMaterialReturn, isCreating } = useMaterialReturns();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.returned_by.trim() || !formData.reason.trim()) {
      return;
    }

    try {
      await createMaterialReturn({
        return_date: formData.return_date,
        returned_by: formData.returned_by.trim(),
        return_type: formData.return_type,
        reason: formData.reason.trim(),
        reference_type: formData.reference_type || undefined,
        reference_id: formData.reference_id.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      });
      
      // Reset form
      setFormData({
        return_date: new Date().toISOString().split('T')[0],
        returned_by: '',
        return_type: 'internal',
        reason: '',
        reference_type: '',
        reference_id: '',
        notes: '',
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating material return:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingReturn ? 'Edit Material Return' : 'Create New Material Return'}
          </DialogTitle>
          <DialogDescription>
            {editingReturn 
              ? 'Update the material return details below.'
              : 'Fill in the details to create a new material return note.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="return_date">Return Date</Label>
              <Input
                id="return_date"
                type="date"
                value={formData.return_date}
                onChange={(e) => handleInputChange('return_date', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="returned_by">Returned By *</Label>
              <Input
                id="returned_by"
                value={formData.returned_by}
                onChange={(e) => handleInputChange('returned_by', e.target.value)}
                placeholder="Person name"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="return_type">Return Type</Label>
              <Select value={formData.return_type} onValueChange={(value: MaterialReturnType) => handleInputChange('return_type', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal Return</SelectItem>
                  <SelectItem value="supplier">Supplier Return</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference_type">Reference Type</Label>
              <Select value={formData.reference_type} onValueChange={(value: MaterialReferenceType) => handleInputChange('reference_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reference" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="material_issue">Material Issue</SelectItem>
                  <SelectItem value="purchase_order">Purchase Order</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference_id">Reference ID</Label>
            <Input
              id="reference_id"
              value={formData.reference_id}
              onChange={(e) => handleInputChange('reference_id', e.target.value)}
              placeholder="MIN/PO number or reference (optional)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Input
              id="reason"
              value={formData.reason}
              onChange={(e) => handleInputChange('reason', e.target.value)}
              placeholder="Reason for return"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Additional notes (optional)"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : editingReturn ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}