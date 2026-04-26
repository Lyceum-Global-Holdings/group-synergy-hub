import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Package, TrendingUp, FileText, Camera, Settings, Clock, FileBarChart } from 'lucide-react';
import { ValuationDashboard } from '@/components/warehouse/valuation/ValuationDashboard';
import { DetailedValuationTable } from '@/components/warehouse/valuation/DetailedValuationTable';
import { ValuationMethodsManager } from '@/components/warehouse/valuation/ValuationMethodsManager';
import { AgingAnalysisTab } from '@/components/warehouse/valuation/AgingAnalysisTab';
import { MovementAnalysisTab } from '@/components/warehouse/valuation/MovementAnalysisTab';
import { SnapshotManager } from '@/components/warehouse/valuation/SnapshotManager';
import { ValuationReportsTab } from '@/components/warehouse/valuation/ValuationReportsTab';
import { ValuationFilters } from '@/types/inventoryValuation';

export default function InventoryValuation() {
  const [filters, setFilters] = useState<ValuationFilters>({});

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inventory Valuation</h1>
            <p className="text-muted-foreground">
              Comprehensive inventory valuation and analysis
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/management/reports?template=WH-INV-VAL-001">
              <FileBarChart className="mr-2 h-4 w-4" />
              Generate Report
            </Link>
          </Button>
        </div>


        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 lg:w-auto">
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="detailed" className="gap-2">
              <Package className="h-4 w-4" />
              Detailed
            </TabsTrigger>
            <TabsTrigger value="methods" className="gap-2">
              <Settings className="h-4 w-4" />
              Methods
            </TabsTrigger>
            <TabsTrigger value="aging" className="gap-2">
              <Clock className="h-4 w-4" />
              Aging
            </TabsTrigger>
            <TabsTrigger value="movements" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Movements
            </TabsTrigger>
            <TabsTrigger value="snapshots" className="gap-2">
              <Camera className="h-4 w-4" />
              Snapshots
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <FileText className="h-4 w-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <ValuationDashboard filters={filters} onFiltersChange={setFilters} />
          </TabsContent>

          <TabsContent value="detailed" className="space-y-4">
            <DetailedValuationTable filters={filters} onFiltersChange={setFilters} />
          </TabsContent>

          <TabsContent value="methods" className="space-y-4">
            <ValuationMethodsManager />
          </TabsContent>

          <TabsContent value="aging" className="space-y-4">
            <AgingAnalysisTab filters={filters} />
          </TabsContent>

          <TabsContent value="movements" className="space-y-4">
            <MovementAnalysisTab filters={filters} />
          </TabsContent>

          <TabsContent value="snapshots" className="space-y-4">
            <SnapshotManager />
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <ValuationReportsTab />
          </TabsContent>
        </Tabs>
      </div>
  );
}
