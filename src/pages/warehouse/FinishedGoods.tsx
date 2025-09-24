import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Factory, TrendingUp, BarChart3, Archive } from 'lucide-react';
import { FinishedGoodsMasterTab } from '@/components/warehouse/FinishedGoodsMasterTab';
import { ProductionReceiptTab } from '@/components/warehouse/ProductionReceiptTab';
import { SalesOrderFulfillmentTab } from '@/components/warehouse/SalesOrderFulfillmentTab';
import { FinishedGoodsValuationTab } from '@/components/warehouse/FinishedGoodsValuationTab';
import { FinishedGoodsBatchTab } from '@/components/warehouse/FinishedGoodsBatchTab';

export default function FinishedGoods() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Finished Goods Management</h1>
          <p className="text-muted-foreground">
            Manage finished goods inventory, production receipts, and sales fulfillment
          </p>
        </div>
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Product Master
          </TabsTrigger>
          <TabsTrigger value="production" className="flex items-center gap-2">
            <Factory className="h-4 w-4" />
            Production Receipt
          </TabsTrigger>
          <TabsTrigger value="batches" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Batch Management
          </TabsTrigger>
          <TabsTrigger value="fulfillment" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Sales Fulfillment
          </TabsTrigger>
          <TabsTrigger value="valuation" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Valuation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <FinishedGoodsMasterTab />
        </TabsContent>

        <TabsContent value="production">
          <ProductionReceiptTab />
        </TabsContent>

        <TabsContent value="batches">
          <FinishedGoodsBatchTab />
        </TabsContent>

        <TabsContent value="fulfillment">
          <SalesOrderFulfillmentTab />
        </TabsContent>

        <TabsContent value="valuation">
          <FinishedGoodsValuationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}