import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { X, ChevronDown } from 'lucide-react';
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
    <div className={`space-y-3 ${className}`}>
      {/* Popover trigger button */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
          >
            <span>
              {selectedSizes.length === 0 
                ? 'Select Sizes' 
                : `${selectedSizes.length} Size${selectedSizes.length !== 1 ? 's' : ''} Selected`
              }
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-96 p-4 max-h-[500px] overflow-y-auto" align="start">
          <div className="space-y-4">
            {/* Select All button */}
            {showSelectAll && (
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-sm font-medium">Available Sizes</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-8 px-2 text-xs"
                >
                  {selectedSizes.length === sizeOptions.length ? 'Clear All' : 'Select All'}
                </Button>
              </div>
            )}

            {/* Size selection by category */}
            {Object.entries(groupedSizes).map(([category, sizes]) => (
              <div key={category} className="space-y-2">
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
                
                <div className="grid grid-cols-6 gap-2">
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
                      <span className="text-sm font-medium">{size.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected sizes badges */}
      {selectedSizes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedSizes.map(size => (
            <Badge 
              key={size} 
              variant="secondary"
              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
              onClick={() => handleSizeToggle(size)}
            >
              {size}
              <X className="ml-1 h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}