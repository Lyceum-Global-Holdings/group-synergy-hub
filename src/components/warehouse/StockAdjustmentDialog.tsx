import { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useStockTransactions } from '@/hooks/useStockTransactions';
import { StockTransactionType } from '@/types/stockTransaction';
import { useWarehouseBins } from '@/hooks/useWarehouseBins';
import { useWarehouseBinAllocations } from '@/hooks/useWarehouseBinAllocations';
import { useProjectStorageLocations } from '@/hooks/useProjectStorageLocations';
import { MapPin, Building2 } from 'lucide-react';

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
  const [issueToProject, setIssueToProject] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [issueToSubLocation, setIssueToSubLocation] = useState(false);
  const [selectedSubLocationId, setSelectedSubLocationId] = useState('');

  const { createTransaction, isCreating } = useStockTransactions();
  const { bins } = useWarehouseBins();
  const { createAllocation, adjustAllocation, getAllocationsForItem } = useWarehouseBinAllocations();
  const { projectStorageLocations, projectSubLocations, isLoading: isLoadingLocations, isLoadingSubLocations } = useProjectStorageLocations();
  const [itemAllocations, setItemAllocations] = useState<any[]>([]);

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
      setIssueToProject(false);
      setSelectedLocationId('');
      setIssueToSubLocation(false);
      setSelectedSubLocationId('');
    }
  }, [adjustmentType]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setQuantity('');
      setBinId('');
      setUnitCost('');
      setNotes('');
      setIssueToProject(false);
      setSelectedLocationId('');
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

    // Validate project location if issuing to project
    if (issueToProject && !selectedLocationId) {
      alert('Please select a project storage location');
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
      // Adjust existing bin allocation - this will automatically update item stock via trigger
      adjustAllocation({
        id: existingAllocation.id,
        quantityChange: quantityChange,
      });
    } else if (adjustmentType === 'increase') {
      // Create new bin allocation for increase - this will automatically update item stock via trigger
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
    const selectedProjectLocation = projectStorageLocations.find(l => l.warehouse_location_id === selectedLocationId);
    const selectedSubLocation = projectSubLocations.find(l => l.sublocation_id === selectedSubLocationId);
    const isProjectIssue = issueToProject && selectedProjectLocation && adjustmentType === 'decrease';
    const isSubLocationIssue = issueToSubLocation && selectedSubLocation && adjustmentType === 'decrease';
    
    let transactionType: StockTransactionType = 'adjustment';
    let referenceType: 'manual' | 'grn' | 'mrn' | 'adjustment' | 'transfer' | 'project' = 'adjustment';
    let issuedLocationId: string | undefined = undefined;
    
    if (isProjectIssue) {
      transactionType = 'project_issue';
      referenceType = 'project';
      issuedLocationId = selectedLocationId;
    } else if (isSubLocationIssue) {
      transactionType = 'material_issue';
      referenceType = 'transfer';
      issuedLocationId = selectedSubLocationId;
    }
    
    let transactionNotes = notes;
    if (isProjectIssue) {
      transactionNotes = `Issued to ${selectedProjectLocation.location_name} (${selectedProjectLocation.project_name})${notes ? ' - ' + notes : ''}`;
    } else if (isSubLocationIssue) {
      transactionNotes = `Issued to ${selectedSubLocation.sublocation_name} (${selectedSubLocation.project_name})${notes ? ' - ' + notes : ''}`;
    } else if (!transactionNotes) {
      transactionNotes = `Manual stock ${adjustmentType} - Bin: ${bins.find(b => b.id === binId)?.bin_code}`;
    }

    // Create transaction for audit trail
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
                {bins.filter(bin => bin.status === 'active').map(bin => {
                  const allocation = itemAllocations.find(a => a.bin_id === bin.id);
                  const allocatedQty = allocation?.allocated_quantity || 0;
                  return (
                    <SelectItem key={bin.id} value={bin.id}>
                      {bin.bin_code} - {bin.name} {allocatedQty > 0 && `(Current: ${allocatedQty})`}
                    </SelectItem>
                  );
                })}
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

          {/* Issue Options - Only shown for decrease */}
          {adjustmentType === 'decrease' && (
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
              {/* Issue to Project Storage Location */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="issueToProject"
                  checked={issueToProject}
                  onCheckedChange={(checked) => {
                    setIssueToProject(checked === true);
                    if (checked) {
                      setIssueToSubLocation(false);
                      setSelectedSubLocationId('');
                    }
                    if (!checked) setSelectedLocationId('');
                  }}
                />
                <Label 
                  htmlFor="issueToProject" 
                  className="text-sm font-medium cursor-pointer flex items-center gap-2"
                >
                  <MapPin className="h-4 w-4" />
                  Issue to Project Storage Location
                </Label>
              </div>

              {issueToProject && (
                <div className="space-y-2 pl-6">
                  <Label htmlFor="projectLocation">Project Location *</Label>
                  <Select 
                    value={selectedLocationId} 
                    onValueChange={setSelectedLocationId}
                    disabled={isLoadingLocations}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingLocations ? "Loading..." : "Select project location"} />
                    </SelectTrigger>
                    <SelectContent>
                      {projectStorageLocations.map(location => (
                        <SelectItem key={location.warehouse_location_id} value={location.warehouse_location_id}>
                          {location.location_code} - {location.location_name} ({location.project_name})
                        </SelectItem>
                      ))}
                      {projectStorageLocations.length === 0 && !isLoadingLocations && (
                        <SelectItem value="none" disabled>
                          No project storage locations available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Stock will be marked as issued to this project location
                  </p>
                </div>
              )}

              {/* Issue to Sub-Location */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="issueToSubLocation"
                  checked={issueToSubLocation}
                  onCheckedChange={(checked) => {
                    setIssueToSubLocation(checked === true);
                    if (checked) {
                      setIssueToProject(false);
                      setSelectedLocationId('');
                    }
                    if (!checked) setSelectedSubLocationId('');
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
                <div className="space-y-2 pl-6">
                  <Label htmlFor="subLocation">Sub-Location *</Label>
                  <Select 
                    value={selectedSubLocationId} 
                    onValueChange={setSelectedSubLocationId}
                    disabled={isLoadingSubLocations}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingSubLocations ? "Loading..." : "Select sub-location"} />
                    </SelectTrigger>
                    <SelectContent>
                      {projectSubLocations.map(location => (
                        <SelectItem key={location.sublocation_id} value={location.sublocation_id}>
                          {location.sublocation_name} ({location.project_name})
                        </SelectItem>
                      ))}
                      {projectSubLocations.length === 0 && !isLoadingSubLocations && (
                        <SelectItem value="none" disabled>
                          No project sub-locations available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
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
                : issueToProject 
                  ? 'Issue to Project' 
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
