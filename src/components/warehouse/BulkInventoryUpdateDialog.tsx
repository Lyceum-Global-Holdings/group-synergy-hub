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
  defaultOwnerCompanyId?: string | null;
}

export function BulkInventoryUpdateDialog({ open, onOpenChange, selectedIds, onComplete, defaultOwnerCompanyId = null }: BulkInventoryUpdateDialogProps) {
  const queryClient = useQueryClient();
  const { selectedCompany, companies } = useCompany();
  const { categories } = useItemCategories(selectedCompany?.id);
  const { units } = useItemUnits();

  const [categoryId, setCategoryId] = useState<string>('');
  const [unitId, setUnitId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [brand, setBrand] = useState<string>('');
  const [ownerCompanyId, setOwnerCompanyId] = useState<string>(defaultOwnerCompanyId ?? '');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async () => {
    // Per-company updates (writable directly on warehouse_items)
    const perCompany: Record<string, any> = {};
    if (status) perCompany.status = status;

    // Master updates (catalog-owned; propagate globally via update_warehouse_catalog_item)
    const master: Record<string, any> = {};
    if (categoryId) master.category_id = categoryId;
    if (unitId) master.unit_id = unitId;
    if (brand.trim()) master.brand = brand.trim();

    if (Object.keys(perCompany).length === 0 && Object.keys(master).length === 0) {
      toast.error('Please select at least one field to update');
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Narrow target item IDs to those holding stock for the selected Stock Owner
    let targetIds = Array.from(selectedIds);
    if (ownerCompanyId) {
      const { data: allocRows, error: allocErr } = await supabase
        .from('warehouse_bin_allocations')
        .select('warehouse_item_id')
        .eq('company_id', ownerCompanyId)
        .gt('allocated_quantity', 0)
        .in('warehouse_item_id', targetIds);
      if (allocErr) {
        toast.error('Failed to resolve stock owner filter');
        setIsProcessing(false);
        return;
      }
      const ownerSet = new Set((allocRows || []).map((r: any) => r.warehouse_item_id));
      skippedCount = targetIds.length - ownerSet.size;
      targetIds = targetIds.filter((id) => ownerSet.has(id));
    }

    // Resolve catalog_item_id per selected inventory row when master fields change
    let catalogIds: string[] = [];
    if (Object.keys(master).length > 0 && targetIds.length > 0) {
      const { data: rows } = await supabase
        .from('warehouse_items_full')
        .select('catalog_item_id')
        .in('id', targetIds);
      catalogIds = Array.from(new Set((rows || []).map((r: any) => r.catalog_item_id).filter(Boolean)));
    }

    for (const id of targetIds) {
      if (Object.keys(perCompany).length > 0) {
        const { error } = await supabase.from('warehouse_items').update(perCompany).eq('id', id);
        if (error) { console.error('Bulk update error for', id, error); errorCount++; continue; }
      }
      successCount++;
    }

    // Apply master edits once per unique catalog item (changes propagate to every company)
    for (const catalogId of catalogIds) {
      const rpcArgs: Record<string, any> = { p_catalog_item_id: catalogId };
      for (const [k, v] of Object.entries(master)) rpcArgs[`p_${k}`] = v;
      const { error } = await supabase.rpc('update_warehouse_catalog_item', rpcArgs as any);
      if (error) { console.error('Catalog master update error', catalogId, error); errorCount++; }
    }

    queryClient.invalidateQueries({ queryKey: ['warehouse-items-inventory'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-item-catalog'] });

    if (errorCount === 0) {
      toast.success(
        `Updated ${successCount} items${skippedCount ? `, skipped ${skippedCount} (no stock for owner)` : ''}`
      );
    } else {
      toast.warning(`Updated ${successCount} items, ${errorCount} error(s)${skippedCount ? `, skipped ${skippedCount}` : ''}`);
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
    setOwnerCompanyId(defaultOwnerCompanyId ?? '');
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
