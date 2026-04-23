import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MapPin, Loader2 } from 'lucide-react';
import type { StockAuditItem } from '@/hooks/useStockAudit';
import type { ReconcileOverride } from '@/utils/stockReconciliation';

interface AssignLocationDialogProps {
  items: StockAuditItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (overrides: Map<string, ReconcileOverride>) => void;
  companyId: string | undefined;
}

interface LocationOption {
  id: string;
  name: string;
}

interface BinOption {
  id: string;
  bin_code: string;
  name: string;
}

interface ItemAssignment {
  itemId: string;
  itemCode: string;
  itemName: string;
  currentStock: number;
  locationId: string;
  binId: string;
}

export function AssignLocationDialog({ items, open, onOpenChange, onComplete, companyId }: AssignLocationDialogProps) {
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [binsByLocation, setBinsByLocation] = useState<Map<string, BinOption[]>>(new Map());
  const [assignments, setAssignments] = useState<ItemAssignment[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  useEffect(() => {
    if (!open || !companyId) return;

    setIsLoadingLocations(true);

    // Use the canonical effective-location resolver — includes top-level,
    // sub-locations, and inherited multi-company children.
    supabase
      .rpc('get_effective_locations_for_company' as any, { p_company_id: companyId })
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load effective locations:', error);
          setLocations([]);
        } else {
          const rows = ((data as any[]) || []) as Array<{ id: string; name: string }>;
          const map = new Map<string, LocationOption>();
          for (const r of rows) {
            if (r?.id && r?.name) map.set(r.id, { id: r.id, name: r.name });
          }
          setLocations(Array.from(map.values()));
        }
        setIsLoadingLocations(false);
      });

    // Initialize assignments
    setAssignments(items.map(item => ({
      itemId: item.id,
      itemCode: item.item_code,
      itemName: item.name,
      currentStock: item.current_stock,
      locationId: '',
      binId: '',
    })));
  }, [open, items, companyId]);

  const fetchBinsForLocation = async (locationId: string) => {
    if (binsByLocation.has(locationId)) return;
    
    const { data } = await supabase
      .from('warehouse_bins')
      .select('id, bin_code, name')
      .eq('location_id', locationId)
      .eq('status', 'active')
      .order('bin_code');
    
    setBinsByLocation(prev => new Map(prev).set(locationId, (data || []) as BinOption[]));
  };

  const updateLocation = (itemId: string, locationId: string) => {
    setAssignments(prev => prev.map(a =>
      a.itemId === itemId ? { ...a, locationId, binId: '' } : a
    ));
    fetchBinsForLocation(locationId);
  };

  const updateBin = (itemId: string, binId: string) => {
    setAssignments(prev => prev.map(a =>
      a.itemId === itemId ? { ...a, binId } : a
    ));
  };

  const allAssigned = assignments.every(a => a.locationId !== '' && a.binId !== '');

  const handleSave = async () => {
    if (!allAssigned) {
      toast.error('Please assign a location and bin to all items');
      return;
    }

    setIsSaving(true);
    let failed = 0;

    // Update location_id on warehouse_items
    for (const assignment of assignments) {
      const { error } = await supabase
        .from('warehouse_items')
        .update({ location_id: assignment.locationId, updated_at: new Date().toISOString() })
        .eq('id', assignment.itemId);

      if (error) {
        console.error(`Failed to update location for ${assignment.itemCode}:`, error);
        failed++;
      }
    }

    setIsSaving(false);

    if (failed > 0) {
      toast.error(`Failed to assign location for ${failed} item(s)`);
    }

    // Build overrides map for reconciliation engine
    const overrides = new Map<string, ReconcileOverride>();
    for (const a of assignments) {
      overrides.set(a.itemId, { locationId: a.locationId, binId: a.binId });
    }
    
    onComplete(overrides);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Assign Location & Bin
          </DialogTitle>
          <DialogDescription>
            {items.length} item(s) have stock but no warehouse location or bin allocation.
            Select a location and bin for each item to proceed with reconciliation.
          </DialogDescription>
        </DialogHeader>

        {isLoadingLocations ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : locations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No warehouse locations found for this company. Please create a location first.
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => {
              const bins = binsByLocation.get(assignment.locationId) || [];
              return (
                <div key={assignment.itemId} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{assignment.itemCode}</span>
                      <Badge variant="secondary" className="text-xs">
                        Stock: {assignment.currentStock.toFixed(2)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{assignment.itemName}</p>
                  </div>
                  <Select
                    value={assignment.locationId}
                    onValueChange={(v) => updateLocation(assignment.itemId, v)}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={assignment.binId}
                    onValueChange={(v) => updateBin(assignment.itemId, v)}
                    disabled={!assignment.locationId}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder={assignment.locationId ? (bins.length === 0 ? 'No bins' : 'Select bin') : 'Pick location first'} />
                    </SelectTrigger>
                    <SelectContent>
                      {bins.map((bin) => (
                        <SelectItem key={bin.id} value={bin.id}>{bin.bin_code} — {bin.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!allAssigned || isSaving || locations.length === 0}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Assign & Reconcile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
