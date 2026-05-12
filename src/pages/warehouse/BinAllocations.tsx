import { BinAllocationsTab } from '@/components/warehouse/BinAllocationsTab';
import { useRealtimeStockUpdates } from '@/hooks/useRealtimeStockUpdates';

export default function BinAllocations() {
  useRealtimeStockUpdates();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bin Allocations</h1>
        <p className="text-muted-foreground">
          Item-to-bin assignments, on-hand quantities, and QR labels
        </p>
      </div>
      <BinAllocationsTab />
    </div>
  );
}
