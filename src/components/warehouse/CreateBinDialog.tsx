import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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

type Scope = 'location' | 'global';

const BIN_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]*$/;

export function CreateBinDialog({ open, onOpenChange, editingBin }: CreateBinDialogProps) {
  const [scope, setScope] = useState<Scope>('location');
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    bin_code: '',
    name: '',
    description: '',
    capacity: '',
    location_id: '',
    notes: '',
    status: 'active' as 'active' | 'inactive' | 'maintenance' | 'full'
  });
  const [codeError, setCodeError] = useState<string | null>(null);

  const { createBin, updateBin, isCreating, isUpdating } = useWarehouseBins();
  const { locations } = useWarehouseLocations();

  useEffect(() => {
    if (editingBin) {
      setScope('location');
      setSelectedLocationIds([]);
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
      setScope('location');
      setSelectedLocationIds([]);
      setFormData({
        bin_code: '',
        name: '',
        description: '',
        capacity: '',
        location_id: '',
        notes: '',
        status: 'active'
      });
    }
    setCodeError(null);
  }, [editingBin, open]);

  // Bins can attach to either a top-level warehouse OR a sub-location/department.
  // Matches SAP EWM / Oracle WMS bin model: storage bin → physical node (warehouse OR zone).
  const sortedLocations = useMemo(() => {
    const byId = new Map(locations.map((l) => [l.id, l] as const));
    const labelFor = (l: typeof locations[number]) => {
      if (!l.parent_id) return l.name;
      const parent = byId.get(l.parent_id);
      return parent ? `${parent.name} › ${l.name}` : l.name;
    };
    return [...locations]
      .map((l) => ({ ...l, _label: labelFor(l), _isSub: !!l.parent_id }))
      .sort((a, b) => a._label.localeCompare(b._label, undefined, { sensitivity: 'base' }));
  }, [locations]);

  const validateCode = (code: string) => {
    const v = code.trim().toUpperCase();
    if (!v) return 'Bin code is required';
    if (!BIN_CODE_PATTERN.test(v)) return 'Use letters, numbers and dashes only (no spaces)';
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedCode = formData.bin_code.trim().toUpperCase();
    const err = validateCode(normalizedCode);
    if (err) { setCodeError(err); return; }

    const base = {
      bin_code: normalizedCode,
      name: formData.name.trim(),
      description: formData.description || undefined,
      capacity: formData.capacity ? Number(formData.capacity) : undefined,
      notes: formData.notes || undefined,
      status: formData.status,
    };

    if (editingBin) {
      if (!formData.location_id) return;
      updateBin({ id: editingBin.id, ...base, location_id: formData.location_id });
      onOpenChange(false);
      return;
    }

    if (scope === 'global') {
      if (selectedLocationIds.length === 0) return;
      createBin({ ...base, location_ids: selectedLocationIds, is_global_template: true });
    } else {
      if (!formData.location_id) return;
      createBin({ ...base, location_id: formData.location_id });
    }

    onOpenChange(false);
  };

  const toggleLocation = (id: string) => {
    setSelectedLocationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allSelected = selectedLocationIds.length === sortedLocations.length && sortedLocations.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingBin ? 'Edit Bin' : 'Create New Bin'}</DialogTitle>
          <DialogDescription>
            {editingBin
              ? 'Update bin information'
              : 'Add a storage bin at the warehouse level. All sub-locations and departments under that warehouse will be able to use this bin automatically.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!editingBin && (
            <div className="space-y-2 rounded-md border p-3">
              <Label>Scope</Label>
              <RadioGroup value={scope} onValueChange={(v) => setScope(v as Scope)} className="flex gap-6">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="location" id="scope-location" />
                  <Label htmlFor="scope-location" className="font-normal cursor-pointer">
                    Single warehouse
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="global" id="scope-global" />
                  <Label htmlFor="scope-global" className="font-normal cursor-pointer">
                    Multiple warehouses (replicate same code)
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                Bin codes are unique per warehouse. Every sub-location and department under the selected
                warehouse can use this bin automatically.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bin_code">Bin Code *</Label>
              <Input
                id="bin_code"
                value={formData.bin_code}
                onChange={(e) => {
                  setFormData((p) => ({ ...p, bin_code: e.target.value.toUpperCase() }));
                  setCodeError(null);
                }}
                placeholder="e.g., A-01-01"
                required
                aria-invalid={!!codeError}
              />
              {codeError && <p className="text-xs text-destructive">{codeError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
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
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
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
                onChange={(e) => setFormData((p) => ({ ...p, capacity: e.target.value }))}
                placeholder="Maximum capacity"
              />
            </div>

            {(editingBin || scope === 'location') ? (
              <div className="space-y-2">
                <Label htmlFor="location_id">Warehouse *</Label>
                <Select
                  value={formData.location_id}
                  onValueChange={(value) => setFormData((p) => ({ ...p, location_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select warehouse or sub-location" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedLocations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location._isSub ? `↳ ${location._label}` : location._label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Attach the bin to a warehouse to share it across every sub-location, or to a
                  specific sub-location/department for narrower scope.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData((p) => ({ ...p, status: value as typeof formData.status }))}
                >
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
            )}
          </div>

          {!editingBin && scope === 'global' && (
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <Label>Locations *</Label>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{selectedLocationIds.length} selected</Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSelectedLocationIds(allSelected ? [] : sortedLocations.map((l) => l.id))
                    }
                  >
                    {allSelected ? 'Clear all' : 'Select all'}
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-56 rounded border">
                <div className="p-2 space-y-1">
                  {sortedLocations.map((loc) => {
                    const checked = selectedLocationIds.includes(loc.id);
                    return (
                      <label
                        key={loc.id}
                        className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted cursor-pointer"
                      >
                        <Checkbox checked={checked} onCheckedChange={() => toggleLocation(loc.id)} />
                        <span className="text-sm">{loc.name}</span>
                      </label>
                    );
                  })}
                  {sortedLocations.length === 0 && (
                    <div className="text-sm text-muted-foreground p-2">No locations available.</div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {(editingBin || scope === 'location') && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData((p) => ({ ...p, status: value as typeof formData.status }))}
              >
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
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Additional notes"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || isUpdating}>
              {editingBin
                ? 'Update Bin'
                : scope === 'global'
                  ? `Create ${selectedLocationIds.length || ''} Bin${selectedLocationIds.length === 1 ? '' : 's'}`.trim()
                  : 'Create Bin'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
