import { lazy, Suspense, useState } from 'react';
import { Loader2, FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRealtimeStockUpdates } from '@/hooks/useRealtimeStockUpdates';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BulkCatalogToInventoryDialog } from '@/components/warehouse/bulk-catalog-import/BulkCatalogToInventoryDialog';
import { ToolsInventoryOnHand } from '@/components/warehouse/tools/ToolsInventoryOnHand';

const ItemMasterTab = lazy(() =>
  import('@/components/warehouse/ItemMasterTab').then((m) => ({ default: m.ItemMasterTab })),
);

export default function Inventory() {
  useRealtimeStockUpdates();
  const navigate = useNavigate();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [tab, setTab] = useState<'items' | 'tools'>('items');

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">On-hand stock by item, location and bin</p>
        </div>
        {tab === 'items' && (
          <Button onClick={() => setBulkOpen(true)} className="shrink-0">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Bulk add from catalog
          </Button>
        )}
      </div>
      <BulkCatalogToInventoryDialog open={bulkOpen} onOpenChange={setBulkOpen} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'items' | 'tools')}>
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
        </TabsList>
        <TabsContent value="items" className="mt-4">
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
        </TabsContent>
        <TabsContent value="tools" className="mt-4">
          <ToolsInventoryOnHand />
        </TabsContent>
      </Tabs>
    </div>
  );
}
