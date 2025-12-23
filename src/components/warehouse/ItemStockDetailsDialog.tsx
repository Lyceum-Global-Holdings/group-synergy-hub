import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MapPin, Package, AlertTriangle } from 'lucide-react';
import { WarehouseItem } from '@/types/itemBin';

interface LocationStock {
  locationId: string;
  locationName: string;
  stock: number;
}

interface ItemStockDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: WarehouseItem | null;
  locationStock: LocationStock[];
  allLocations: { id: string; name: string }[];
}

export function ItemStockDetailsDialog({
  open,
  onOpenChange,
  item,
  locationStock,
  allLocations,
}: ItemStockDetailsDialogProps) {
  if (!item) return null;

  const totalStock = locationStock.reduce((sum, loc) => sum + loc.stock, 0);
  const isLowStock = totalStock <= (item.reorder_level || 0);

  // Merge all locations with their stock (0 if no stock)
  const allLocationsWithStock = allLocations.map((location) => {
    const stockInfo = locationStock.find((ls) => ls.locationId === location.id);
    return {
      locationId: location.id,
      locationName: location.name,
      stock: stockInfo?.stock || 0,
    };
  });

  // Sort: locations with stock first, then alphabetically
  allLocationsWithStock.sort((a, b) => {
    if (a.stock > 0 && b.stock === 0) return -1;
    if (a.stock === 0 && b.stock > 0) return 1;
    return a.locationName.localeCompare(b.locationName);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Stock Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item Info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{item.name}</span>
              <Badge variant="outline">{item.item_code}</Badge>
            </div>
            {item.brand && (
              <p className="text-xs text-muted-foreground">Brand: {item.brand}</p>
            )}
          </div>

          {/* Stock Summary */}
          <div className="flex items-center justify-between p-3 bg-card border rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Total Stock</span>
              {isLowStock && (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              )}
            </div>
            <span className={`text-lg font-bold ${isLowStock ? 'text-destructive' : 'text-green-600'}`}>
              {totalStock}
            </span>
          </div>

          {/* Stock by Location Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allLocationsWithStock.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                      No warehouse locations found
                    </TableCell>
                  </TableRow>
                ) : (
                  allLocationsWithStock.map((loc) => {
                    const percentage = totalStock > 0 
                      ? ((loc.stock / totalStock) * 100).toFixed(1) 
                      : '0.0';
                    const hasStock = loc.stock > 0;
                    
                    return (
                      <TableRow 
                        key={loc.locationId}
                        className={!hasStock ? 'opacity-50' : ''}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className={`h-3.5 w-3.5 ${hasStock ? 'text-primary' : 'text-muted-foreground'}`} />
                            <span className={hasStock ? 'font-medium' : ''}>{loc.locationName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-medium ${
                            hasStock 
                              ? loc.stock <= (item.reorder_level || 0) 
                                ? 'text-destructive' 
                                : 'text-green-600'
                              : 'text-muted-foreground'
                          }`}>
                            {loc.stock}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {hasStock ? `${percentage}%` : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Reorder Level Info */}
          {item.reorder_level && (
            <p className="text-xs text-muted-foreground text-center">
              Reorder Level: {item.reorder_level} | Min Stock: {item.min_stock_level || 0}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
