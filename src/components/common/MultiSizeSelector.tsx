import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getSizesByCategory, SIZE_CATEGORIES } from '@/constants/standardSizes';

interface MultiSizeSelectorProps {
  selectedSizes: string[];
  onSizesChange: (sizes: string[]) => void;
  availableSizes?: string[];
  showSelectAll?: boolean;
  groupByCategory?: boolean;
  className?: string;
}

export function MultiSizeSelector({
  selectedSizes,
  onSizesChange,
  availableSizes,
  showSelectAll = true,
  groupByCategory = true,
  className = "",
}: MultiSizeSelectorProps) {
  // Use available sizes or default to Apparel category
  const sizeOptions = availableSizes 
    ? availableSizes.map(size => ({ value: size, label: size, category: 'Custom' }))
    : getSizesByCategory('Apparel');

  const handleSizeToggle = (sizeValue: string) => {
    const isSelected = selectedSizes.includes(sizeValue);
    if (isSelected) {
      onSizesChange(selectedSizes.filter(size => size !== sizeValue));
    } else {
      onSizesChange([...selectedSizes, sizeValue]);
    }
  };

  const handleSelectAll = () => {
    if (selectedSizes.length === sizeOptions.length) {
      onSizesChange([]);
    } else {
      onSizesChange(sizeOptions.map(size => size.value));
    }
  };

  const handleSelectCategory = (category: string) => {
    const categorySizes = sizeOptions.filter(size => size.category === category);
    const categoryValues = categorySizes.map(size => size.value);
    const allCategorySelected = categoryValues.every(size => selectedSizes.includes(size));
    
    if (allCategorySelected) {
      // Remove all category sizes
      onSizesChange(selectedSizes.filter(size => !categoryValues.includes(size)));
    } else {
      // Add all category sizes
      const newSizes = [...selectedSizes];
      categoryValues.forEach(size => {
        if (!newSizes.includes(size)) {
          newSizes.push(size);
        }
      });
      onSizesChange(newSizes);
    }
  };

  const groupedSizes = groupByCategory 
    ? sizeOptions.reduce((groups, size) => {
        const category = size.category || 'Other';
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(size);
        return groups;
      }, {} as Record<string, typeof sizeOptions>)
    : { 'All Sizes': sizeOptions };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Selected sizes display */}
      {selectedSizes.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Selected Sizes ({selectedSizes.length})</div>
          <div className="flex flex-wrap gap-1">
            {selectedSizes.map(size => (
              <Badge 
                key={size} 
                variant="default" 
                className="cursor-pointer hover:bg-destructive"
                onClick={() => handleSizeToggle(size)}
              >
                {size} ×
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Control buttons */}
      {showSelectAll && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
          >
            {selectedSizes.length === sizeOptions.length ? 'Clear All' : 'Select All'}
          </Button>
        </div>
      )}

      {/* Size selection grid */}
      <div className="space-y-4">
        {Object.entries(groupedSizes).map(([category, sizes]) => (
          <div key={category} className="space-y-3">
            {groupByCategory && (
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-muted-foreground">{category}</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelectCategory(category)}
                  className="h-6 px-2 text-xs"
                >
                  {sizes.every(size => selectedSizes.includes(size.value)) ? 'Unselect' : 'Select'} All
                </Button>
              </div>
            )}
            
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {sizes.map(size => (
                <div
                  key={size.value}
                  className={`
                    flex items-center justify-center p-2 border rounded-md cursor-pointer transition-colors
                    ${selectedSizes.includes(size.value) 
                      ? 'bg-primary text-primary-foreground border-primary' 
                      : 'hover:bg-muted border-border'
                    }
                  `}
                  onClick={() => handleSizeToggle(size.value)}
                >
                  <div className="flex items-center space-x-1">
                    <Checkbox
                      checked={selectedSizes.includes(size.value)}
                      onChange={() => handleSizeToggle(size.value)}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium">{size.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {selectedSizes.length === 0 && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          No sizes selected. Choose from the options above.
        </div>
      )}
    </div>
  );
}