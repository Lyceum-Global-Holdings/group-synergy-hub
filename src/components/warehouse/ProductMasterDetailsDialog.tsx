import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Plus } from "lucide-react";
import { ProductMaster } from "@/types/productMaster";
import { useFinishedGoods } from "@/hooks/useFinishedGoods";
import { useApparelCategories } from "@/hooks/useApparelCategories";
import { GenerateVariantsDialog } from "./GenerateVariantsDialog";

interface ProductMasterDetailsDialogProps {
  productMaster: ProductMaster;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductMasterDetailsDialog({
  productMaster,
  open,
  onOpenChange,
}: ProductMasterDetailsDialogProps) {
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const { products } = useFinishedGoods();
  const { apparelCategories } = useApparelCategories();

  const variants = products.filter(p => p.product_master_id === productMaster.id);

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'N/A';
    const category = apparelCategories.find(c => c.id === categoryId);
    return category?.name || 'N/A';
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { variant: "default" as const, label: "Active" },
      inactive: { variant: "secondary" as const, label: "Inactive" },
      discontinued: { variant: "destructive" as const, label: "Discontinued" },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {open && (
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Product Master Details
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Product Code</p>
                    <p className="font-medium">{productMaster.product_code}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Product Name</p>
                    <p className="font-medium">{productMaster.product_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Style No</p>
                    <p className="font-medium">{productMaster.style_no || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Category</p>
                    <p className="font-medium">{getCategoryName(productMaster.category_id)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Unit of Measure</p>
                    <p className="font-medium">{productMaster.unit_of_measure}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Base Price</p>
                    <p className="font-medium">
                      {productMaster.base_price 
                        ? `LKR ${productMaster.base_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}` 
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getStatusBadge(productMaster.status)}
                  </div>
                </CardContent>
              </Card>

              {/* Variants Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Variants Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Available Colors</p>
                    <div className="flex flex-wrap gap-2">
                      {productMaster.available_colors.length > 0 ? (
                        productMaster.available_colors.map((color) => (
                          <Badge key={color} variant="outline">
                            {color}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No colors defined</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Available Sizes</p>
                    <div className="flex flex-wrap gap-2">
                      {productMaster.available_sizes.length > 0 ? (
                        productMaster.available_sizes.map((size) => (
                          <Badge key={size} variant="secondary">
                            {size}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No sizes defined</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Existing Variants */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-lg">Existing Variants ({variants.length})</CardTitle>
                  <Button size="sm" onClick={() => setIsGenerateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Generate Variants
                  </Button>
                </CardHeader>
                <CardContent>
                  {variants.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No variants created yet. Click "Generate Variants" to create them.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Variant Code</TableHead>
                          <TableHead>Color</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Current Stock</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {variants.map((variant) => (
                          <TableRow key={variant.id}>
                            <TableCell className="font-medium">
                              {variant.variant_code || variant.product_code}
                            </TableCell>
                            <TableCell>{variant.color || 'N/A'}</TableCell>
                            <TableCell>{variant.size || 'N/A'}</TableCell>
                            <TableCell>{variant.current_stock || 0}</TableCell>
                            <TableCell>
                              <Badge variant={variant.status === 'active' ? 'default' : 'secondary'}>
                                {variant.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {productMaster.description && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{productMaster.description}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>

      <GenerateVariantsDialog
        productMaster={productMaster}
        open={isGenerateDialogOpen}
        onOpenChange={setIsGenerateDialogOpen}
      />
    </>
  );
}
