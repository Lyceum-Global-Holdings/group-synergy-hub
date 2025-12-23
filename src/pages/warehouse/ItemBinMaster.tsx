import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, MapPin, Tag, Ruler, Grid3x3 } from 'lucide-react';
import { ItemMasterTab } from '@/components/warehouse/ItemMasterTab';
import { BinMasterTab } from '@/components/warehouse/BinMasterTab';
import { ItemCategoriesTab } from '@/components/warehouse/ItemCategoriesTab';
import { ItemUnitsTab } from '@/components/warehouse/ItemUnitsTab';
import { BinAllocationsTab } from '@/components/warehouse/BinAllocationsTab';
import { useRealtimeStockUpdates } from '@/hooks/useRealtimeStockUpdates';

export default function ItemBinMaster() {
  // Enable real-time stock updates
  useRealtimeStockUpdates();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Item & Bin Master</h1>
          <p className="text-muted-foreground">
            Manage warehouse items, storage bins, categories, and units
          </p>
        </div>
      </div>


      <Tabs defaultValue="items" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="items" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Item Master
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
        </TabsList>

        <TabsContent value="items">
          <ItemMasterTab />
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
      </Tabs>
    </div>
  );
}