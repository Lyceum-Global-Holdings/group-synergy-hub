import { Suspense, lazy, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, MapPin, Tag, Ruler, Grid3x3, ShieldAlert, ClipboardList, Loader2 } from 'lucide-react';
import { useRealtimeStockUpdates } from '@/hooks/useRealtimeStockUpdates';

// Lazy-load every tab so only the active tab's chunk + data fetches load.
// Each tab pulls in dozens of dialog components; deferring them shrinks the
// initial route chunk dramatically.
const ItemMasterDefinitionTab = lazy(() =>
  import('@/components/warehouse/ItemMasterDefinitionTab').then(m => ({ default: m.ItemMasterDefinitionTab }))
);
const ItemMasterTab = lazy(() =>
  import('@/components/warehouse/ItemMasterTab').then(m => ({ default: m.ItemMasterTab }))
);
const BinMasterTab = lazy(() =>
  import('@/components/warehouse/BinMasterTab').then(m => ({ default: m.BinMasterTab }))
);
const BinAllocationsTab = lazy(() =>
  import('@/components/warehouse/BinAllocationsTab').then(m => ({ default: m.BinAllocationsTab }))
);
const ItemCategoriesTab = lazy(() =>
  import('@/components/warehouse/ItemCategoriesTab').then(m => ({ default: m.ItemCategoriesTab }))
);
const ItemUnitsTab = lazy(() =>
  import('@/components/warehouse/ItemUnitsTab').then(m => ({ default: m.ItemUnitsTab }))
);
const StockAuditTab = lazy(() =>
  import('@/components/warehouse/StockAuditTab').then(m => ({ default: m.StockAuditTab }))
);

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" />
      Loading…
    </div>
  );
}

export default function ItemBinMaster() {
  useRealtimeStockUpdates();
  const [activeTab, setActiveTab] = useState('item-master');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Warehouse Management</h1>
          <p className="text-muted-foreground">
            Manage item catalog, inventory, storage bins, categories, and units
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="item-master" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Item Master
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="bins" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Bin Master
          </TabsTrigger>
          <TabsTrigger value="allocations" className="flex items-center gap-2">
            <Grid3x3 className="h-4 w-4" />
            Bin Allocations
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="units" className="flex items-center gap-2">
            <Ruler className="h-4 w-4" />
            Units
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Stock Audit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="item-master">
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'item-master' && (
              <ItemMasterDefinitionTab
                onNavigateToInventory={() => setActiveTab('inventory')}
                onNavigateToBins={() => setActiveTab('allocations')}
              />
            )}
          </Suspense>
        </TabsContent>

        <TabsContent value="inventory">
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'inventory' && (
              <ItemMasterTab onGoToAudit={() => setActiveTab('audit')} />
            )}
          </Suspense>
        </TabsContent>

        <TabsContent value="bins">
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'bins' && <BinMasterTab />}
          </Suspense>
        </TabsContent>

        <TabsContent value="allocations">
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'allocations' && <BinAllocationsTab />}
          </Suspense>
        </TabsContent>

        <TabsContent value="categories">
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'categories' && <ItemCategoriesTab />}
          </Suspense>
        </TabsContent>

        <TabsContent value="units">
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'units' && <ItemUnitsTab />}
          </Suspense>
        </TabsContent>

        <TabsContent value="audit">
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'audit' && <StockAuditTab />}
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
