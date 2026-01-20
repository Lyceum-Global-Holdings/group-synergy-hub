import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Search } from 'lucide-react';
import { useInventoryValuation } from '@/hooks/useInventoryValuation';
import { ValuationFilters } from '@/types/inventoryValuation';
import { format } from 'date-fns';
import { writeExcelFromJSON } from '@/utils/excelUtils';

interface DetailedValuationTableProps {
  filters: ValuationFilters;
  onFiltersChange: (filters: ValuationFilters) => void;
}

export function DetailedValuationTable({ filters }: DetailedValuationTableProps) {
  const { valuationData, isLoading } = useInventoryValuation(filters);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredData = valuationData.filter(item =>
    item.item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAgingBadgeVariant = (bucket: string) => {
    if (bucket === '0-30 days') return 'default';
    if (bucket === '31-90 days') return 'secondary';
    if (bucket === '91-180 days') return 'outline';
    if (bucket === '181-365 days') return 'destructive';
    return 'destructive';
  };

  const handleExport = async () => {
    const exportData = filteredData.map(item => ({
      'Item Code': item.item_code,
      'Item Name': item.item_name,
      'Type': item.item_type,
      'Category': item.category,
      'Location': item.location,
      'Quantity': item.quantity_on_hand,
      'Unit Cost': item.unit_cost,
      'Total Value': item.total_value,
      'Valuation Method': item.valuation_method,
      'Days in Stock': item.days_in_stock,
      'Aging': item.aging_bucket,
      'Last Movement': format(new Date(item.last_movement_date), 'yyyy-MM-dd'),
    }));

    await writeExcelFromJSON(exportData, `inventory-valuation-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Detailed Item Valuation</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                className="pl-8 w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left text-sm font-medium">Item Code</th>
                  <th className="p-3 text-left text-sm font-medium">Item Name</th>
                  <th className="p-3 text-left text-sm font-medium">Type</th>
                  <th className="p-3 text-left text-sm font-medium">Category</th>
                  <th className="p-3 text-left text-sm font-medium">Location</th>
                  <th className="p-3 text-right text-sm font-medium">Quantity</th>
                  <th className="p-3 text-right text-sm font-medium">Unit Cost</th>
                  <th className="p-3 text-right text-sm font-medium">Total Value</th>
                  <th className="p-3 text-center text-sm font-medium">Method</th>
                  <th className="p-3 text-center text-sm font-medium">Aging</th>
                  <th className="p-3 text-left text-sm font-medium">Last Movement</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item) => (
                  <tr key={item.item_id} className="border-b hover:bg-muted/50">
                    <td className="p-3 text-sm font-medium">{item.item_code}</td>
                    <td className="p-3 text-sm">{item.item_name}</td>
                    <td className="p-3 text-sm">
                      <Badge variant="outline">{item.item_type.replace('_', ' ')}</Badge>
                    </td>
                    <td className="p-3 text-sm">{item.category}</td>
                    <td className="p-3 text-sm">{item.location}</td>
                    <td className="p-3 text-sm text-right">{item.quantity_on_hand.toFixed(2)}</td>
                    <td className="p-3 text-sm text-right">LKR {item.unit_cost.toFixed(2)}</td>
                    <td className="p-3 text-sm text-right font-medium">LKR {item.total_value.toFixed(2)}</td>
                    <td className="p-3 text-sm text-center">
                      <Badge variant="secondary">{item.valuation_method.replace('_', ' ')}</Badge>
                    </td>
                    <td className="p-3 text-sm text-center">
                      <Badge variant={getAgingBadgeVariant(item.aging_bucket)}>
                        {item.aging_bucket}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm">{format(new Date(item.last_movement_date), 'yyyy-MM-dd')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No inventory items found
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
