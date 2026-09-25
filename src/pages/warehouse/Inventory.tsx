import { lazy, Suspense, useState } from 'react';
import { Loader2, FileSpreadsheet, PackageCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRealtimeStockUpdates } from '@/hooks/useRealtimeStockUpdates';
import { Button } from '@/components/ui/button';
import { useLocationFilter } from '@/contexts/LocationFilterContext';
import { HERO_GRADIENT } from '@/components/dashboard/DashCard';
import { cn } from '@/lib/utils';

const ItemMasterTab = lazy(() =>
  import('@/components/warehouse/ItemMasterTab').then((m) => ({ default: m.ItemMasterTab })),
);
const BulkCatalogToInventoryDialog = lazy(() =>
  import('@/components/warehouse/bulk-catalog-import/BulkCatalogToInventoryDialog').then((m) => ({
    default: m.BulkCatalogToInventoryDialog,
  })),
);
const BulkIssueFromInventoryDialog = lazy(() =>
  import('@/components/warehouse/BulkIssueFromInventoryDialog').then((m) => ({
    default: m.BulkIssueFromInventoryDialog,
  })),
);

export default function Inventory() {
  useRealtimeStockUpdates();
  const navigate = useNavigate();
  const { globalLocationId } = useLocationFilter();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkIssueOpen, setBulkIssueOpen] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            On-hand stock by item, location and bin. Tools appear here as items with type "Tool".
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-10 rounded-full border-border/70 bg-card px-5" onClick={() => setBulkIssueOpen(true)}>
            <PackageCheck className="mr-2 h-4 w-4" />
            Bulk issue
          </Button>
          <Button
            className={cn(HERO_GRADIENT, "h-10 rounded-full px-5 text-white shadow-lg shadow-primary/25 hover:brightness-110")}
            onClick={() => setBulkOpen(true)}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Bulk add from catalog</span>
            <span className="sm:hidden">Add from catalog</span>
          </Button>
        </div>
      </div>
      {bulkOpen && (
        <Suspense fallback={null}>
          <BulkCatalogToInventoryDialog open={bulkOpen} onOpenChange={setBulkOpen} />
        </Suspense>
      )}
      {bulkIssueOpen && (
        <Suspense fallback={null}>
          <BulkIssueFromInventoryDialog
            open={bulkIssueOpen}
            onOpenChange={setBulkIssueOpen}
            selectedItems={[]}
            defaultLocationId={globalLocationId || null}
          />
        </Suspense>
      )}

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
    </div>
  );
}
