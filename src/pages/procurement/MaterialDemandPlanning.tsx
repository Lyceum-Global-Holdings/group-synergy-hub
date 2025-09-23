import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar, Calculator, FileText, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { useMaterialDemand, useDemandCalculation } from '@/hooks/useMaterialDemand';
import { useBillOfMaterials } from '@/hooks/useBillOfMaterials';
import { useCompany } from '@/contexts/CompanyContext';
import { format } from 'date-fns';
import { DemandPriority } from '@/types/materialDemand';

const MaterialDemandPlanning = () => {
  const { selectedCompany } = useCompany();
  const { demands, isLoading } = useMaterialDemand(selectedCompany?.id);
  const { boms } = useBillOfMaterials(selectedCompany?.id);
  const { calculateBOMDemand, calculationResult, isCalculating } = useDemandCalculation();
  
  const [selectedBomId, setSelectedBomId] = useState<string>('');
  const [productionQuantity, setProductionQuantity] = useState<number>(100);
  const [productionDate, setProductionDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );

  const handleCalculateDemand = () => {
    if (!selectedBomId) return;
    
    calculateBOMDemand({
      bom_id: selectedBomId,
      production_quantity: productionQuantity,
      production_date: productionDate,
      include_safety_stock: true
    });
  };

  const getPriorityColor = (priority: DemandPriority) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'secondary';
      case 'medium': return 'outline';
      case 'low': return 'default';
      default: return 'outline';
    }
  };

  const getStatusIcon = (shortage: number) => {
    if (shortage > 0) return <AlertTriangle className="h-4 w-4 text-destructive" />;
    return <CheckCircle className="h-4 w-4 text-success" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Material Demand Planning</h1>
          <p className="text-muted-foreground">
            Calculate material requirements based on BOMs and optimize purchasing decisions
          </p>
        </div>
      </div>

      <Tabs defaultValue="calculation" className="space-y-6">
        <TabsList>
          <TabsTrigger value="calculation" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Demand Calculation
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Demand Analysis
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            MRP Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calculation">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Production Requirements
                </CardTitle>
                <CardDescription>
                  Select a BOM and production parameters to calculate material demand
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bom-select">Bill of Materials</Label>
                  <Select value={selectedBomId} onValueChange={setSelectedBomId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a BOM" />
                    </SelectTrigger>
                    <SelectContent>
                      {boms?.map((bom) => (
                        <SelectItem key={bom.id} value={bom.id}>
                          {bom.bom_number} - {bom.product_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Production Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={productionQuantity}
                    onChange={(e) => setProductionQuantity(Number(e.target.value))}
                    placeholder="Enter production quantity"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Production Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={productionDate}
                    onChange={(e) => setProductionDate(e.target.value)}
                  />
                </div>

                <Button 
                  onClick={handleCalculateDemand}
                  disabled={!selectedBomId || isCalculating}
                  className="w-full"
                >
                  {isCalculating ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Calculator className="h-4 w-4 mr-2" />
                      Calculate Material Demand
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {boms?.length || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Active BOMs</div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-secondary">
                      {demands?.length || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Demand Records</div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-accent">
                      {calculationResult?.length || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Items Analyzed</div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-destructive">
                      {calculationResult?.filter(r => r.shortage > 0).length || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Items in Shortage</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {calculationResult && calculationResult.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Material Demand Analysis Results</CardTitle>
                <CardDescription>
                  Material requirements based on your production parameters
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Required</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>On Order</TableHead>
                      <TableHead>Shortage</TableHead>
                      <TableHead>Suggested Order</TableHead>
                      <TableHead>Priority</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calculationResult.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{getStatusIcon(item.shortage)}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {item.item_code}
                        </TableCell>
                        <TableCell>{item.item_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.category || 'N/A'}</Badge>
                        </TableCell>
                        <TableCell>{item.total_required} {item.unit_of_measure}</TableCell>
                        <TableCell>{item.available_stock} {item.unit_of_measure}</TableCell>
                        <TableCell>{item.on_order} {item.unit_of_measure}</TableCell>
                        <TableCell className={item.shortage > 0 ? 'text-destructive font-medium' : ''}>
                          {item.shortage} {item.unit_of_measure}
                        </TableCell>
                        <TableCell className={item.suggested_order > 0 ? 'text-primary font-medium' : ''}>
                          {item.suggested_order} {item.unit_of_measure}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getPriorityColor(item.priority)}>
                            {item.priority}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analysis">
          <Card>
            <CardHeader>
              <CardTitle>Demand Analysis Dashboard</CardTitle>
              <CardDescription>
                Comprehensive view of material demand across all BOMs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Advanced demand analysis features coming soon</p>
                <p className="text-sm">This will include trend analysis, forecasting, and optimization recommendations</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>MRP Reports</CardTitle>
              <CardDescription>
                Generate comprehensive Material Requirement Planning reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>MRP reporting functionality coming soon</p>
                <p className="text-sm">This will include detailed reports, export options, and scheduling tools</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MaterialDemandPlanning;