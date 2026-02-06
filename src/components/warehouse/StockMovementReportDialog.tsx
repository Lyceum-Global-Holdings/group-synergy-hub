import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStockMovementReport, StockMovementReportItem } from '@/hooks/useStockMovementReport';
import { useItemCategories } from '@/hooks/useItemCategories';
import { useCompany } from '@/contexts/CompanyContext';
import { writeExcelFromJSON } from '@/utils/excelUtils';
import { toast } from 'sonner';

interface StockMovementReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  opening_stock: 'Opening Stock',
  goods_receipt: 'Goods Receipt',
  material_issue: 'Material Issue',
  material_return: 'Material Return',
  adjustment: 'Adjustment',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
  project_issue: 'Project Issue',
  project_return: 'Project Return',
};

export function StockMovementReportDialog({ open, onOpenChange }: StockMovementReportDialogProps) {
  const { selectedCompany } = useCompany();
  const { categories } = useItemCategories(selectedCompany?.id);
  const { fetchReport, isLoading } = useStockMovementReport();
  
  // Default to last 30 days
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [transactionType, setTransactionType] = useState<string>('all');
  const [categoryId, setCategoryId] = useState<string>('all');

  const formatTransactionType = (type: string): string => {
    return TRANSACTION_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast.error('Start date cannot be after end date');
      return;
    }

    try {
      const reportData = await fetchReport({
        startDate,
        endDate,
        transactionType: transactionType !== 'all' ? transactionType : undefined,
        categoryId: categoryId !== 'all' ? categoryId : undefined,
      });

      if (reportData.length === 0) {
        toast.info('No stock movements found for the selected criteria');
        return;
      }

      // Transform to export format
      const exportData = reportData.map((item: StockMovementReportItem) => ({
        'Date/Time': format(new Date(item.created_at), 'yyyy-MM-dd HH:mm:ss'),
        'Transaction Type': formatTransactionType(item.transaction_type),
        'Reference Type': item.reference_type?.replace(/_/g, ' ').toUpperCase() || '',
        'Reference ID': item.reference_id || '',
        'Item Code': item.item_code,
        'Item Name': item.item_name,
        'Category': item.category_name || '',
        'Brand': item.brand || '',
        'Supplier': item.supplier_name || '',
        'Qty Change': item.quantity_change,
        'Qty Before': item.quantity_before,
        'Qty After': item.quantity_after,
        'Unit Cost (LKR)': item.unit_cost || 0,
        'Total Value (LKR)': item.total_value || 0,
        'Issued To Location': item.issued_to_location_name || '',
        'Created By': item.created_by_name || '',
        'Notes': item.notes || '',
      }));

      const companyName = selectedCompany?.name
        ? selectedCompany.name.toLowerCase().replace(/\s+/g, '-')
        : 'all-companies';
      const fileName = `stock-movement-report-${companyName}-${startDate}-to-${endDate}.xlsx`;

      await writeExcelFromJSON(exportData, fileName, 'Stock Movement');
      toast.success(`Exported ${reportData.length} transactions to Excel`);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to generate report:', error);
      toast.error('Failed to generate stock movement report');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Stock Movement Report
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date *</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transactionType">Transaction Type (Optional)</Label>
            <Select value={transactionType} onValueChange={setTransactionType}>
              <SelectTrigger id="transactionType">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category (Optional)</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-sm text-muted-foreground">
            Report will include all stock movements within the selected date range, filtered by the optional criteria above.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerateReport} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Generate Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
