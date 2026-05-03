import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  /** @deprecated Stock-by-Location panel only renders locations that physically hold stock. */
  allLocations?: { id: string; name: string }[];
}

export function ItemStockDetailsDialog({
  open,
  onOpenChange,
  item,
  locationStock,
}: ItemStockDetailsDialogProps) {
  if (!item) return null;

  // International WMS standard (SAP EWM / Oracle WMS "Stock by Location"):
  // show only physical locations that currently hold stock for this SKU.
  // Aggregate defensively in case multiple bin rows resolve to the same location.
  const aggregated = new Map<string, { locationId: string; locationName: string; stock: number }>();
  for (const ls of locationStock) {
    if (!ls.locationId) continue;
    const qty = Number(ls.stock) || 0;
    const existing = aggregated.get(ls.locationId);
    if (existing) {
      existing.stock += qty;
    } else {
      aggregated.set(ls.locationId, {
        locationId: ls.locationId,
        locationName: ls.locationName,
        stock: qty,
      });
    }
  }

  const stockedLocations = Array.from(aggregated.values())
    .filter((l) => l.stock > 0)
    .sort((a, b) => b.stock - a.stock || a.locationName.localeCompare(b.locationName));

  const totalStock = stockedLocations.reduce((sum, loc) => sum + loc.stock, 0);
  const isLowStock = totalStock <= (item.reorder_level || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Stock Details
          </DialogTitle>
          <DialogDescription>
            Physical stock on hand at each warehouse location holding this item.
          </DialogDescription>
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
                {stockedLocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                      No stock available in any location for this item
                    </TableCell>
                  </TableRow>
                ) : (
                  stockedLocations.map((loc) => {
                    const percentage = totalStock > 0
                      ? ((loc.stock / totalStock) * 100).toFixed(1)
                      : '0.0';
                    const isLocLow = loc.stock <= (item.reorder_level || 0);

                    return (
                      <TableRow key={loc.locationId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                            <span className="font-medium">{loc.locationName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-medium ${isLocLow ? 'text-destructive' : 'text-green-600'}`}>
                            {loc.stock}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {`${percentage}%`}
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
