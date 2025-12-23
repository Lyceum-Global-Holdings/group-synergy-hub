import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useItemUnits } from '@/hooks/useItemUnits';
import { ItemUnit } from '@/types/itemBin';

interface CreateUnitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingUnit?: ItemUnit | null;
}

export function CreateUnitDialog({ open, onOpenChange, editingUnit }: CreateUnitDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    abbreviation: '',
    description: ''
  });

  const { createUnit, updateUnit, isCreating, isUpdating } = useItemUnits();

  useEffect(() => {
    if (editingUnit) {
      setFormData({
        name: editingUnit.name,
        abbreviation: editingUnit.abbreviation,
        description: editingUnit.description || ''
      });
    } else {
      setFormData({
        name: '',
        abbreviation: '',
        description: ''
      });
    }
  }, [editingUnit, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const unitData = {
      name: formData.name,
      abbreviation: formData.abbreviation,
      description: formData.description || null
    };

    if (editingUnit) {
      updateUnit({ id: editingUnit.id, ...unitData });
    } else {
      createUnit(unitData);
    }
    
    onOpenChange(false);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingUnit ? 'Edit Unit' : 'Create New Unit'}
          </DialogTitle>
          <DialogDescription>
            {editingUnit ? 'Update unit information' : 'Add a new unit of measure for inventory items'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Unit Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., Pieces"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="abbreviation">Abbreviation *</Label>
              <Input
                id="abbreviation"
                value={formData.abbreviation}
                onChange={(e) => handleChange('abbreviation', e.target.value)}
                placeholder="e.g., pcs"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe this unit of measure"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || isUpdating}>
              {editingUnit ? 'Update Unit' : 'Create Unit'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}