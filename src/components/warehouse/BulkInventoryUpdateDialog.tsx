import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useItemCategories } from '@/hooks/useItemCategories';
import { useItemUnits } from '@/hooks/useItemUnits';
import { useCompany } from '@/contexts/CompanyContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface BulkInventoryUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Set<string>;
  onComplete: () => void;
}

export function BulkInventoryUpdateDialog({ open, onOpenChange, selectedIds, onComplete }: BulkInventoryUpdateDialogProps) {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { categories } = useItemCategories(selectedCompany?.id);
  const { units } = useItemUnits();

  const [categoryId, setCategoryId] = useState<string>('');
  const [unitId, setUnitId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [brand, setBrand] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async () => {
    const updates: Record<string, any> = {};
    if (categoryId) updates.category_id = categoryId;
    if (unitId) updates.unit_id = unitId;
    if (status) updates.status = status;
    if (brand.trim()) updates.brand = brand.trim();

    if (Object.keys(updates).length === 0) {
      toast.error('Please select at least one field to update');
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    for (const id of selectedIds) {
      const { error } = await supabase.from('warehouse_items').update(updates).eq('id', id);
      if (error) {
        console.error('Bulk update error for', id, error);
        errorCount++;
      } else {
        successCount++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ['warehouse-items-inventory'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });

    if (errorCount === 0) {
      toast.success(`Updated ${successCount} items successfully`);
    } else {
      toast.warning(`Updated ${successCount} items, ${errorCount} failed`);
    }

    setIsProcessing(false);
    resetForm();
    onOpenChange(false);
    onComplete();
  };

  const resetForm = () => {
    setCategoryId('');
    setUnitId('');
    setStatus('');
    setBrand('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Update {selectedIds.size} Items</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Only non-empty fields will be applied.</p>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Leave unchanged" /></SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Unit</Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger><SelectValue placeholder="Leave unchanged" /></SelectTrigger>
              <SelectContent>
                {units.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name} ({u.abbreviation})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="Leave unchanged" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="discontinued">Discontinued</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Brand</Label>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Leave unchanged" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isProcessing}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update {selectedIds.size} Items
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
