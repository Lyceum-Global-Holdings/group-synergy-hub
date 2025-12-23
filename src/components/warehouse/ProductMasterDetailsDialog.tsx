import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProductMaster } from "@/hooks/useProductMaster";
import { useItemCategories } from "@/hooks/useItemCategories";
import { format } from "date-fns";

interface ProductMasterDetailsDialogProps {
  product: ProductMaster;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductMasterDetailsDialog({ product, open, onOpenChange }: ProductMasterDetailsDialogProps) {
  const { categories } = useItemCategories();

  const getCategoryName = (categoryId: string | null | undefined) => {
    if (!categoryId) return 'N/A';
    const category = categories?.find(c => c.id === categoryId);
    return category?.name || 'N/A';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Product Master Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Product Code</p>
                  <p className="font-medium">{product.product_code}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Product Name</p>
                  <p className="font-medium">{product.product_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Style No</p>
                  <p className="font-medium">{product.style_no || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="font-medium">{getCategoryName(product.category_id)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unit of Measure</p>
                  <p className="font-medium">{product.unit_of_measure}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                    {product.status}
                  </Badge>
                </div>
              </div>
              {product.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="mt-1">{product.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Available Colors */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Available Colors</CardTitle>
            </CardHeader>
            <CardContent>
              {product.available_colors && product.available_colors.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {product.available_colors.map((color: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 p-2 border rounded">
                      <div
                        className="w-8 h-8 rounded border"
                        style={{ backgroundColor: color.color_code }}
                      />
                      <div>
                        <p className="font-medium text-sm">{color.color_name}</p>
                        <p className="text-xs text-muted-foreground">{color.color_code}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No colors defined</p>
              )}
            </CardContent>
          </Card>

          {/* Available Sizes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Available Sizes</CardTitle>
            </CardHeader>
            <CardContent>
              {product.available_sizes && product.available_sizes.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {product.available_sizes.map((size, idx) => (
                    <Badge key={idx} variant="outline" className="text-base px-4 py-2">
                      {size}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No sizes defined</p>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Created At</p>
                <p className="font-medium">{format(new Date(product.created_at), 'MMM dd, yyyy HH:mm')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Updated At</p>
                <p className="font-medium">{format(new Date(product.updated_at), 'MMM dd, yyyy HH:mm')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
