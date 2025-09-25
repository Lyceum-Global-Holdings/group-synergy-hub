import React from 'react';
import { MultiSizeSelector } from './MultiSizeSelector';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

interface BomSizeSelectorProps {
  selectedSizes: string[];
  onSizesChange: (sizes: string[]) => void;
  finishedGoodSizes?: string[];
  sizeSpecific: boolean;
  onSizeSpecificChange: (specific: boolean) => void;
  className?: string;
}

export function BomSizeSelector({
  selectedSizes,
  onSizesChange,
  finishedGoodSizes = [],
  sizeSpecific,
  onSizeSpecificChange,
  className = "",
}: BomSizeSelectorProps) {
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Size-specific toggle */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="size-specific"
          checked={sizeSpecific}
          onChange={(e) => onSizeSpecificChange(e.target.checked)}
          className="rounded border-border"
        />
        <Label htmlFor="size-specific" className="text-sm">
          This BOM applies to specific sizes only
        </Label>
      </div>

      {/* Show finished good sizes if available */}
      {finishedGoodSizes.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Available sizes from linked finished good:
          </div>
          <div className="flex flex-wrap gap-1">
            {finishedGoodSizes.map((size) => (
              <Badge key={size} variant="outline" className="text-xs">
                {size}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Size selector - only show when size-specific is enabled */}
      {sizeSpecific && (
        <div className="space-y-2">
          <Label>Target Sizes</Label>
          <MultiSizeSelector
            selectedSizes={selectedSizes}
            onSizesChange={onSizesChange}
            availableSizes={finishedGoodSizes.length > 0 ? finishedGoodSizes : undefined}
            showSelectAll={true}
            groupByCategory={finishedGoodSizes.length === 0}
          />
          {selectedSizes.length === 0 && sizeSpecific && (
            <p className="text-sm text-muted-foreground">
              Select the sizes this BOM applies to, or uncheck "size-specific" to apply to all sizes.
            </p>
          )}
        </div>
      )}

      {/* Show message when not size-specific */}
      {!sizeSpecific && (
        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
          This BOM will apply to all sizes of the product.
        </div>
      )}
    </div>
  );
}