import { lazy, Suspense, useState } from 'react';
import { Loader2, FileSpreadsheet, PackageCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRealtimeStockUpdates } from '@/hooks/useRealtimeStockUpdates';
import { Button } from '@/components/ui/button';
import { useLocationFilter } from '@/contexts/LocationFilterContext';

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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">
            On-hand stock by item, location and bin. Tools appear here as items with type "Tool".
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={() => setBulkIssueOpen(true)}>
            <PackageCheck className="h-4 w-4 mr-2" />
            Bulk Issue
          </Button>
          <Button onClick={() => setBulkOpen(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Bulk add from catalog
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
