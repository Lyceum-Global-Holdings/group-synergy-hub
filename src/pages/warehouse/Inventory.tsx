import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRealtimeStockUpdates } from '@/hooks/useRealtimeStockUpdates';

const StockMovementChart = lazy(() =>
  import('@/components/warehouse/StockMovementChart').then(m => ({ default: m.StockMovementChart }))
);

const ItemMasterTab = lazy(() =>
  import('@/components/warehouse/ItemMasterTab').then(m => ({ default: m.ItemMasterTab }))
);

/**
 * Defers mounting the stock-movement analytics chart until it's about to
 * scroll into view. Recharts + 30-day query are not above-the-fold critical.
 */
function DeferredStockMovementChart() {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [show]);

  return (
    <div ref={ref} className="min-h-[120px]">
      {show ? (
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading chart…
            </div>
          }
        >
          <StockMovementChart />
        </Suspense>
      ) : null}
    </div>
  );
}

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
        <ItemMasterTab onGoToAudit={() => navigate('/warehouse/stock-audit')} />
      </Suspense>

      <DeferredStockMovementChart />
    </div>
  );
}
