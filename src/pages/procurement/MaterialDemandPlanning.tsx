import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { VirtualTable } from '@/components/shared/VirtualTable';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Calculator, FileText, AlertTriangle, CheckCircle, Clock, TrendingUp, Package, Box, ShoppingCart, Truck, Ruler } from 'lucide-react';
import { useMaterialDemand, useDemandCalculation } from '@/hooks/useMaterialDemand';
import { useBillOfMaterials } from '@/hooks/useBillOfMaterials';
import { useCustomerPurchaseOrders } from '@/hooks/useCustomerPurchaseOrders';
import { usePurchaseRequisitions, useCreatePurchaseRequisition } from '@/hooks/usePurchaseRequisitions';
import { useCompany } from '@/contexts/CompanyContext';
import { format } from 'date-fns';
import { DemandPriority, DemandSource, DemandAnalysisResult } from '@/types/materialDemand';
import { PrPriority } from '@/types/procurement';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { CreateDispatchNoteDialog } from '@/components/warehouse/CreateDispatchNoteDialog';
import { CreatePrFromDemandDialog } from '@/components/procurement/CreatePrFromDemandDialog';
import { BulkPrPreviewDialog } from '@/components/procurement/BulkPrPreviewDialog';
import { ReserveMaterialsFromCPODialog } from '@/components/procurement/ReserveMaterialsFromCPODialog';
import { supabase } from '@/integrations/supabase/client';

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
  
  // Dialog states
  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const [selectedDispatchItem, setSelectedDispatchItem] = useState<DemandAnalysisResult | null>(null);
  const [prAdjustmentDialogOpen, setPrAdjustmentDialogOpen] = useState(false);
  const [selectedPrItem, setSelectedPrItem] = useState<DemandAnalysisResult | null>(null);
  const [selectedBomDetails, setSelectedBomDetails] = useState<{ size?: string; sizeMultiplier?: number } | null>(null);
  const [bulkPrDialogOpen, setBulkPrDialogOpen] = useState(false);
  const [bulkPrPreviewData, setBulkPrPreviewData] = useState<any>(null);
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false);

  // Filter confirmed CPOs for CPO-based demand calculation
  const confirmedCPOs = customerPOs?.filter(cpo => cpo.status === 'confirmed') || [];

  const handleCalculateDemand = async () => {
    if (demandSource === 'bom') {
      if (!selectedBomId) return;
      
      // Fetch BOM details to get size info
      const { data: bomData } = await supabase
        .from('bill_of_materials')
        .select('size, bom_number, product_name')
        .eq('id', selectedBomId)
        .single();
      
      // Fetch size multiplier if BOM has size
      let sizeMultiplier = 1.0;
      if (bomData?.size) {
        const { data: multiplierData } = await supabase
          .from('bom_size_multipliers')
          .select('multiplier')
          .eq('bom_id', selectedBomId)
          .eq('size', bomData.size)
          .maybeSingle();
        
        sizeMultiplier = multiplierData?.multiplier || 1.0;
      }
      
      setSelectedBomDetails(bomData ? { size: bomData.size, sizeMultiplier } : null);
      
      calculateBOMDemand({
        bom_id: selectedBomId,
        production_quantity: productionQuantity,
        production_date: productionDate,
        include_safety_stock: true
      });
    } else if (demandSource === 'customer_po') {
      if (selectedCPOs.length === 0) return;
      
      setSelectedBomDetails(null);

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

  // Prepare bulk PR preview data
  const prepareBulkPrData = () => {
    if (!calculationResult || calculationResult.length === 0) return null;

    const bomMaterialsWithShortage = calculationResult.filter(
      item => item.category === 'BOM Material' && item.shortage > 0
    );

    if (bomMaterialsWithShortage.length === 0) return null;

    // Calculate totals and groupings
    const totalEstimatedCost = bomMaterialsWithShortage.reduce(
      (sum, item) => sum + (item.suggested_order * (item.supplier_info?.last_unit_cost || 0)),
      0
    );

    const maxLeadTime = Math.max(
      ...bomMaterialsWithShortage.map(item => item.lead_time_days)
    );

    // Group by supplier
    const supplierGroups: Record<string, DemandAnalysisResult[]> = {};
    bomMaterialsWithShortage.forEach(item => {
      const supplierName = item.supplier_info?.supplier_name || 'Unknown Supplier';
      if (!supplierGroups[supplierName]) {
        supplierGroups[supplierName] = [];
      }
      supplierGroups[supplierName].push(item);
    });

    const selectedBom = boms?.find(bom => bom.id === selectedBomId);

    // NEW: Extract CPO information for traceability
    let cpoInfo: { cpo_numbers: string[]; customers: string[] } | undefined;
    
    if (demandSource === 'customer_po') {
      const selectedCPOData = confirmedCPOs.filter(cpo => selectedCPOs.includes(cpo.id));
      cpoInfo = {
        cpo_numbers: selectedCPOData.map(cpo => cpo.cpo_number),
        customers: Array.from(new Set(selectedCPOData.map(cpo => cpo.customer?.customer_name).filter(Boolean))) as string[]
      };
    }

    return {
      items: bomMaterialsWithShortage,
      summary: {
        totalItems: bomMaterialsWithShortage.length,
        totalCost: totalEstimatedCost,
        maxLeadTime,
        supplierCount: Object.keys(supplierGroups).length,
        cpoCount: cpoInfo?.cpo_numbers.length,
        customerCount: cpoInfo?.customers.length,
      },
      supplierGroups,
      suggestedRequiredDate: demandSource === 'bom' ? productionDate : analysisDate,
      bomInfo: selectedBom ? {
        bom_number: selectedBom.bom_number,
        product_name: selectedBom.product_name,
        size: selectedBomDetails?.size,
        sizeMultiplier: selectedBomDetails?.sizeMultiplier,
      } : undefined,
      cpoInfo,
    };
  };

  // Open bulk PR preview dialog
  const handleOpenBulkPrPreview = () => {
    const previewData = prepareBulkPrData();
    if (!previewData) {
      toast({
        title: "No items to requisition",
        description: "All BOM materials are sufficiently stocked.",
        variant: "default",
      });
      return;
    }
    setBulkPrPreviewData(previewData);
    setBulkPrDialogOpen(true);
  };

  // Generate PR from BOM materials with adjustments
  const handleGeneratePR = (adjustments?: {
    selectedItems?: string[];
    customPriority?: PrPriority;
    additionalNotes?: string;
  }) => {
    if (!calculationResult || calculationResult.length === 0) return;

    // Filter BOM materials with shortage
    let bomMaterialsWithShortage = calculationResult.filter(
      item => item.category === 'BOM Material' && item.shortage > 0
    );

    // Apply item selection filter if adjustments provided
    if (adjustments?.selectedItems) {
      bomMaterialsWithShortage = bomMaterialsWithShortage.filter(item => 
        adjustments.selectedItems!.includes(item.item_code)
      );
    }

    if (bomMaterialsWithShortage.length === 0) {
      toast({
        title: "No items to requisition",
        description: "All BOM materials are sufficiently stocked.",
        variant: "default",
      });
      return;
    }

    // Determine priority - use custom or calculate from items
    let priority: PrPriority;
    if (adjustments?.customPriority) {
      priority = adjustments.customPriority;
    } else {
      const priorities: DemandPriority[] = ['urgent', 'high', 'medium', 'low'];
      priority = (priorities.find(p => 
        bomMaterialsWithShortage.some(item => item.priority === p)
      ) || 'medium') as PrPriority;
    }

    // Prepare PR title and description
    const selectedBom = boms?.find(bom => bom.id === selectedBomId);
    
    // NEW: Enhanced PR title for CPO-based demand
    const prTitle = demandSource === 'bom' && selectedBom
      ? `Material Requisition for BOM ${selectedBom.bom_number}`
      : demandSource === 'customer_po' && selectedCPOs.length > 0
      ? `Material Requisition for ${selectedCPOs.length} CPO(s) - ${format(new Date(), 'MMM dd, yyyy')}`
      : `Material Requisition for CPO Analysis ${format(new Date(), 'MMM dd, yyyy')}`;
    
    let prDescription = `Auto-generated from Material Demand Planning. ${bomMaterialsWithShortage.length} BOM materials with shortage.`;
    
    // NEW: Add CPO summary for traceability
    if (demandSource === 'customer_po' && selectedCPOs.length > 0) {
      const cpoNumbers = confirmedCPOs
        .filter(cpo => selectedCPOs.includes(cpo.id))
        .map(cpo => cpo.cpo_number)
        .join(', ');
      
      prDescription += `\n\nCustomer Purchase Orders: ${cpoNumbers}`;
      
      // Add customer summary
      const uniqueCustomers = Array.from(new Set(
        confirmedCPOs
          .filter(cpo => selectedCPOs.includes(cpo.id))
          .map(cpo => cpo.customer?.customer_name)
          .filter(Boolean)
      ));
      prDescription += `\nCustomers: ${uniqueCustomers.join(', ')}`;
    }
    
    // Add BOM and size info
    if (selectedBom) {
      prDescription += `\nBOM: ${selectedBom.bom_number} - ${selectedBom.product_name}`;
    }
    if (selectedBomDetails?.size) {
      prDescription += `\nSize: ${selectedBomDetails.size}`;
      if (selectedBomDetails.sizeMultiplier && selectedBomDetails.sizeMultiplier !== 1.0) {
        prDescription += ` (${selectedBomDetails.sizeMultiplier}x multiplier)`;
      }
    }
    
    // Add additional notes if provided
    if (adjustments?.additionalNotes) {
      prDescription += `\n\n${adjustments.additionalNotes}`;
    }

    // Map to PR items format with CPO details
    const prItems = bomMaterialsWithShortage.map(item => {
      // Build CPO-aware description
      let itemDescription = item.bom_info 
        ? `BOM: ${item.bom_info.bom_number} - ${item.bom_info.product_name}` 
        : '';
      
      // NEW: Add CPO breakdown if available
      if (item.cpo_details && item.cpo_details.length > 0) {
        itemDescription += itemDescription ? '\n' : '';
        itemDescription += `CPO(s): ${item.cpo_details.map(cpo => cpo.cpo_number).join(', ')}`;
      }
      
      // Build CPO-aware notes
      let itemNotes = `Lead time: ${item.lead_time_days} days. Supplier: ${item.supplier_info?.supplier_name || 'N/A'}.`;
      
      // NEW: Add per-CPO quantity breakdown
      if (item.cpo_details && item.cpo_details.length > 1) {
        itemNotes += '\n\nQuantity breakdown by CPO:';
        item.cpo_details.forEach(cpo => {
          itemNotes += `\n- ${cpo.cpo_number} (${cpo.customer_name}): ${cpo.quantity_contributed.toFixed(2)} ${item.unit_of_measure}`;
        });
      } else if (item.cpo_details && item.cpo_details.length === 1) {
        itemNotes += `\nCPO: ${item.cpo_details[0].cpo_number} (${item.cpo_details[0].customer_name})`;
      }
      
      return {
        warehouse_item_id: undefined,
        finished_good_id: undefined,
        item_code: item.item_code,
        item_name: item.item_name,
        description: itemDescription,
        quantity: item.suggested_order,
        unit_of_measure: item.unit_of_measure,
        estimated_unit_price: item.supplier_info?.last_unit_cost || 0,
        estimated_total_price: item.suggested_order * (item.supplier_info?.last_unit_cost || 0),
        specifications: `Required: ${item.total_required}, Available: ${item.available_stock}, Shortage: ${item.shortage}`,
        notes: itemNotes,
      };
    });

    // Create PR data
    const prData = {
      title: prTitle,
      description: prDescription,
      department: 'Production',
      priority: priority,
      required_date: demandSource === 'bom' ? productionDate : analysisDate,
      justification: 'Auto-generated from Material Demand Planning calculation to fulfill material shortages.',
      bom_id: demandSource === 'bom' && selectedBomId ? selectedBomId : undefined,
      company_id: selectedCompany?.id,
      items: prItems,
    };

    createPrMutation.mutate(prData, {
      onSuccess: (data) => {
        setBulkPrDialogOpen(false);
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

  // Open PR adjustment dialog
  const handleOpenPrAdjustment = (item: DemandAnalysisResult) => {
    setSelectedPrItem(item);
    setPrAdjustmentDialogOpen(true);
  };

  // Individual PR generation for single item with adjusted parameters
  const handleGenerateIndividualPR = (
    item: DemandAnalysisResult,
    adjustedQuantity: number,
    adjustedUnitPrice: number,
    adjustedPriority: DemandPriority,
    additionalNotes: string
  ) => {
    if (adjustedQuantity <= 0) return;

    const prTitle = `Material Requisition - ${item.item_name}`;
    const prDescription = `Individual material requisition for ${item.item_name} from Material Demand Planning.`;
    
    const baseJustification = `Material requisition. Required: ${item.total_required}, Available: ${item.available_stock}, Shortage: ${item.shortage}. Ordered quantity: ${adjustedQuantity}`;
    const fullJustification = additionalNotes 
      ? `${baseJustification}\n\nAdditional notes: ${additionalNotes}`
      : baseJustification;

    const prData = {
      title: prTitle,
      description: prDescription,
      department: 'Production',
      priority: adjustedPriority,
      required_date: demandSource === 'bom' ? productionDate : analysisDate,
      justification: fullJustification,
      bom_id: demandSource === 'bom' && selectedBomId ? selectedBomId : undefined,
      company_id: selectedCompany?.id,
      items: [{
        warehouse_item_id: undefined,
        finished_good_id: undefined,
        item_code: item.item_code,
        item_name: item.item_name,
        description: item.bom_info ? `BOM: ${item.bom_info.bom_number} - ${item.bom_info.product_name}` : '',
        quantity: adjustedQuantity,
        unit_of_measure: item.unit_of_measure,
        estimated_unit_price: adjustedUnitPrice,
        estimated_total_price: adjustedQuantity * adjustedUnitPrice,
        specifications: `Required: ${item.total_required}, Available: ${item.available_stock}, Shortage: ${item.shortage}`,
        notes: `Lead time: ${item.lead_time_days} days. Priority: ${adjustedPriority}.`,
      }],
    };

    createPrMutation.mutate(prData, {
      onSuccess: (data) => {
        toast({
          title: "Purchase Requisition Created",
          description: `PR ${data.pr_number} created for ${item.item_name}.`,
        });
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

  // Handle dispatch note creation
  const handleCreateDispatchNote = (item: DemandAnalysisResult) => {
    setSelectedDispatchItem(item);
    setDispatchDialogOpen(true);
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
                
                {selectedBomDetails?.size && (
                  <Badge variant="secondary" className="flex items-center gap-1 mt-2 w-fit">
                    <Ruler className="h-3 w-3" />
                    Size: {selectedBomDetails.size}
                    {selectedBomDetails.sizeMultiplier && selectedBomDetails.sizeMultiplier !== 1.0 && (
                      <span className="ml-1">({selectedBomDetails.sizeMultiplier}x multiplier)</span>
                    )}
                  </Badge>
                )}
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
                  <div className="flex gap-2">
                    {demandSource === 'customer_po' && bomMaterialsWithShortage.length > 0 && (
                      <Button 
                        onClick={() => setReservationDialogOpen(true)}
                        variant="secondary"
                        disabled={selectedCPOs.length === 0}
                      >
                        <Package className="h-4 w-4 mr-2" />
                        Reserve Materials ({bomMaterialsWithShortage.length})
                      </Button>
                    )}
                    {bomMaterialsWithShortage.length > 0 && (
                      <Button 
                        onClick={handleOpenBulkPrPreview} 
                        disabled={createPrMutation.isPending}
                        variant="default"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Generate Consolidated PR ({bomMaterialsWithShortage.length} items)
                      </Button>
                    )}
                  </div>
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
                   <VirtualTable
                     ariaLabel="Material demand planning results"
                     data={calculationResult as unknown as Record<string, unknown>[]}
                     getRowId={(_row, index) => String(index)}
                     emptyMessage="No items to display"
                     columns={[
                       { key: 'status', header: 'Status', render: (item: any) => getStatusIcon(item.shortage) },
                       { key: 'item_code', header: 'Item Code', className: 'font-mono text-sm', render: (item: any) => item.item_code },
                       {
                         key: 'item_name',
                         header: 'Item Name',
                         render: (item: any) => (
                           <div className="flex flex-col">
                             <span className="font-medium">{item.item_name}</span>
                             {item.finished_good_info && (
                               <span className="text-sm text-muted-foreground">
                                 FG: {item.finished_good_info.product_name} (Stock: {item.finished_good_info.current_stock})
                               </span>
                             )}
                             {item.bom_info && (
                               <span className="text-sm text-muted-foreground">BOM: {item.bom_info.bom_number}</span>
                             )}
                           </div>
                         ),
                       },
                       {
                         key: 'type',
                         header: 'Type',
                         render: (item: any) =>
                           item.finished_good_info && item.category === 'Fulfilled from Stock' ? (
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
                           ),
                       },
                       {
                         key: 'category',
                         header: 'Category',
                         render: (item: any) => <Badge variant="outline">{item.category || 'N/A'}</Badge>,
                       },
                       { key: 'required', header: 'Required', render: (item: any) => `${item.total_required} ${item.unit_of_measure}` },
                       { key: 'available', header: 'Available', render: (item: any) => `${item.available_stock} ${item.unit_of_measure}` },
                       {
                         key: 'reserved',
                         header: 'Reserved',
                         render: (item: any) => (
                           <div className="flex flex-col gap-1">
                             <span>{item.reserved_quantity || 0} {item.unit_of_measure}</span>
                             {(item.reserved_quantity || 0) > 0 && (
                               <span className="text-xs text-muted-foreground">
                                 Avail: {(item.available_stock - (item.reserved_quantity || 0))} {item.unit_of_measure}
                               </span>
                             )}
                           </div>
                         ),
                       },
                       { key: 'on_order', header: 'On Order', render: (item: any) => `${item.on_order} ${item.unit_of_measure}` },
                       {
                         key: 'issued',
                         header: 'Issued',
                         render: (item: any) =>
                           item.issued_quantity ? (
                             <div className="flex flex-col gap-1">
                               <span className="text-green-600 dark:text-green-400 font-medium">
                                 {item.issued_quantity} {item.unit_of_measure}
                               </span>
                               <span className="text-xs text-muted-foreground">Issued for CPO</span>
                             </div>
                           ) : (
                             <span className="text-muted-foreground">-</span>
                           ),
                       },
                       {
                         key: 'shortage',
                         header: 'Shortage',
                         render: (item: any) => (
                           <span className={item.shortage > 0 ? 'text-destructive font-medium' : ''}>
                             {item.shortage} {item.unit_of_measure}
                           </span>
                         ),
                       },
                       {
                         key: 'suggested_order',
                         header: 'Suggested Order',
                         render: (item: any) => (
                           <span className={item.suggested_order > 0 ? 'text-primary font-medium' : ''}>
                             {item.suggested_order} {item.unit_of_measure}
                           </span>
                         ),
                       },
                       {
                         key: 'priority',
                         header: 'Priority',
                         render: (item: any) => (
                           <Badge variant={getPriorityColor(item.priority)}>{item.priority}</Badge>
                         ),
                       },
                       {
                         key: 'actions',
                         header: 'Actions',
                         render: (item: any) => (
                           <div className="flex gap-2">
                             {item.category === 'BOM Material' && item.shortage > 0 && (
                               <Button
                                 size="sm"
                                 variant="default"
                                 onClick={() => handleOpenPrAdjustment(item)}
                                 disabled={createPrMutation.isPending}
                               >
                                 <FileText className="h-3 w-3 mr-1" />
                                 Generate PR...
                               </Button>
                             )}
                             {item.category === 'Fulfilled from Stock' && item.finished_good_info && (
                               <Button
                                 size="sm"
                                 variant="secondary"
                                 onClick={() => handleCreateDispatchNote(item)}
                               >
                                 <Truck className="h-3 w-3 mr-1" />
                                 Create Dispatch
                               </Button>
                             )}
                           </div>
                         ),
                       },
                     ]}
                   />
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

      {selectedDispatchItem && (
        <CreateDispatchNoteDialog
          open={dispatchDialogOpen}
          onOpenChange={setDispatchDialogOpen}
          item={selectedDispatchItem}
        />
      )}

      {selectedPrItem && (
        <CreatePrFromDemandDialog
          item={selectedPrItem}
          open={prAdjustmentDialogOpen}
          onOpenChange={setPrAdjustmentDialogOpen}
          onConfirm={(adjustedQuantity, adjustedUnitPrice, priority, notes) => 
            handleGenerateIndividualPR(selectedPrItem, adjustedQuantity, adjustedUnitPrice, priority, notes)
          }
        />
      )}

      <BulkPrPreviewDialog
        open={bulkPrDialogOpen}
        onOpenChange={setBulkPrDialogOpen}
        previewData={bulkPrPreviewData}
        onConfirm={handleGeneratePR}
        isCreating={createPrMutation.isPending}
      />

      <ReserveMaterialsFromCPODialog
        open={reservationDialogOpen}
        onOpenChange={setReservationDialogOpen}
        materials={bomMaterialsWithShortage}
        cpoIds={selectedCPOs}
        cpoNumbers={confirmedCPOs.filter(cpo => selectedCPOs.includes(cpo.id)).map(cpo => cpo.cpo_number)}
        requiredDate={analysisDate}
        onReservationComplete={() => {
          setReservationDialogOpen(false);
          // Re-calculate demand to show updated reserved quantities
          handleCalculateDemand();
          toast({
            title: "Materials Reserved",
            description: "Materials have been successfully reserved for the selected CPO(s).",
          });
        }}
      />
    </div>
  );
};

export default MaterialDemandPlanning;