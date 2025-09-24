import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, DollarSign, Package } from 'lucide-react';
import { useFinishedGoods } from '@/hooks/useFinishedGoods';
import { Badge } from '@/components/ui/badge';

export function FinishedGoodsValuationTab() {
  const { products, isLoading } = useFinishedGoods();

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

  const totalStockValue = products?.reduce((acc, product) => {
    const stockValue = (product.current_stock || 0) * (product.selling_price || 0);
    return acc + stockValue;
  }, 0) || 0;

  const totalItems = products?.length || 0;
  const totalStock = products?.reduce((acc, product) => acc + (product.current_stock || 0), 0) || 0;
  const lowStockItems = products?.filter(product => 
    (product.current_stock || 0) <= (product.reorder_point || 0)
  ).length || 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Stock Value</p>
                <p className="text-2xl font-bold">LKR {totalStockValue.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{totalItems}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Stock Units</p>
                <p className="text-2xl font-bold">{totalStock}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Low Stock Items</p>
                <p className="text-2xl font-bold">{lowStockItems}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Valuation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Product Valuation Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {products?.map((product) => {
              const stockValue = (product.current_stock || 0) * (product.selling_price || 0);
              const isLowStock = (product.current_stock || 0) <= (product.reorder_point || 0);
              
              return (
                <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{product.product_name}</h4>
                      <Badge variant="outline">{product.product_code}</Badge>
                      {isLowStock && <Badge variant="destructive">Low Stock</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Stock: {product.current_stock || 0} {product.unit_of_measure} | 
                      Unit Price: LKR {(product.selling_price || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">LKR {stockValue.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">Total Value</p>
                  </div>
                </div>
              );
            })}

            {!products || products.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No products available for valuation
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}