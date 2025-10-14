import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Factory, TrendingUp, BarChart3, Archive, ArrowRight, Workflow, Boxes } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductMasterTab } from '@/components/warehouse/ProductMasterTab';
import { FinishedGoodsMasterTab } from '@/components/warehouse/FinishedGoodsMasterTab';
import { ProductionReceiptTab } from '@/components/warehouse/ProductionReceiptTab';
import { DemandOverviewTab } from '@/components/warehouse/DemandOverviewTab';
import { FinishedGoodsValuationTab } from '@/components/warehouse/FinishedGoodsValuationTab';
import { FinishedGoodsBatchTab } from '@/components/warehouse/FinishedGoodsBatchTab';
import { ProductionToFulfillmentFlow } from '@/components/warehouse/ProductionToFulfillmentFlow';
import { useNavigate } from 'react-router-dom';

export default function FinishedGoods() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Finished Goods Management</h1>
          <p className="text-muted-foreground">
            Manage finished goods inventory, production receipts, and sales demand
          </p>
        </div>
        <Button onClick={() => navigate('/warehouse/pick-pack')} variant="outline">
          <Package className="h-4 w-4 mr-2" />
          Fulfill Orders
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {/* Workflow Integration */}
      <ProductionToFulfillmentFlow />

      <Tabs defaultValue="master" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="master" className="flex items-center gap-2">
            <Boxes className="h-4 w-4" />
            Product Master
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Product List
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
            Demand Overview
          </TabsTrigger>
          <TabsTrigger value="valuation" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Valuation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="master">
          <ProductMasterTab />
        </TabsContent>

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
          <DemandOverviewTab />
        </TabsContent>

        <TabsContent value="valuation">
          <FinishedGoodsValuationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}