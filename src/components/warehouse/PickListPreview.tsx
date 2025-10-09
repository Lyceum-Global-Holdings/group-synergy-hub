import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, MapPin, AlertTriangle } from 'lucide-react';

interface PickListPreviewItem {
  finished_good_id: string;
  item_name: string;
  quantity_to_pick: number;
  location_id?: string;
  bin_id?: string;
  available_stock: number;
  pick_sequence: number;
}

interface PickListPreviewProps {
  items: PickListPreviewItem[];
  totalItems: number;
}

export function PickListPreview({ items, totalItems }: PickListPreviewProps) {
  const hasInsufficientStock = items.some(item => item.available_stock < item.quantity_to_pick);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Pick List Preview</h3>
        <Badge variant="outline">{totalItems} items</Badge>
      </div>

      {hasInsufficientStock && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <p className="text-sm text-destructive">Some items have insufficient stock</p>
        </div>
      )}

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {items.map((item, index) => (
          <Card key={index} className="p-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{item.item_name}</span>
                </div>
                
                {(item.location_id || item.bin_id) && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>
                      {item.location_id && `Location: ${item.location_id}`}
                      {item.location_id && item.bin_id && ' / '}
                      {item.bin_id && `Bin: ${item.bin_id}`}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs">
                  <span>Qty to pick: <strong>{item.quantity_to_pick}</strong></span>
                  <span>Available: <strong>{item.available_stock}</strong></span>
                  <span>Sequence: <strong>#{item.pick_sequence}</strong></span>
                </div>
              </div>

              {item.available_stock < item.quantity_to_pick && (
                <Badge variant="destructive" className="whitespace-nowrap">
                  Short {item.quantity_to_pick - item.available_stock}
                </Badge>
              )}
            </div>
          </Card>
        ))}
      </div>

      {items.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No items to pick
        </div>
      )}
    </div>
  );
}
