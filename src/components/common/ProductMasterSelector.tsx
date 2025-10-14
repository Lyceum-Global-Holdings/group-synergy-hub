import React, { useState } from 'react';
import { Check, ChevronsUpDown, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProductMaster, ProductMaster } from '@/hooks/useProductMaster';
import { useCompany } from '@/contexts/CompanyContext';

interface ProductMasterSelectorProps {
  value?: string;
  onSelect: (item: ProductMaster | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function ProductMasterSelector({
  value,
  onSelect,
  placeholder = "Select product template...",
  className,
  disabled = false,
}: ProductMasterSelectorProps) {
  const [open, setOpen] = useState(false);
  const { selectedCompany } = useCompany();
  const { products, isLoading, error } = useProductMaster(selectedCompany?.id);

  const activeProducts = products?.filter(product => product.status === 'active') || [];
  const selectedProduct = activeProducts.find(product => product.id === value);

  const handleSelect = (product: ProductMaster) => {
    onSelect(product);
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
          disabled={disabled}
        >
          <div className="flex items-center gap-2 flex-1 text-left">
            <Package className="h-4 w-4 shrink-0" />
            {selectedProduct ? (
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="secondary" className="text-xs">
                  {selectedProduct.product_code}
                </Badge>
                <span className="truncate">{selectedProduct.product_name}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 z-50 bg-popover border" align="start">
        <Command>
          <CommandInput placeholder="Search product templates by code or name..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Loading product templates..." : error ? "Error loading products." : "No product templates found."}
            </CommandEmpty>
            <CommandGroup>
              {selectedProduct && (
                <CommandItem onSelect={handleClear} className="text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4" />
                    <span>Clear selection</span>
                  </div>
                </CommandItem>
              )}
              {activeProducts.map((product) => (
                <CommandItem
                  key={product.id}
                  value={`${product.product_code} ${product.product_name}`}
                  onSelect={() => handleSelect(product)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === product.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Badge variant="outline" className="text-xs shrink-0">
                      {product.product_code}
                    </Badge>
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{product.product_name}</span>
                        {product.style_no && (
                          <Badge variant="secondary" className="text-xs">
                            {product.style_no}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {product.unit_of_measure && <span>{product.unit_of_measure}</span>}
                      </div>
                      {product.description && (
                        <span className="text-xs text-muted-foreground truncate">
                          {product.description}
                        </span>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
