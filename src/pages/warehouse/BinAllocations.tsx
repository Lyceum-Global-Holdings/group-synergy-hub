import { Link } from 'react-router-dom';
import { ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BinAllocationsTab } from '@/components/warehouse/BinAllocationsTab';
import { useRealtimeStockUpdates } from '@/hooks/useRealtimeStockUpdates';

export default function BinAllocations() {
  useRealtimeStockUpdates();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bin Allocations</h1>
          <p className="text-muted-foreground">
            Item-to-bin assignments, on-hand quantities, and QR labels
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link to="/scan?intent=adjust-stock">
            <ScanLine className="h-4 w-4 mr-2" />
            Scan to adjust stock
          </Link>
        </Button>
      </div>
      <BinAllocationsTab />
    </div>
  );
}
