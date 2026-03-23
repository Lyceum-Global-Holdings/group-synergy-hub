import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MapPin, Loader2 } from 'lucide-react';
import type { StockAuditItem } from '@/hooks/useStockAudit';

interface AssignLocationDialogProps {
  items: StockAuditItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  companyId: string | undefined;
}

interface LocationOption {
  id: string;
  name: string;
}

interface ItemAssignment {
  itemId: string;
  itemCode: string;
  itemName: string;
  currentStock: number;
  locationId: string;
}

export function AssignLocationDialog({ items, open, onOpenChange, onComplete, companyId }: AssignLocationDialogProps) {
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [assignments, setAssignments] = useState<ItemAssignment[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  useEffect(() => {
    if (!open || !companyId) return;
    
    setIsLoadingLocations(true);
    
    // Fetch locations linked to this company
    supabase
      .from('warehouse_location_companies')
      .select('location_id, warehouse_locations!inner(id, name)')
      .eq('company_id', companyId)
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to fetch locations:', error);
          setLocations([]);
        } else {
          const locs: LocationOption[] = (data || [])
            .map((d: any) => ({
              id: d.warehouse_locations?.id,
              name: d.warehouse_locations?.name,
            }))
            .filter((l: LocationOption) => l.id && l.name);
          
          // Deduplicate
          const seen = new Set<string>();
          setLocations(locs.filter(l => { if (seen.has(l.id)) return false; seen.add(l.id); return true; }));
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
    })));
  }, [open, items, companyId]);

  const updateAssignment = (itemId: string, locationId: string) => {
    setAssignments(prev => prev.map(a => a.itemId === itemId ? { ...a, locationId } : a));
  };

  const allAssigned = assignments.every(a => a.locationId !== '');

  const handleSave = async () => {
    if (!allAssigned) {
      toast.error('Please assign a location to all items');
      return;
    }

    setIsSaving(true);
    let failed = 0;

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
    } else {
      toast.success(`Locations assigned for ${assignments.length} item(s)`);
    }
    
    onComplete();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Assign Warehouse Locations
          </DialogTitle>
          <DialogDescription>
            The following {items.length} item(s) have stock but no warehouse location assigned.
            Please select a location for each item before reconciliation can proceed.
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
            {assignments.map((assignment) => (
              <div key={assignment.itemId} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
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
                  onValueChange={(v) => updateAssignment(assignment.itemId, v)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!allAssigned || isSaving || locations.length === 0}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Assign & Continue Fix
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
