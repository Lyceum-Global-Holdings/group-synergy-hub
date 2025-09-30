import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Calculator, FileText, AlertTriangle, CheckCircle, Clock, TrendingUp, Package, Box, ShoppingCart } from 'lucide-react';
import { useMaterialDemand, useDemandCalculation } from '@/hooks/useMaterialDemand';
import { useBillOfMaterials } from '@/hooks/useBillOfMaterials';
import { useCustomerPurchaseOrders } from '@/hooks/useCustomerPurchaseOrders';
import { usePurchaseRequisitions, useCreatePurchaseRequisition } from '@/hooks/usePurchaseRequisitions';
import { useCompany } from '@/contexts/CompanyContext';
import { format } from 'date-fns';
import { DemandPriority, DemandSource } from '@/types/materialDemand';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const MaterialDemandPlanning = () => {
  const { selectedCompany } = useCompany();
  const { demands, isLoading } = useMaterialDemand(selectedCompany?.id);
  const { boms } = useBillOfMaterials(selectedCompany?.id);
  const { customerPOs } = useCustomerPurchaseOrders(selectedCompany?.id);
  const { data: purchaseRequisitions } = usePurchaseRequisitions();
  const { calculateBOMDemand, calculateCPODemand, calculationResult, isCalculating } = useDemandCalculation(selectedCompany?.id);
  const createPrMutation = useCreatePurchaseRequisition();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [demandSource, setDemandSource] = useState<DemandSource>('bom');
  const [selectedBomId, setSelectedBomId] = useState<string>('');
  const [selectedCPOs, setSelectedCPOs] = useState<string[]>([]);
  const [productionQuantity, setProductionQuantity] = useState<number>(100);
  const [productionDate, setProductionDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [multiplier, setMultiplier] = useState<string>('1');
  const [analysisDate, setAnalysisDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // Filter confirmed CPOs for CPO-based demand calculation
  const confirmedCPOs = customerPOs?.filter(cpo => cpo.status === 'confirmed') || [];

  const handleCalculateDemand = () => {
    if (demandSource === 'bom') {
      if (!selectedBomId) return;
      
      calculateBOMDemand({
        bom_id: selectedBomId,
        production_quantity: productionQuantity,
        production_date: productionDate,
        include_safety_stock: true
      });
    } else if (demandSource === 'customer_po') {
      if (selectedCPOs.length === 0) return;

      calculateCPODemand({
        cpo_ids: selectedCPOs,
        multiplier: parseFloat(multiplier),
        analysis_date: analysisDate,
        include_safety_stock: true
      });
    }
  };

  const handleCPOSelection = (cpoId: string, checked: boolean) => {
    if (checked) {
      setSelectedCPOs(prev => [...prev, cpoId]);
    } else {
      setSelectedCPOs(prev => prev.filter(id => id !== cpoId));
    }
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

  // Get related Customer POs for selected BOM
  const getRelatedCPOs = (bomId: string) => {
    if (!bomId || !customerPOs) return [];
    
    const selectedBom = boms?.find(bom => bom.id === bomId);
    if (!selectedBom) return [];

    // Find CPOs that could be related to this BOM through finished goods
    return customerPOs.filter(cpo => {
      return ['confirmed', 'in_production'].includes(cpo.status);
    });
  };

  // Generate PR from BOM materials with shortage
  const handleGeneratePR = () => {
    if (!calculationResult || calculationResult.length === 0) return;

    // Filter BOM materials with shortage
    const bomMaterialsWithShortage = calculationResult.filter(
      item => item.category === 'BOM Material' && item.shortage > 0
    );

    if (bomMaterialsWithShortage.length === 0) {
      toast({
        title: "No items to requisition",
        description: "All BOM materials are sufficiently stocked.",
        variant: "default",
      });
      return;
    }

    // Determine highest priority
    const priorities: DemandPriority[] = ['urgent', 'high', 'medium', 'low'];
    const highestPriority = priorities.find(p => 
      bomMaterialsWithShortage.some(item => item.priority === p)
    ) || 'medium';

    // Prepare PR title and description
    const selectedBom = boms?.find(bom => bom.id === selectedBomId);
    const prTitle = demandSource === 'bom' && selectedBom
      ? `Material Requisition for BOM ${selectedBom.bom_number}`
      : `Material Requisition for CPO Analysis ${format(new Date(), 'MMM dd, yyyy')}`;
    
    const prDescription = `Auto-generated from Material Demand Planning. ${bomMaterialsWithShortage.length} BOM materials with shortage. Total required materials: ${calculationResult.length}.`;

    // Map to PR items format
    const prItems = bomMaterialsWithShortage.map(item => ({
      warehouse_item_id: undefined,
      finished_good_id: undefined,
      item_code: item.item_code,
      item_name: item.item_name,
      description: item.bom_info ? `BOM: ${item.bom_info.bom_number} - ${item.bom_info.product_name}` : '',
      quantity: item.suggested_order,
      unit_of_measure: item.unit_of_measure,
      estimated_unit_price: item.supplier_info?.last_unit_cost || 0,
      estimated_total_price: item.suggested_order * (item.supplier_info?.last_unit_cost || 0),
      specifications: `Required: ${item.total_required}, Available: ${item.available_stock}, Shortage: ${item.shortage}`,
      notes: `Lead time: ${item.lead_time_days} days. Priority: ${item.priority}.`,
    }));

    // Create PR data
    const prData = {
      title: prTitle,
      description: prDescription,
      department: 'Production',
      priority: highestPriority,
      required_date: demandSource === 'bom' ? productionDate : analysisDate,
      justification: 'Auto-generated from Material Demand Planning calculation to fulfill material shortages.',
      bom_id: demandSource === 'bom' && selectedBomId ? selectedBomId : undefined,
      company_id: selectedCompany?.id,
      items: prItems,
    };

    createPrMutation.mutate(prData, {
      onSuccess: (data) => {
        toast({
          title: "Purchase Requisition Created",
          description: `PR ${data.pr_number} has been created with ${prItems.length} items.`,
        });
        // Optionally navigate to PR page
        // navigate('/procurement/purchase-requisition');
      },
      onError: (error) => {
        toast({
          title: "Error creating PR",
          description: error.message || "Failed to create purchase requisition.",
          variant: "destructive",
        });
      },
    });
  };

  const bomMaterialsWithShortage = calculationResult?.filter(
    item => item.category === 'BOM Material' && item.shortage > 0
  ) || [];

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
                  Material Requirements
                </CardTitle>
                <CardDescription>
                  Calculate material demand from BOMs or Customer Purchase Orders
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="demand-source">Demand Source</Label>
                  <Select value={demandSource} onValueChange={(value: DemandSource) => setDemandSource(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select demand source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bom">Bill of Materials (BOM)</SelectItem>
                      <SelectItem value="customer_po">Customer Purchase Orders (CPO)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {demandSource === 'bom' && (
                  <>
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
                  </>
                )}

                {demandSource === 'customer_po' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="multiplier">Analysis Multiplier</Label>
                        <Input
                          id="multiplier"
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={multiplier}
                          onChange={(e) => setMultiplier(e.target.value)}
                          placeholder="1.0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="analysis-date">Analysis Date</Label>
                        <Input
                          id="analysis-date"
                          type="date"
                          value={analysisDate}
                          onChange={(e) => setAnalysisDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Select Confirmed Customer Purchase Orders</Label>
                      <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                        {confirmedCPOs.length === 0 ? (
                          <p className="text-muted-foreground text-center py-4 text-sm">
                            No confirmed customer purchase orders found
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {confirmedCPOs.map((cpo) => (
                              <div key={cpo.id} className="flex items-center space-x-2 p-2 border rounded">
                                <Checkbox
                                  id={cpo.id}
                                  checked={selectedCPOs.includes(cpo.id)}
                                  onCheckedChange={(checked) => handleCPOSelection(cpo.id, checked as boolean)}
                                />
                                <div className="flex-1 min-w-0">
                                  <Label htmlFor={cpo.id} className="text-sm font-medium cursor-pointer">
                                    {cpo.cpo_number}
                                  </Label>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {cpo.customer?.customer_name} - {cpo.total_amount ? `$${cpo.total_amount.toFixed(2)}` : 'N/A'}
                                  </p>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {cpo.items?.length || 0} items
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <Button 
                  onClick={handleCalculateDemand}
                  disabled={
                    isCalculating || 
                    (demandSource === 'bom' && !selectedBomId) ||
                    (demandSource === 'customer_po' && selectedCPOs.length === 0)
                  }
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
                      Calculate {demandSource === 'bom' ? 'BOM' : 'CPO'} Demand
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
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
                  <div className="space-y-1">
                    <CardTitle>Material Demand Analysis Results</CardTitle>
                    <CardDescription>
                      Material requirements based on your production parameters
                    </CardDescription>
                  </div>
                  {bomMaterialsWithShortage.length > 0 && (
                    <Button 
                      onClick={handleGeneratePR} 
                      disabled={createPrMutation.isPending}
                      variant="default"
                    >
                      {createPrMutation.isPending ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Creating PR...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-2" />
                          Generate PR ({bomMaterialsWithShortage.length} items)
                        </>
                      )}
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {/* Stock matching feedback */}
                  <div className="mb-4 p-3 bg-muted rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Stock Data Matching:</span>
                      <div className="flex gap-4">
                        <span className="text-green-600">
                          ✓ {calculationResult.filter(item => item.available_stock > 0).length} items with stock
                        </span>
                        <span className="text-amber-600">
                          ⚠ {calculationResult.filter(item => item.available_stock === 0).length} items without stock data
                        </span>
                      </div>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                       <TableRow>
                         <TableHead>Status</TableHead>
                         <TableHead>Item Code</TableHead>
                         <TableHead>Item Name</TableHead>
                         <TableHead>Type</TableHead>
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
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{item.item_name}</span>
                                {item.finished_good_info && (
                                  <span className="text-sm text-muted-foreground">
                                    FG: {item.finished_good_info.product_name} (Stock: {item.finished_good_info.current_stock})
                                  </span>
                                )}
                                {item.bom_info && (
                                  <span className="text-sm text-muted-foreground">
                                    BOM: {item.bom_info.bom_number}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {item.finished_good_info && item.category === 'Fulfilled from Stock' ? (
                                <Badge variant="secondary" className="bg-green-500 text-white">
                                  <Package className="h-3 w-3 mr-1" />
                                  Fulfilled from Stock
                                </Badge>
                              ) : item.category === 'BOM Material' ? (
                                <Badge variant="default">
                                  <Box className="h-3 w-3 mr-1" />
                                  BOM Material
                                </Badge>
                              ) : (
                                <Badge variant="outline">
                                  <ShoppingCart className="h-3 w-3 mr-1" />
                                  Direct Purchase
                                </Badge>
                              )}
                            </TableCell>
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

                {selectedBomId && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Related Purchase Orders & Requisitions</CardTitle>
                      <CardDescription>
                        Purchase orders and requisitions linked to this BOM for comprehensive material planning
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {getRelatedCPOs(selectedBomId).length > 0 ? (
                        <div className="space-y-6">
                          <div>
                            <h4 className="font-medium mb-3">Purchase Orders</h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>PO Number</TableHead>
                                  <TableHead>Supplier</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Expected Delivery</TableHead>
                                  <TableHead>Total Amount</TableHead>
                                  <TableHead>Items Count</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                 {getRelatedCPOs(selectedBomId).map((cpo) => (
                                   <TableRow key={cpo.id}>
                                     <TableCell className="font-mono">{cpo.cpo_number}</TableCell>
                                     <TableCell>{cpo.customer?.customer_name || 'N/A'}</TableCell>
                                     <TableCell>
                                       <Badge variant={cpo.status === 'completed' ? 'default' : 'secondary'}>
                                         {cpo.status}
                                       </Badge>
                                     </TableCell>
                                     <TableCell>
                                       {cpo.delivery_date ? 
                                         format(new Date(cpo.delivery_date), 'MMM dd, yyyy') : 
                                         'Not set'
                                       }
                                     </TableCell>
                                     <TableCell>${cpo.total_amount?.toLocaleString()}</TableCell>
                                     <TableCell>{cpo.items?.length || 0}</TableCell>
                                   </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>

                          {/* Related Purchase Requisitions */}
                          {purchaseRequisitions && purchaseRequisitions.filter(pr => pr.bom_id === selectedBomId).length > 0 && (
                            <div>
                              <h4 className="font-medium mb-3">Related Purchase Requisitions</h4>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>PR Number</TableHead>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Priority</TableHead>
                                    <TableHead>Required Date</TableHead>
                                    <TableHead>Estimated Amount</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {purchaseRequisitions.filter(pr => pr.bom_id === selectedBomId).map((pr) => (
                                    <TableRow key={pr.id}>
                                      <TableCell className="font-mono">{pr.pr_number}</TableCell>
                                      <TableCell>{pr.title}</TableCell>
                                      <TableCell>
                                        <Badge variant={pr.status === 'approved' ? 'default' : 'secondary'}>
                                          {pr.status}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant={pr.priority === 'urgent' ? 'destructive' : 'outline'}>
                                          {pr.priority}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        {format(new Date(pr.required_date), 'MMM dd, yyyy')}
                                      </TableCell>
                                      <TableCell>LKR {pr.total_estimated_amount.toLocaleString()}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No related Purchase Orders found for this BOM</p>
                          <p className="text-sm mt-2">
                            Create Purchase Requisitions and Orders based on the material shortages above to establish the complete supply chain
                          </p>
                        </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
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