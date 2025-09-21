import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useWarehouseBins } from '@/hooks/useWarehouseBins';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { WarehouseBin } from '@/types/itemBin';

interface CreateBinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingBin?: WarehouseBin | null;
}

export function CreateBinDialog({ open, onOpenChange, editingBin }: CreateBinDialogProps) {
  const [formData, setFormData] = useState({
    bin_code: '',
    name: '',
    description: '',
    capacity: '',
    location_id: '',
    notes: '',
    status: 'active' as 'active' | 'inactive' | 'maintenance' | 'full'
  });

  const { createBin, updateBin, isCreating, isUpdating } = useWarehouseBins();
  const { locations } = useWarehouseLocations();

  useEffect(() => {
    if (editingBin) {
      setFormData({
        bin_code: editingBin.bin_code,
        name: editingBin.name,
        description: editingBin.description || '',
        capacity: editingBin.capacity?.toString() || '',
        location_id: editingBin.location_id || '',
        notes: editingBin.notes || '',
        status: editingBin.status
      });
    } else {
      setFormData({
        bin_code: '',
        name: '',
        description: '',
        capacity: '',
        location_id: '',
        notes: '',
        status: 'active' as 'active' | 'inactive' | 'maintenance' | 'full'
      });
    }
  }, [editingBin, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const binData = {
      bin_code: formData.bin_code,
      name: formData.name,
      description: formData.description || null,
      capacity: formData.capacity ? Number(formData.capacity) : null,
      location_id: formData.location_id || null,
      notes: formData.notes || null,
      status: formData.status as 'active' | 'inactive' | 'maintenance' | 'full'
    };

    if (editingBin) {
      updateBin({ id: editingBin.id, ...binData });
    } else {
      createBin(binData);
    }
    
    onOpenChange(false);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingBin ? 'Edit Bin' : 'Create New Bin'}
          </DialogTitle>
          <DialogDescription>
            {editingBin ? 'Update bin information' : 'Add a new storage bin to the warehouse'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bin_code">Bin Code *</Label>
              <Input
                id="bin_code"
                value={formData.bin_code}
                onChange={(e) => handleChange('bin_code', e.target.value)}
                placeholder="e.g., A-01-01"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., Aisle A Rack 1 Shelf 1"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description of the bin"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity</Label>
              <Input
                id="capacity"
                type="number"
                min="0"
                step="0.01"
                value={formData.capacity}
                onChange={(e) => handleChange('capacity', e.target.value)}
                placeholder="Maximum capacity"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location_id">Location</Label>
              <Select value={formData.location_id} onValueChange={(value) => handleChange('location_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="maintenance">Under Maintenance</SelectItem>
                <SelectItem value="full">Full</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional notes"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || isUpdating}>
              {editingBin ? 'Update Bin' : 'Create Bin'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}