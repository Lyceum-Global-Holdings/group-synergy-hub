import { Suspense, lazy } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { MapPin, Tag, Ruler, ClipboardList, Loader2, ScanLine } from 'lucide-react';
import { useRealtimeStockUpdates } from '@/hooks/useRealtimeStockUpdates';
import { HERO_GRADIENT } from '@/components/dashboard/DashCard';
import { cn } from '@/lib/utils';

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
    <div className="flex items-center justify-center rounded-2xl border border-border/60 bg-card py-16 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" />
      Loading…
    </div>
  );
}

const TABS = [
  { value: 'item-master', label: 'Item Master', hint: 'Catalogue of every item', icon: ClipboardList },
  { value: 'bins', label: 'Bin Master', hint: 'Storage bins per warehouse', icon: MapPin },
  { value: 'categories', label: 'Categories', hint: 'Groups and sub-groups', icon: Tag },
  { value: 'units', label: 'Units', hint: 'Units of measure', icon: Ruler },
] as const;
type TabValue = (typeof TABS)[number]['value'];

export default function ItemBinMaster() {
  useRealtimeStockUpdates();
  const navigate = useNavigate();
  // Active tab lives in the URL (?tab=bins) so links and refreshes keep it.
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const activeTab: TabValue = TABS.some((t) => t.value === requested) ? (requested as TabValue) : 'item-master';
  const setActiveTab = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v === 'item-master') next.delete('tab');
    else next.set('tab', v);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Item &amp; Bin Master</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the item catalogue, storage bins, categories and units.
          </p>
        </div>
        <Button
          asChild
          className={cn(HERO_GRADIENT, 'h-10 w-full rounded-full px-5 text-white shadow-lg shadow-primary/25 hover:brightness-110 sm:w-auto')}
        >
          <Link to="/scan?intent=adjust-stock">
            <ScanLine className="h-4 w-4 mr-2" />
            Scan to adjust stock
          </Link>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl border border-border/60 bg-card p-1.5 shadow-[var(--shadow-xs)] lg:grid-cols-4">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="group h-auto justify-start gap-3 rounded-xl px-3 py-2.5 text-left after:hidden hover:bg-muted/50 data-[state=active]:bg-primary/[0.07] data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground">
                <t.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{t.label}</span>
                <span className="hidden truncate text-xs font-normal text-muted-foreground lg:block">{t.hint}</span>
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="item-master" className="mt-0">
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'item-master' && (
              <ItemMasterDefinitionTab
                onNavigateToInventory={() => navigate('/warehouse/inventory')}
                onNavigateToBins={() => navigate('/warehouse/bin-allocations')}
              />
            )}
          </Suspense>
        </TabsContent>

        <TabsContent value="bins" className="mt-0">
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'bins' && <BinMasterTab />}
          </Suspense>
        </TabsContent>

        <TabsContent value="categories" className="mt-0">
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'categories' && <ItemCategoriesTab />}
          </Suspense>
        </TabsContent>

        <TabsContent value="units" className="mt-0">
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'units' && <ItemUnitsTab />}
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
