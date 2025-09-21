import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MEASUREMENT_TYPES } from '@/types/supplier';
import { useItemUnits } from '@/hooks/useItemUnits';
import { CreateItemUnitData } from '@/types/itemBin';

interface ImportStandardUnitsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportStandardUnitsDialog({ 
  open, 
  onOpenChange 
}: ImportStandardUnitsDialogProps) {
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const { units, bulkImportUnits, isImporting } = useItemUnits();

  const existingAbbreviations = new Set(units.map(unit => unit.abbreviation.toLowerCase()));

  const availableUnits = MEASUREMENT_TYPES.filter(unit => 
    !existingAbbreviations.has(unit.value.toLowerCase())
  );

  const lengthUnits = ['mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mi'];
  const weightUnits = ['g', 'kg', 'ton', 'oz', 'lb'];
  const volumeUnits = ['ml', 'l', 'gal', 'm3', 'ft3'];
  const areaUnits = ['mm2', 'cm2', 'm2', 'km2', 'in2', 'ft2', 'yd2'];
  const quantityUnits = ['pcs', 'box', 'carton', 'dozen', 'pack', 'roll', 'sheet', 'bundle', 'case', 'pallet'];

  const groupedUnits = {
    length: availableUnits.filter(unit => lengthUnits.includes(unit.value as any)),
    weight: availableUnits.filter(unit => weightUnits.includes(unit.value as any)),
    volume: availableUnits.filter(unit => volumeUnits.includes(unit.value as any)),
    area: availableUnits.filter(unit => areaUnits.includes(unit.value as any)),
    quantity: availableUnits.filter(unit => quantityUnits.includes(unit.value as any))
  };

  const handleUnitToggle = (unitValue: string) => {
    setSelectedUnits(prev => 
      prev.includes(unitValue) 
        ? prev.filter(u => u !== unitValue)
        : [...prev, unitValue]
    );
  };

  const handleSelectCategory = (category: keyof typeof groupedUnits) => {
    const categoryUnits = groupedUnits[category].map(u => u.value);
    const allSelected = categoryUnits.every(unit => selectedUnits.includes(unit));
    
    if (allSelected) {
      setSelectedUnits(prev => prev.filter(u => !categoryUnits.includes(u as any)));
    } else {
      setSelectedUnits(prev => [...new Set([...prev, ...categoryUnits])]);
    }
  };

  const handleImport = () => {
    const unitsToImport: CreateItemUnitData[] = selectedUnits.map(value => {
      const unit = MEASUREMENT_TYPES.find(u => u.value === value);
      return {
        name: unit!.label.split('(')[0].trim(),
        abbreviation: unit!.value,
        description: `Standard unit of measurement: ${unit!.label}`
      };
    });

    bulkImportUnits(unitsToImport);
    setSelectedUnits([]);
    onOpenChange(false);
  };

  const renderUnitGroup = (title: string, category: keyof typeof groupedUnits) => {
    const units = groupedUnits[category];
    if (units.length === 0) return null;

    const allSelected = units.every(unit => selectedUnits.includes(unit.value));
    const someSelected = units.some(unit => selectedUnits.includes(unit.value));

    return (
      <div key={category} className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id={`category-${category}`}
            checked={allSelected}
            onCheckedChange={() => handleSelectCategory(category)}
          />
          <label 
            htmlFor={`category-${category}`} 
            className="text-sm font-medium cursor-pointer"
          >
            {title} ({units.length})
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 ml-6">
          {units.map((unit) => (
            <div key={unit.value} className="flex items-center space-x-2">
              <Checkbox
                id={unit.value}
                checked={selectedUnits.includes(unit.value)}
                onCheckedChange={() => handleUnitToggle(unit.value)}
              />
              <label 
                htmlFor={unit.value} 
                className="text-sm cursor-pointer flex-1"
              >
                {unit.label}
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Import Standard Units</DialogTitle>
          <DialogDescription>
            Select the standard measurement units you want to import. Units that already exist are not shown.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {availableUnits.length} units available • {selectedUnits.length} selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedUnits(availableUnits.map(u => u.value))}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedUnits([])}
              >
                Clear All
              </Button>
            </div>
          </div>

          {availableUnits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>All standard units have already been imported.</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-6">
                {renderUnitGroup('Length', 'length')}
                {renderUnitGroup('Weight', 'weight')}
                {renderUnitGroup('Volume', 'volume')}
                {renderUnitGroup('Area', 'area')}
                {renderUnitGroup('Quantity', 'quantity')}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={selectedUnits.length === 0 || isImporting}
          >
            {isImporting ? 'Importing...' : `Import ${selectedUnits.length} Units`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}