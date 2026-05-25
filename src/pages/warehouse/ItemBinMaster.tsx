import { Suspense, lazy, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { MapPin, Tag, Ruler, ClipboardList, Loader2, ScanLine } from 'lucide-react';
import { useRealtimeStockUpdates } from '@/hooks/useRealtimeStockUpdates';

// Lazy-load every tab so only the active tab's chunk + data fetches load.
const ItemMasterDefinitionTab = lazy(() =>
  import('@/components/warehouse/ItemMasterDefinitionTab').then(m => ({ default: m.ItemMasterDefinitionTab }))
);
const BinMasterTab = lazy(() =>
  import('@/components/warehouse/BinMasterTab').then(m => ({ default: m.BinMasterTab }))
);
const ItemCategoriesTab = lazy(() =>
  import('@/components/warehouse/ItemCategoriesTab').then(m => ({ default: m.ItemCategoriesTab }))
);
const ItemUnitsTab = lazy(() =>
  import('@/components/warehouse/ItemUnitsTab').then(m => ({ default: m.ItemUnitsTab }))
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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('item-master');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Item &amp; Bin Master</h1>
          <p className="text-muted-foreground">
            Manage item catalog, storage bins, categories, and units
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link to="/scan?intent=adjust-stock">
            <ScanLine className="h-4 w-4 mr-2" />
            Scan to adjust stock
          </Link>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="item-master" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Item Master
          </TabsTrigger>
          <TabsTrigger value="bins" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Bin Master
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="units" className="flex items-center gap-2">
            <Ruler className="h-4 w-4" />
            Units
          </TabsTrigger>
        </TabsList>

        <TabsContent value="item-master">
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'item-master' && (
              <ItemMasterDefinitionTab
                onNavigateToInventory={() => navigate('/warehouse/inventory')}
                onNavigateToBins={() => navigate('/warehouse/bin-allocations')}
              />
            )}
          </Suspense>
        </TabsContent>

        <TabsContent value="bins">
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'bins' && <BinMasterTab />}
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
      </Tabs>
    </div>
  );
}
