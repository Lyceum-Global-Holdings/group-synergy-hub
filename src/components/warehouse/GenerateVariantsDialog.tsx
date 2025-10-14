import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductMaster } from "@/types/productMaster";
import { useFinishedGoods } from "@/hooks/useFinishedGoods";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";

interface GenerateVariantsDialogProps {
  productMaster: ProductMaster;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GenerateVariantsDialog({
  productMaster,
  open,
  onOpenChange,
}: GenerateVariantsDialogProps) {
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set());
  const [initialStock, setInitialStock] = useState("");
  const [minStock, setMinStock] = useState("");
  const [maxStock, setMaxStock] = useState("");
  const [reorderPoint, setReorderPoint] = useState("");

  const { selectedCompany } = useCompany();
  const { createProduct, products } = useFinishedGoods();
  const { toast } = useToast();

  // Generate all possible combinations
  const allCombinations: Array<{ color?: string; size?: string }> = [];

  if (productMaster.available_colors.length > 0 && productMaster.available_sizes.length > 0) {
    productMaster.available_colors.forEach((color) => {
      productMaster.available_sizes.forEach((size) => {
        allCombinations.push({ color, size });
      });
    });
  } else if (productMaster.available_colors.length > 0) {
    productMaster.available_colors.forEach((color) => {
      allCombinations.push({ color });
    });
  } else if (productMaster.available_sizes.length > 0) {
    productMaster.available_sizes.forEach((size) => {
      allCombinations.push({ size });
    });
  }

  const getVariantKey = (combo: { color?: string; size?: string }) => {
    return `${combo.color || ''}-${combo.size || ''}`;
  };

  const getVariantCode = (combo: { color?: string; size?: string }) => {
    const parts = [];
    if (combo.color) parts.push(combo.color.substring(0, 3).toUpperCase());
    if (combo.size) parts.push(combo.size);
    return parts.join('-');
  };

  const isVariantExists = (combo: { color?: string; size?: string }) => {
    return products.some(
      (p) =>
        p.product_master_id === productMaster.id &&
        p.color === combo.color &&
        p.size === combo.size
    );
  };

  const handleToggleVariant = (key: string) => {
    const newSelected = new Set(selectedVariants);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedVariants(newSelected);
  };

  const handleSelectAll = () => {
    const allKeys = allCombinations
      .filter((combo) => !isVariantExists(combo))
      .map(getVariantKey);
    setSelectedVariants(new Set(allKeys));
  };

  const handleDeselectAll = () => {
    setSelectedVariants(new Set());
  };

  const handleGenerate = () => {
    const variantsToCreate = allCombinations.filter((combo) =>
      selectedVariants.has(getVariantKey(combo))
    );

    if (variantsToCreate.length === 0) {
      toast({
        title: "No variants selected",
        description: "Please select at least one variant to generate",
        variant: "destructive",
      });
      return;
    }

    variantsToCreate.forEach((combo) => {
      const variantData = {
        product_name: productMaster.product_name,
        product_code: `${productMaster.product_code}-${getVariantCode(combo)}`,
        style_no: productMaster.style_no,
        color: combo.color,
        size: combo.size,
        variant_code: getVariantCode(combo),
        category: productMaster.category_id,
        description: productMaster.description,
        unit_of_measure: productMaster.unit_of_measure,
        selling_price: productMaster.base_price,
        standard_cost: productMaster.base_price ? productMaster.base_price * 0.7 : undefined,
        minimum_stock: minStock ? parseFloat(minStock) : undefined,
        maximum_stock: maxStock ? parseFloat(maxStock) : undefined,
        reorder_point: reorderPoint ? parseFloat(reorderPoint) : undefined,
        status: 'active',
        quality_status: 'approved',
        company_id: selectedCompany?.id,
        product_master_id: productMaster.id,
        is_variant: true,
      };

      createProduct(variantData);
    });

    toast({
      title: "Variants generated",
      description: `${variantsToCreate.length} variant(s) created successfully`,
    });

    onOpenChange(false);
    setSelectedVariants(new Set());
    setInitialStock("");
    setMinStock("");
    setMaxStock("");
    setReorderPoint("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Product Variants</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="initial_stock">Initial Stock</Label>
                <Input
                  id="initial_stock"
                  type="number"
                  step="0.01"
                  value={initialStock}
                  onChange={(e) => setInitialStock(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_stock">Min Stock</Label>
                <Input
                  id="min_stock"
                  type="number"
                  step="0.01"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_stock">Max Stock</Label>
                <Input
                  id="max_stock"
                  type="number"
                  step="0.01"
                  value={maxStock}
                  onChange={(e) => setMaxStock(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reorder_point">Reorder Point</Label>
                <Input
                  id="reorder_point"
                  type="number"
                  step="0.01"
                  value={reorderPoint}
                  onChange={(e) => setReorderPoint(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {selectedVariants.size} of {allCombinations.filter((c) => !isVariantExists(c)).length} variants selected
              </p>
              <div className="space-x-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                  Deselect All
                </Button>
              </div>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Variant Code</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allCombinations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No color/size combinations available
                      </TableCell>
                    </TableRow>
                  ) : (
                    allCombinations.map((combo) => {
                      const key = getVariantKey(combo);
                      const exists = isVariantExists(combo);
                      return (
                        <TableRow key={key} className={exists ? "opacity-50" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={selectedVariants.has(key)}
                              onCheckedChange={() => handleToggleVariant(key)}
                              disabled={exists}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {`${productMaster.product_code}-${getVariantCode(combo)}`}
                          </TableCell>
                          <TableCell>{combo.color || '-'}</TableCell>
                          <TableCell>{combo.size || '-'}</TableCell>
                          <TableCell>
                            {exists ? (
                              <span className="text-xs text-muted-foreground">Already exists</span>
                            ) : (
                              <span className="text-xs text-green-600">New</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={selectedVariants.size === 0}>
                Generate Selected Variants
              </Button>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
