import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useFinishedGoods } from "@/hooks/useFinishedGoods";
import { useBomFinishedGoodsLinks } from "@/hooks/useBomFinishedGoodsLinks";
import { Loader2, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BulkLinkProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bomId: string;
  productMasterId: string;
  companyId?: string;
}

export function BulkLinkProductsDialog({
  open,
  onOpenChange,
  bomId,
  productMasterId,
  companyId
}: BulkLinkProductsDialogProps) {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  
  const { products, isLoading: loadingProducts } = useFinishedGoods(companyId);
  const { linkedProducts, bulkLinkFinishedGoods, isLinking } = useBomFinishedGoodsLinks(bomId);

  // Filter products by product master and exclude already linked ones
  const availableProducts = (products || []).filter(fg => {
    const matchesProductMaster = fg.product_master_id === productMasterId;
    const alreadyLinked = linkedProducts.some(
      (link: any) => link.finished_good_id === fg.id
    );
    return matchesProductMaster && !alreadyLinked;
  });

  const handleToggleProduct = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === availableProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(availableProducts.map(p => p.id));
    }
  };

  const handleSubmit = async () => {
    if (selectedProducts.length === 0) return;

    try {
      await bulkLinkFinishedGoods({
        bomId,
        finishedGoodIds: selectedProducts
      });
      setSelectedProducts([]);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to link products:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link Products to BOM</DialogTitle>
          <DialogDescription>
            Select finished goods from this product master to link to the BOM
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loadingProducts ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : availableProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                No available products to link. All variants may already be linked.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {selectedProducts.length} of {availableProducts.length} selected
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedProducts.length === availableProducts.length ? "Deselect All" : "Select All"}
                </Button>
              </div>

              <ScrollArea className="h-[400px] rounded-md border">
                <div className="p-4 space-y-2">
                  {availableProducts.map(product => (
                    <div
                      key={product.id}
                      className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent cursor-pointer"
                      onClick={() => handleToggleProduct(product.id)}
                    >
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={() => handleToggleProduct(product.id)}
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{product.product_code}</span>
                          <span className="text-sm text-muted-foreground">
                            {product.product_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {product.size && (
                            <Badge variant="outline" className="text-xs">
                              Size: {product.size}
                            </Badge>
                          )}
                          {product.color && (
                            <Badge variant="outline" className="text-xs">
                              Color: {product.color}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLinking}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedProducts.length === 0 || isLinking}
          >
            {isLinking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Link {selectedProducts.length > 0 && `(${selectedProducts.length})`} Products
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
