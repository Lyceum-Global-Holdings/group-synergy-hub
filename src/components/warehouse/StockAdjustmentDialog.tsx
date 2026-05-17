import { useState, useEffect, useMemo } from 'react';
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useStockTransactions } from '@/hooks/useStockTransactions';
import { StockTransactionType } from '@/types/stockTransaction';
import { useWarehouseBins } from '@/hooks/useWarehouseBins';
import { useWarehouseBinAllocations } from '@/hooks/useWarehouseBinAllocations';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { Building2, MapPin } from 'lucide-react';

interface StockAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
  currentStock: number;
}

export function StockAdjustmentDialog({ 
  open, 
  onOpenChange, 
  itemId, 
  itemName, 
  currentStock 
}: StockAdjustmentDialogProps) {
  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('increase');
  const [quantity, setQuantity] = useState('');
  const [binId, setBinId] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [notes, setNotes] = useState('');
  const [issueToSubLocation, setIssueToSubLocation] = useState(false);
  const [selectedSubLocationId, setSelectedSubLocationId] = useState('');

  const { createTransaction, isCreating } = useStockTransactions();
  // skipLocationFilter: all users see all bins/locations for stock adjustments (ISO 55001)
  const { bins } = useWarehouseBins({ skipLocationFilter: true });
  const { createAllocation, adjustAllocation, getAllocationsForItem } = useWarehouseBinAllocations();
  const { locations } = useWarehouseLocations();
  const [itemAllocations, setItemAllocations] = useState<any[]>([]);

  // Derive parent location from the selected bin (walk up if bin sits on a sub-location)
  const derivedParentLocation = useMemo(() => {
    if (!binId) return null;
    const bin = bins.find(b => b.id === binId);
    if (!bin?.location_id) return null;
    const loc = (locations || []).find(l => l.id === bin.location_id);
    if (!loc) return null;
    if (loc.type === 'location') return loc;
    if (loc.type === 'sublocation' && loc.parent_id) {
      return (locations || []).find(l => l.id === loc.parent_id) || null;
    }
    return loc;
  }, [binId, bins, locations]);

  const subLocations = useMemo(
    () => (locations || []).filter(
      l => l.type === 'sublocation' && l.status === 'active' && l.parent_id === derivedParentLocation?.id
    ),
    [locations, derivedParentLocation]
  );

  // Group active bins by their parent location for the bin selector
  const binsGroupedByLocation = useMemo(() => {
    const activeBins = bins.filter(bin => bin.status === 'active');
    const groups = new Map<string, { locationName: string; bins: typeof activeBins }>();

    for (const bin of activeBins) {
      const loc = (locations || []).find(l => l.id === bin.location_id);
      const locName = loc?.name || 'Unknown Location';
      const locId = bin.location_id || 'unknown';
      if (!groups.has(locId)) {
        groups.set(locId, { locationName: locName, bins: [] });
      }
      groups.get(locId)!.bins.push(bin);
    }

    return Array.from(groups.entries())
      .sort((a, b) => a[1].locationName.localeCompare(b[1].locationName));
  }, [bins, locations]);

  // Load allocations for this item when dialog opens
  useEffect(() => {
    const loadAllocations = async () => {
      if (open && itemId) {
        const allocations = await getAllocationsForItem(itemId);
        setItemAllocations(allocations);
      }
    };
    loadAllocations();
  }, [open, itemId]);

  // Reset issue options when switching to increase
  useEffect(() => {
    if (adjustmentType === 'increase') {
      setIssueToSubLocation(false);
      setSelectedSubLocationId('');
    }
  }, [adjustmentType]);

  // Reset sub-location when bin (parent context) changes
  useEffect(() => {
    setSelectedSubLocationId('');
  }, [binId]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setQuantity('');
      setBinId('');
      setUnitCost('');
      setNotes('');
      setIssueToSubLocation(false);
      setSelectedSubLocationId('');
      setAdjustmentType('increase');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const quantityValue = parseFloat(quantity);
    if (isNaN(quantityValue) || quantityValue <= 0) return;

    if (!binId) {
      alert('Please select a bin location');
      return;
    }

    // Validate sub-location if issuing to sub-location
    if (issueToSubLocation && !selectedSubLocationId) {
      alert('Please select a sub-location');
      return;
    }

    const quantityChange = adjustmentType === 'increase' ? quantityValue : -quantityValue;

    // Find existing allocation for this item and bin
    const existingAllocation = itemAllocations.find(a => a.bin_id === binId);

    if (existingAllocation) {
      adjustAllocation({
        id: existingAllocation.id,
        quantityChange: quantityChange,
      });
    } else if (adjustmentType === 'increase') {
      createAllocation({
        warehouse_item_id: itemId,
        bin_id: binId,
        allocated_quantity: quantityValue,
        notes: notes || `Initial allocation`,
      });
    } else {
      alert('Cannot decrease stock in a bin that has no allocation');
      return;
    }

    // Determine transaction type and notes based on issue destination
    const selectedSubLocation = (locations || []).find(l => l.id === selectedSubLocationId);
    const selectedParentLocation = (locations || []).find(l => l.id === selectedLocationId);
    const isSubLocationIssue = issueToSubLocation && selectedSubLocation && adjustmentType === 'decrease';
    
    let transactionType: StockTransactionType = 'adjustment';
    let referenceType: 'manual' | 'grn' | 'mrn' | 'adjustment' | 'transfer' | 'project' = 'adjustment';
    let issuedLocationId: string | undefined = undefined;
    
    if (isSubLocationIssue) {
      transactionType = 'material_issue';
      referenceType = 'transfer';
      issuedLocationId = selectedSubLocationId;
    }
    
    let transactionNotes = notes;
    if (isSubLocationIssue && selectedSubLocation && selectedParentLocation) {
      transactionNotes = `Issued to ${selectedParentLocation.name} → ${selectedSubLocation.name}${notes ? ' - ' + notes : ''}`;
    } else if (!transactionNotes) {
      transactionNotes = `Manual stock ${adjustmentType} - Bin: ${bins.find(b => b.id === binId)?.bin_code}`;
    }

    createTransaction({
      item_id: itemId,
      transaction_type: transactionType,
      reference_type: referenceType,
      quantity_change: quantityChange,
      quantity_before: currentStock,
      quantity_after: currentStock + quantityChange,
      unit_cost: unitCost ? parseFloat(unitCost) : undefined,
      total_value: unitCost ? parseFloat(unitCost) * Math.abs(quantityChange) : undefined,
      notes: transactionNotes,
      issued_to_location_id: issuedLocationId,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adjust Stock - {itemName}</DialogTitle>
          <DialogDescription>
            Current stock: {currentStock} units
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Adjustment Type</Label>
            <Select value={adjustmentType} onValueChange={(value: 'increase' | 'decrease') => setAdjustmentType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="increase">Increase Stock</SelectItem>
                <SelectItem value="decrease">Decrease Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bin">Bin Location *</Label>
            <Select value={binId} onValueChange={setBinId}>
              <SelectTrigger>
                <SelectValue placeholder="Select bin location" />
              </SelectTrigger>
              <SelectContent>
                {binsGroupedByLocation.map(([locId, group]) => (
                  <SelectGroup key={locId}>
                    <SelectLabel className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" />
                      {group.locationName}
                    </SelectLabel>
                    {group.bins.map(bin => {
                      const allocation = itemAllocations.find(a => a.bin_id === bin.id);
                      const allocatedQty = allocation?.allocated_quantity || 0;
                      return (
                        <SelectItem key={bin.id} value={bin.id}>
                          {bin.bin_code} - {bin.name} {allocatedQty > 0 && `(Current: ${allocatedQty})`}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity *</Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              min="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity to adjust"
              required
            />
          </div>

          {/* Issue to Sub-Location — Location → Sub-Location hierarchy */}
          {adjustmentType === 'decrease' && (
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="issueToSubLocation"
                  checked={issueToSubLocation}
                  onCheckedChange={(checked) => {
                    setIssueToSubLocation(checked === true);
                    if (!checked) {
                      setSelectedLocationId('');
                      setSelectedSubLocationId('');
                    }
                  }}
                />
                <Label 
                  htmlFor="issueToSubLocation" 
                  className="text-sm font-medium cursor-pointer flex items-center gap-2"
                >
                  <Building2 className="h-4 w-4" />
                  Issue to Sub-Location
                </Label>
              </div>

              {issueToSubLocation && (
                <div className="space-y-3 pl-6">
                  {/* Step 1: Select Location (parent) */}
                  <div className="space-y-2">
                    <Label htmlFor="parentLocation">Location *</Label>
                    <Select
                      value={selectedLocationId}
                      onValueChange={setSelectedLocationId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {parentLocations.map(loc => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name} {loc.location_code ? `(${loc.location_code})` : ''}
                          </SelectItem>
                        ))}
                        {parentLocations.length === 0 && (
                          <SelectItem value="none" disabled>
                            No locations available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Step 2: Select Sub-Location (child) */}
                  {selectedLocationId && (
                    <div className="space-y-2">
                      <Label htmlFor="subLocation">Sub-Location *</Label>
                      <Select
                        value={selectedSubLocationId}
                        onValueChange={setSelectedSubLocationId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select sub-location" />
                        </SelectTrigger>
                        <SelectContent>
                          {subLocations.map(sub => (
                            <SelectItem key={sub.id} value={sub.id}>
                              {sub.name} {sub.location_code ? `(${sub.location_code})` : ''}
                            </SelectItem>
                          ))}
                          {subLocations.length === 0 && (
                            <SelectItem value="none" disabled>
                              No sub-locations under this location
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Stock will be marked as issued to this sub-location
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="unit_cost">Unit Cost</Label>
            <Input
              id="unit_cost"
              type="number"
              step="0.01"
              min="0"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder="Enter unit cost (optional)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for adjustment"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {adjustmentType === 'increase' 
                ? 'Increase Stock' 
                : issueToSubLocation 
                  ? 'Issue to Sub-Location'
                  : 'Decrease Stock'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}