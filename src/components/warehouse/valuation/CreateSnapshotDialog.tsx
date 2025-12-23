import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInventorySnapshots } from '@/hooks/useInventorySnapshots';
import { SnapshotType } from '@/types/inventoryValuation';

interface CreateSnapshotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateSnapshotDialog({ open, onOpenChange }: CreateSnapshotDialogProps) {
  const { createSnapshot, isCreating } = useInventorySnapshots();
  const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().split('T')[0]);
  const [snapshotType, setSnapshotType] = useState<SnapshotType>('manual');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    createSnapshot({
      snapshot_date: snapshotDate,
      snapshot_type: snapshotType,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Inventory Snapshot</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Snapshot Date</Label>
            <Input
              type="date"
              value={snapshotDate}
              onChange={(e) => setSnapshotDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Snapshot Type</Label>
            <Select value={snapshotType} onValueChange={(value) => setSnapshotType(value as SnapshotType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="year_end">Year End</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Snapshot'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
