import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useRealtimeStockUpdates } from '@/hooks/useRealtimeStockUpdates';

const StockAuditTab = lazy(() =>
  import('@/components/warehouse/StockAuditTab').then(m => ({ default: m.StockAuditTab }))
);

export default function StockAudit() {
  useRealtimeStockUpdates();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Stock Audit</h1>
        <p className="text-muted-foreground">
          Reconcile on-hand quantities with the stock ledger
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
        <StockAuditTab />
      </Suspense>
    </div>
  );
}
