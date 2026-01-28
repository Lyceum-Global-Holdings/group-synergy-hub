import React, { useState, useEffect } from 'react';
import { Ruler, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBomSizeMultipliers } from '@/hooks/useBomSizeMultipliers';
import { DEFAULT_SIZE_MULTIPLIERS, CreateSizeMultiplierData } from '@/types/bom';

interface BomSizeMultiplierDialogProps {
  bomId: string;
  availableSizes: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BomSizeMultiplierDialog({
  bomId,
  availableSizes,
  open,
  onOpenChange,
}: BomSizeMultiplierDialogProps) {
  const { multipliers, upsertMultipliers, isUpdating } = useBomSizeMultipliers(bomId);
  const [localMultipliers, setLocalMultipliers] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open) {
      // Initialize with existing multipliers or defaults
      const initial: Record<string, number> = {};
      availableSizes.forEach(size => {
        const existing = multipliers.find(m => m.size === size);
        initial[size] = existing?.multiplier || DEFAULT_SIZE_MULTIPLIERS[size] || 1.0;
      });
      setLocalMultipliers(initial);
    }
  }, [open, multipliers, availableSizes]);

  const handleMultiplierChange = (size: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      setLocalMultipliers(prev => ({ ...prev, [size]: numValue }));
    }
  };

  const handleUseDefaults = () => {
    const defaults: Record<string, number> = {};
    availableSizes.forEach(size => {
      defaults[size] = DEFAULT_SIZE_MULTIPLIERS[size] || 1.0;
    });
    setLocalMultipliers(defaults);
  };

  const handleSave = async () => {
    const multipliersToSave: CreateSizeMultiplierData[] = Object.entries(localMultipliers).map(
      ([size, multiplier]) => ({
        bom_id: bomId,
        size,
        multiplier,
      })
    );

    try {
      await upsertMultipliers(multipliersToSave);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save multipliers:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-6 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            Configure Size Multipliers
          </DialogTitle>
          <DialogDescription>
            Set consumption multipliers for each size to automatically calculate material requirements.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Base consumption (defined in BOM items) is multiplied by these values. For example, if
              fabric consumption is 1.5m for size M (1.0x), size XL (1.25x) will require 1.875m.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleUseDefaults}>
              Use Standard Multipliers
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Size</TableHead>
                <TableHead>Multiplier</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {availableSizes.map(size => {
                const multiplier = localMultipliers[size] || 1.0;
                const isDefault = DEFAULT_SIZE_MULTIPLIERS[size] === multiplier;
                const description = multiplier < 1 
                  ? `${((1 - multiplier) * 100).toFixed(0)}% less material`
                  : multiplier > 1 
                  ? `${((multiplier - 1) * 100).toFixed(0)}% more material`
                  : 'Baseline (no adjustment)';

                return (
                  <TableRow key={size}>
                    <TableCell className="font-medium">{size}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max="5"
                          value={multiplier}
                          onChange={(e) => handleMultiplierChange(size, e.target.value)}
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">x</span>
                        {isDefault && (
                          <span className="text-xs text-success">Default</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {description}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <Label className="text-sm font-medium">Example Calculation</Label>
            <p className="text-sm text-muted-foreground">
              Base fabric: <span className="font-medium">1.5 meters</span> × Size{' '}
              <span className="font-medium">{availableSizes[0] || 'M'}</span> multiplier{' '}
              <span className="font-medium">
                ({localMultipliers[availableSizes[0]] || 1.0}x)
              </span>{' '}
              ={' '}
              <span className="font-medium text-foreground">
                {((localMultipliers[availableSizes[0]] || 1.0) * 1.5).toFixed(2)} meters
              </span>
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isUpdating}>
            {isUpdating ? 'Saving...' : 'Save Multipliers'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
