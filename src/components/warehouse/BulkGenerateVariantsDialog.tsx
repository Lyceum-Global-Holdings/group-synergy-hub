import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { ProductMaster } from '@/hooks/useProductMaster';
import { useBulkGenerateVariants, BulkGenerateResult } from '@/hooks/useBulkGenerateVariants';

interface BulkGenerateVariantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productMaster: ProductMaster | null;
}

export function BulkGenerateVariantsDialog({
  open,
  onOpenChange,
  productMaster,
}: BulkGenerateVariantsDialogProps) {
  const { generateVariants, isGenerating } = useBulkGenerateVariants();
  
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<any[]>([]);
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'update'>('skip');
  const [result, setResult] = useState<BulkGenerateResult | null>(null);
  
  // Default values
  const [sellingPrice, setSellingPrice] = useState<string>('');
  const [standardCost, setStandardCost] = useState<string>('');
  const [minimumStock, setMinimumStock] = useState<string>('10');
  const [maximumStock, setMaximumStock] = useState<string>('100');
  const [reorderPoint, setReorderPoint] = useState<string>('20');
  const [leadTimeDays, setLeadTimeDays] = useState<string>('7');
  const [qualityStatus, setQualityStatus] = useState<string>('approved');
  const [status, setStatus] = useState<string>('active');

  const availableSizes = useMemo(() => {
    if (!productMaster?.available_sizes) return [];
    return Array.isArray(productMaster.available_sizes) 
      ? productMaster.available_sizes 
      : [];
  }, [productMaster]);

  const availableColors = useMemo(() => {
    if (!productMaster?.available_colors) return [];
    const colors = Array.isArray(productMaster.available_colors) 
      ? productMaster.available_colors 
      : [];
    
    // Map database structure to expected structure
    return colors.map(color => ({
      name: color.color_name,
      code: color.color_code,
      hex: color.color_code, // Use color_code as hex since hex_value is null
      id: color.id,
    }));
  }, [productMaster]);

  const totalCombinations = selectedSizes.length * selectedColors.length;

  const previewVariants = useMemo(() => {
    if (selectedSizes.length === 0 || selectedColors.length === 0) return [];
    
    const previews = [];
    for (let i = 0; i < Math.min(10, totalCombinations); i++) {
      const sizeIndex = Math.floor(i / selectedColors.length) % selectedSizes.length;
      const colorIndex = i % selectedColors.length;
      
      const size = selectedSizes[sizeIndex];
      const color = selectedColors[colorIndex];
      const colorName = color.name?.replace(/\s+/g, '').toUpperCase() || 'COL';
      const sizeCode = size === 'All' ? '' : `-${size}`;
      const colorSuffix = colorName ? `-${colorName}` : '';
      
      previews.push({
        code: `${productMaster?.product_code}${sizeCode}${colorSuffix}`,
        name: `${productMaster?.product_name} - ${size}${color.name ? ` - ${color.name}` : ''}`,
      });
    }
    
    return previews;
  }, [selectedSizes, selectedColors, productMaster, totalCombinations]);

  const handleSizeToggle = (size: string) => {
    setSelectedSizes(prev =>
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  };

  const handleColorToggle = (color: any) => {
    setSelectedColors(prev =>
      prev.some(c => c.name === color.name)
        ? prev.filter(c => c.name !== color.name)
        : [...prev, color]
    );
  };

  const handleSelectAllSizes = () => {
    if (selectedSizes.length === availableSizes.length) {
      setSelectedSizes([]);
    } else {
      setSelectedSizes([...availableSizes]);
    }
  };

  const handleSelectAllColors = () => {
    if (selectedColors.length === availableColors.length) {
      setSelectedColors([]);
    } else {
      setSelectedColors([...availableColors]);
    }
  };

  const handleGenerate = () => {
    if (!productMaster || selectedSizes.length === 0 || selectedColors.length === 0) {
      return;
    }

    const defaultValues = {
      selling_price: sellingPrice ? parseFloat(sellingPrice) : undefined,
      standard_cost: standardCost ? parseFloat(standardCost) : undefined,
      minimum_stock: minimumStock ? parseInt(minimumStock) : undefined,
      maximum_stock: maximumStock ? parseInt(maximumStock) : undefined,
      reorder_point: reorderPoint ? parseInt(reorderPoint) : undefined,
      lead_time_days: leadTimeDays ? parseInt(leadTimeDays) : undefined,
      quality_status: qualityStatus,
      status: status,
    };

    generateVariants(
      {
        productMaster,
        selectedSizes,
        selectedColors,
        defaultValues,
        duplicateMode,
      },
      {
        onSuccess: (data) => {
          setResult(data);
        },
      }
    );
  };

  const handleClose = () => {
    setSelectedSizes([]);
    setSelectedColors([]);
    setResult(null);
    setSellingPrice('');
    setStandardCost('');
    onOpenChange(false);
  };

  if (!productMaster) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-6 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Product Variants</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Product Master Info */}
            <div className="space-y-2">
              <h3 className="font-semibold">Product Master</h3>
              <div className="flex gap-2 text-sm">
                <Badge variant="outline">{productMaster.product_code}</Badge>
                <span>{productMaster.product_name}</span>
                {productMaster.style_no && (
                  <Badge variant="secondary">{productMaster.style_no}</Badge>
                )}
              </div>
            </div>

            <Separator />

            {/* Size Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Select Sizes</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllSizes}
                >
                  {selectedSizes.length === availableSizes.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {availableSizes.map((size) => (
                  <div key={size} className="flex items-center space-x-2">
                    <Checkbox
                      id={`size-${size}`}
                      checked={selectedSizes.includes(size)}
                      onCheckedChange={() => handleSizeToggle(size)}
                    />
                    <Label htmlFor={`size-${size}`} className="cursor-pointer">
                      {size}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Color Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Select Colors</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllColors}
                >
                  {selectedColors.length === availableColors.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {availableColors.map((color) => (
                  <div key={color.name} className="flex items-center space-x-2">
                    <Checkbox
                      id={`color-${color.name}`}
                      checked={selectedColors.some(c => c.name === color.name)}
                      onCheckedChange={() => handleColorToggle(color)}
                    />
                    <Label htmlFor={`color-${color.name}`} className="flex items-center gap-2 cursor-pointer">
                      {color.hex && (
                        <div
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: color.hex }}
                        />
                      )}
                      {color.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Combinations Preview */}
            <div className="space-y-3">
              <h3 className="font-semibold">Combinations</h3>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-lg py-1 px-3">
                  {selectedSizes.length} sizes × {selectedColors.length} colors = {totalCombinations} variants
                </Badge>
              </div>
              
              {previewVariants.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Preview (first 10):</p>
                  <div className="space-y-1 text-sm">
                    {previewVariants.map((variant, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded">{variant.code}</code>
                        <span className="text-muted-foreground">{variant.name}</span>
                      </div>
                    ))}
                    {totalCombinations > 10 && (
                      <p className="text-xs text-muted-foreground italic">
                        ... and {totalCombinations - 10} more
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Default Values */}
            <div className="space-y-3">
              <h3 className="font-semibold">Default Values (Optional)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="selling-price">Selling Price</Label>
                  <Input
                    id="selling-price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="standard-cost">Standard Cost</Label>
                  <Input
                    id="standard-cost"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={standardCost}
                    onChange={(e) => setStandardCost(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min-stock">Minimum Stock</Label>
                  <Input
                    id="min-stock"
                    type="number"
                    value={minimumStock}
                    onChange={(e) => setMinimumStock(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-stock">Maximum Stock</Label>
                  <Input
                    id="max-stock"
                    type="number"
                    value={maximumStock}
                    onChange={(e) => setMaximumStock(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reorder-point">Reorder Point</Label>
                  <Input
                    id="reorder-point"
                    type="number"
                    value={reorderPoint}
                    onChange={(e) => setReorderPoint(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-time">Lead Time (Days)</Label>
                  <Input
                    id="lead-time"
                    type="number"
                    value={leadTimeDays}
                    onChange={(e) => setLeadTimeDays(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quality-status">Quality Status</Label>
                  <Select value={qualityStatus} onValueChange={setQualityStatus}>
                    <SelectTrigger id="quality-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Duplicate Handling */}
            <div className="space-y-3">
              <h3 className="font-semibold">Duplicate Handling</h3>
              <Select value={duplicateMode} onValueChange={(value: 'skip' | 'update') => setDuplicateMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip existing products</SelectItem>
                  <SelectItem value="update">Update existing products</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Results */}
            {result && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold">Results</h3>
                  <div className="space-y-2">
                    {result.created > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>Created: {result.created} variants</span>
                      </div>
                    )}
                    {result.updated > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-blue-500" />
                        <span>Updated: {result.updated} variants</span>
                      </div>
                    )}
                    {result.skipped > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                        <span>Skipped: {result.skipped} variants (already exist)</span>
                      </div>
                    )}
                    {result.errors.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-destructive">
                          <AlertCircle className="w-4 h-4" />
                          <span>Errors: {result.errors.length}</span>
                        </div>
                        <div className="text-xs text-muted-foreground max-h-20 overflow-y-auto">
                          {result.errors.map((error, index) => (
                            <div key={index}>{error}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Progress */}
            {isGenerating && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Generating variants...</span>
                  </div>
                  <Progress value={undefined} className="w-full" />
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isGenerating}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || selectedSizes.length === 0 || selectedColors.length === 0}
            >
              {isGenerating ? 'Generating...' : `Generate ${totalCombinations} Variants`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
