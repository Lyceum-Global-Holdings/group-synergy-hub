import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, MapPin, Tag, Ruler, Grid3x3, ShieldAlert, ClipboardList } from 'lucide-react';
import { ItemMasterTab } from '@/components/warehouse/ItemMasterTab';
import { BinMasterTab } from '@/components/warehouse/BinMasterTab';
import { ItemCategoriesTab } from '@/components/warehouse/ItemCategoriesTab';
import { ItemUnitsTab } from '@/components/warehouse/ItemUnitsTab';
import { BinAllocationsTab } from '@/components/warehouse/BinAllocationsTab';
import { StockAuditTab } from '@/components/warehouse/StockAuditTab';
import { ItemMasterDefinitionTab } from '@/components/warehouse/ItemMasterDefinitionTab';
import { useRealtimeStockUpdates } from '@/hooks/useRealtimeStockUpdates';

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
          <ItemMasterDefinitionTab
            onNavigateToInventory={() => setActiveTab('inventory')}
            onNavigateToBins={() => setActiveTab('allocations')}
          />
        </TabsContent>

        <TabsContent value="inventory">
          <ItemMasterTab onGoToAudit={() => setActiveTab('audit')} />
        </TabsContent>

        <TabsContent value="bins">
          <BinMasterTab />
        </TabsContent>

        <TabsContent value="allocations">
          <BinAllocationsTab />
        </TabsContent>

        <TabsContent value="categories">
          <ItemCategoriesTab />
        </TabsContent>

        <TabsContent value="units">
          <ItemUnitsTab />
        </TabsContent>

        <TabsContent value="audit">
          <StockAuditTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
