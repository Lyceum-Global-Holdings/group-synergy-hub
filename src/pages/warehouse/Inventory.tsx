import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRealtimeStockUpdates } from '@/hooks/useRealtimeStockUpdates';

const StockMovementChart = lazy(() =>
  import('@/components/warehouse/StockMovementChart').then(m => ({ default: m.StockMovementChart }))
);

const ItemMasterTab = lazy(() =>
  import('@/components/warehouse/ItemMasterTab').then(m => ({ default: m.ItemMasterTab }))
);

export default function Inventory() {
  useRealtimeStockUpdates();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inventory</h1>
        <p className="text-muted-foreground">
          On-hand stock by item, location and bin
        </p>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading…
          </div>
        }
      >
        <StockMovementChart />
        <ItemMasterTab onGoToAudit={() => navigate('/warehouse/stock-audit')} />
      </Suspense>
    </div>
  );
}
