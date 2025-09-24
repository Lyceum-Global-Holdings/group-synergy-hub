import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, Filter, Edit, Trash2, Package, TrendingUp, TrendingDown, History, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFinishedGoods } from '@/hooks/useFinishedGoods';
import { CreateFinishedGoodDialog } from './CreateFinishedGoodDialog';
import { EditFinishedGoodDialog } from './EditFinishedGoodDialog';
import { FinishedGoodsMovementDialog } from './FinishedGoodsMovementDialog';
import { FinishedGoodsStockAdjustmentDialog } from './FinishedGoodsStockAdjustmentDialog';
import { useToast } from '@/hooks/use-toast';

export function FinishedGoodsMasterTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [movementDialogProduct, setMovementDialogProduct] = useState<{id: string, name: string, stock: number} | null>(null);
  const [adjustmentDialogProduct, setAdjustmentDialogProduct] = useState<{id: string, name: string, stock: number} | null>(null);
  const { products, isLoading, error, deleteProduct, isDeleting } = useFinishedGoods();
  const { toast } = useToast();

  const filteredProducts = products?.filter(product =>
    product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.product_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.style_no?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this finished good?')) {
      try {
        await deleteProduct(id);
      } catch (error) {
        console.error('Failed to delete product:', error);
      }
    }
  };

  const getStockStatusBadge = (product: any) => {
    const stock = product.current_stock || 0;
    const reorderPoint = product.reorder_point || 0;
    
    if (stock <= 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    } else if (stock <= reorderPoint) {
      return <Badge variant="secondary">Low Stock</Badge>;
    } else {
      return <Badge variant="default">In Stock</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Failed to load finished goods: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Finished Goods Master
            </CardTitle>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by product name, code, or style..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Code</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Style/Size/Color</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Selling Price</TableHead>
                  <TableHead>Stock Actions</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No finished goods found. {searchTerm ? 'Try adjusting your search.' : 'Add your first product to get started.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.product_code}</TableCell>
                      <TableCell>{product.product_name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {product.style_no && <div>Style: {product.style_no}</div>}
                          {product.size && <div>Size: {product.size}</div>}
                          {product.color && <div>Color: {product.color}</div>}
                        </div>
                      </TableCell>
                      <TableCell>{product.category || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{product.current_stock || 0} {product.unit_of_measure}</span>
                          {(product.current_stock || 0) > (product.reorder_point || 0) ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStockStatusBadge(product)}</TableCell>
                      <TableCell>{product.selling_price ? `LKR ${product.selling_price.toFixed(2)}` : '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setMovementDialogProduct({id: product.id, name: product.product_name, stock: product.current_stock})}
                            title="View stock movement history"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" 
                            size="sm"
                            onClick={() => setAdjustmentDialogProduct({id: product.id, name: product.product_name, stock: product.current_stock})}
                            title="Adjust stock"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingProduct(product.id)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(product.id)}
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CreateFinishedGoodDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      {editingProduct && (
        <EditFinishedGoodDialog
          productId={editingProduct}
          open={true}
          onOpenChange={(open) => !open && setEditingProduct(null)}
        />
      )}

      {movementDialogProduct && (
        <FinishedGoodsMovementDialog
          open={!!movementDialogProduct}
          onOpenChange={(open) => !open && setMovementDialogProduct(null)}
          finishedGoodId={movementDialogProduct.id}
          productName={movementDialogProduct.name}
          currentStock={movementDialogProduct.stock}
        />
      )}

      {adjustmentDialogProduct && (
        <FinishedGoodsStockAdjustmentDialog
          open={!!adjustmentDialogProduct}
          onOpenChange={(open) => !open && setAdjustmentDialogProduct(null)}
          finishedGoodId={adjustmentDialogProduct.id}
          productName={adjustmentDialogProduct.name}
          currentStock={adjustmentDialogProduct.stock}
        />
      )}
    </>
  );
}