import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Package, 
  TrendingUp,
  FileText,
  Info,
  Ruler
} from 'lucide-react';
import { DemandAnalysisResult, DemandPriority } from '@/types/materialDemand';
import { format, addDays } from 'date-fns';
import { PrPriority } from '@/types/procurement';

interface BulkPrPreviewData {
  items: DemandAnalysisResult[];
  summary: {
    totalItems: number;
    totalCost: number;
    maxLeadTime: number;
    supplierCount: number;
    cpoCount?: number;
    customerCount?: number;
  };
  supplierGroups: Record<string, DemandAnalysisResult[]>;
  suggestedRequiredDate: string;
  bomInfo?: {
    bom_number: string;
    product_name: string;
    size?: string;
    sizeMultiplier?: number;
  };
  cpoInfo?: {
    cpo_numbers: string[];
    customers: string[];
  };
}

interface BulkPrPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewData: BulkPrPreviewData | null;
  onConfirm: (adjustments: {
    selectedItems: string[];
    customPriority: PrPriority;
    additionalNotes: string;
  }) => void;
  isCreating?: boolean;
}

export const BulkPrPreviewDialog: React.FC<BulkPrPreviewDialogProps> = ({
  open,
  onOpenChange,
  previewData,
  onConfirm,
  isCreating = false,
}) => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [customPriority, setCustomPriority] = useState<PrPriority>('medium');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Initialize selected items when dialog opens
  React.useEffect(() => {
    if (open && previewData) {
      setSelectedItems(new Set(previewData.items.map(item => item.item_code)));
      
      // Determine highest priority
      const priorities: DemandPriority[] = ['urgent', 'high', 'medium', 'low'];
      const highestPriority = priorities.find(p => 
        previewData.items.some(item => item.priority === p)
      ) || 'medium';
      setCustomPriority(highestPriority as PrPriority);
      setAdditionalNotes('');
    }
  }, [open, previewData]);

  if (!previewData) return null;

  const handleItemToggle = (itemCode: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(itemCode);
    } else {
      newSelected.delete(itemCode);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(previewData.items.map(item => item.item_code)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const selectedItemsList = previewData.items.filter(item => 
    selectedItems.has(item.item_code)
  );

  const selectedTotalCost = selectedItemsList.reduce((sum, item) => 
    sum + (item.suggested_order * (item.supplier_info?.last_unit_cost || 0)), 0
  );

  const selectedMaxLeadTime = selectedItemsList.length > 0
    ? Math.max(...selectedItemsList.map(item => item.lead_time_days))
    : 0;

  const isHighValue = selectedTotalCost > 100000; // Warning threshold

  const handleConfirm = () => {
    onConfirm({
      selectedItems: Array.from(selectedItems),
      customPriority,
      additionalNotes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Review Consolidated Purchase Requisition
          </DialogTitle>
          <DialogDescription>
            Review and adjust the purchase requisition before creation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* BOM Information */}
          {previewData.bomInfo && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">BOM:</span>
                    <span>{previewData.bomInfo.bom_number} - {previewData.bomInfo.product_name}</span>
                  </div>
                  {previewData.bomInfo.size && (
                    <div className="flex items-center gap-2">
                      <Ruler className="h-3 w-3" />
                      <span className="text-sm">
                        Size: {previewData.bomInfo.size}
                        {previewData.bomInfo.sizeMultiplier && previewData.bomInfo.sizeMultiplier !== 1.0 && (
                          <span className="ml-1 text-muted-foreground">
                            ({previewData.bomInfo.sizeMultiplier}x multiplier)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* CPO Information */}
          {previewData.cpoInfo && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">Customer Purchase Orders:</span>
                    <span className="text-sm">{previewData.cpoInfo.cpo_numbers.join(', ')}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">Customers:</span>
                    <span className="text-sm">{previewData.cpoInfo.customers.join(', ')}</span>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Package className="h-4 w-4" />
                <span className="text-sm">Selected Items</span>
              </div>
              <div className="text-2xl font-bold">{selectedItems.size}</div>
              <div className="text-xs text-muted-foreground">of {previewData.summary.totalItems} total</div>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm">Total Cost</span>
              </div>
              <div className="text-2xl font-bold">LKR {selectedTotalCost.toLocaleString()}</div>
              {isHighValue && (
                <Badge variant="destructive" className="text-xs mt-1">High Value</Badge>
              )}
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Max Lead Time</span>
              </div>
              <div className="text-2xl font-bold">{selectedMaxLeadTime}</div>
              <div className="text-xs text-muted-foreground">days</div>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">Suppliers</span>
              </div>
              <div className="text-2xl font-bold">{previewData.summary.supplierCount}</div>
              <div className="text-xs text-muted-foreground">unique</div>
            </div>

            {previewData.summary.cpoCount && (
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">CPOs</span>
                </div>
                <div className="text-2xl font-bold">{previewData.summary.cpoCount}</div>
                <div className="text-xs text-muted-foreground">
                  {previewData.summary.customerCount} customer(s)
                </div>
              </div>
            )}
          </div>

          {/* High Value Warning */}
          {isHighValue && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This PR has a high total value (LKR {selectedTotalCost.toLocaleString()}). 
                Please ensure proper approval workflow is followed.
              </AlertDescription>
            </Alert>
          )}

          {/* PR Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority Level</Label>
              <Select value={customPriority} onValueChange={(value: PrPriority) => setCustomPriority(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Expected Delivery Date</Label>
              <div className="flex items-center gap-2 p-2 border rounded-md bg-muted">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {format(addDays(new Date(), selectedMaxLeadTime), 'MMM dd, yyyy')}
                </span>
                <span className="text-xs text-muted-foreground">
                  (based on lead time)
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Justification</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes or justification for this requisition..."
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              rows={3}
            />
          </div>

          <Separator />

          {/* Items Selection Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Select Items to Include</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={selectedItems.size === previewData.items.length}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all" className="cursor-pointer text-sm">
                  Select All
                </Label>
              </div>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Select</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Shortage</TableHead>
                    <TableHead>Order Qty</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Lead Time</TableHead>
                    <TableHead>Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.items.map((item) => (
                    <TableRow key={item.item_code}>
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.has(item.item_code)}
                          onCheckedChange={(checked) => 
                            handleItemToggle(item.item_code, checked as boolean)
                          }
                        />
                      </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{item.item_name}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {item.item_code}
                    </span>
                    {item.cpo_details && item.cpo_details.length > 0 && (
                      <Badge variant="outline" className="text-xs w-fit">
                        {item.cpo_details.length} CPO(s)
                      </Badge>
                    )}
                  </div>
                </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-destructive" />
                          <span className="text-destructive font-medium">
                            {item.shortage} {item.unit_of_measure}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.suggested_order} {item.unit_of_measure}
                      </TableCell>
                      <TableCell>
                        LKR {(item.supplier_info?.last_unit_cost || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        LKR {(item.suggested_order * (item.supplier_info?.last_unit_cost || 0)).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>{item.lead_time_days}d</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          item.priority === 'urgent' ? 'destructive' :
                          item.priority === 'high' ? 'secondary' : 'outline'
                        }>
                          {item.priority}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Supplier Breakdown */}
          {Object.keys(previewData.supplierGroups).length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Supplier Breakdown</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(previewData.supplierGroups).map(([supplier, items]) => (
                  <div key={supplier} className="p-3 border rounded-lg">
                    <div className="font-medium mb-1">{supplier || 'Unknown Supplier'}</div>
                    <div className="text-sm text-muted-foreground">
                      {items.length} item{items.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={selectedItems.size === 0 || isCreating}
          >
            {isCreating ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Creating PR...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Create PR ({selectedItems.size} items)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
