import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWarehouseItems } from '@/hooks/useWarehouseItems';
import { useItemCategories } from '@/hooks/useItemCategories';
import { useItemUnits } from '@/hooks/useItemUnits';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCompany } from '@/contexts/CompanyContext';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { useWarehouseBins } from '@/hooks/useWarehouseBins';
import { CreateWarehouseItemData } from '@/types/itemBin';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface ParsedItem extends Partial<CreateWarehouseItemData> {
  rowNumber: number;
  errors: string[];
  warnings: string[];
  initial_stock?: number;
  bin_id?: string;
}

interface BulkItemImportContentProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function BulkItemImportContent({ onSuccess, onCancel }: BulkItemImportContentProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedItem[]>([]);
  const [validData, setValidData] = useState<CreateWarehouseItemData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { toast } = useToast();
  const { bulkCreateItemsAsync, isBulkCreating, items: existingItems = [] } = useWarehouseItems();
  const { categories } = useItemCategories();
  const { units } = useItemUnits();
  const { data: suppliers = [] } = useSuppliers();
  const { companies, selectedCompany } = useCompany();
  const { locations } = useWarehouseLocations();
  const { bins } = useWarehouseBins();
  const queryClient = useQueryClient();

  const downloadTemplate = () => {
    const headers = [
      'item_code',
      'name',
      'description',
      'category',
      'unit',
      'location',
      'initial_stock',
      'bin',
      'reorder_level',
      'min_stock_level',
      'max_stock_level',
      'unit_cost',
      'selling_price',
      'barcode',
      'sku',
      'brand',
      'manufacturer',
      'supplier',
      'status',
      'is_serialized',
      'is_batch_tracked',
      'notes',
      'company'
    ];

    const sampleRow = [
      'ITEM001',
      'Sample Item',
      'This is a sample item',
      'Electronics',
      'PCS',
      'Main Warehouse',
      '100',
      'BIN-001',
      '10',
      '5',
      '100',
      '50.00',
      '75.00',
      '123456789',
      'SKU001',
      'Sample Brand',
      'Sample Manufacturer',
      'Sample Supplier',
      'active',
      'false',
      'false',
      'Sample notes',
      'Sample Company'
    ];

    const csvContent = [
      headers.join(','),
      sampleRow.join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'item_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        if (currentField || currentRow.length > 0) {
          currentRow.push(currentField.trim());
          if (currentRow.some(field => field !== '')) {
            lines.push(currentRow);
          }
          currentRow = [];
          currentField = '';
        }
      } else {
        currentField += char;
      }
    }

    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field !== '')) {
        lines.push(currentRow);
      }
    }

    return lines;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Error",
        description: "Please select a CSV file",
        variant: "destructive",
      });
      return;
    }

    setCsvFile(file);
    setIsProcessing(true);
    setShowPreview(false);

    try {
      const text = await file.text();
      const lines = parseCSV(text);

      if (lines.length < 2) {
        throw new Error('CSV file must contain headers and at least one data row');
      }

      const headers = lines[0].map(h => h.toLowerCase().trim());
      const dataRows = lines.slice(1);

      const parsed: ParsedItem[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const item: ParsedItem = {
          rowNumber: i + 2,
          errors: [],
          warnings: []
        };

        headers.forEach((header, idx) => {
          const value = row[idx]?.trim() || '';
          
          switch (header) {
            case 'item_code':
              if (!value) {
                item.errors.push('Item code is required');
              } else {
                item.item_code = value;
              }
              break;
            case 'name':
              if (!value) {
                item.errors.push('Name is required');
              } else {
                item.name = value;
              }
              break;
            case 'description':
              item.description = value || undefined;
              break;
            case 'category':
              if (value) {
                const category = categories.find(c => 
                  c.name.toLowerCase() === value.toLowerCase()
                );
                if (category) {
                  item.category_id = category.id;
                } else {
                  item.warnings.push(`Category "${value}" not found`);
                }
              }
              break;
            case 'unit':
              if (value) {
                const unit = units.find(u => 
                  u.abbreviation.toLowerCase() === value.toLowerCase()
                );
                if (unit) {
                  item.unit_id = unit.id;
                } else {
                  item.warnings.push(`Unit "${value}" not found`);
                }
              }
              break;
            case 'location':
              if (value) {
                const warehouseLocations = locations.filter(l => l.type === 'location');
                const location = warehouseLocations.find(l => 
                  l.name.toLowerCase() === value.toLowerCase() ||
                  l.location_code?.toLowerCase() === value.toLowerCase()
                );
                if (location) {
                  item.location_id = location.id;
                } else {
                  item.warnings.push(`Warehouse location "${value}" not found`);
                }
              }
              break;
            case 'initial_stock':
              if (value) {
                const num = parseFloat(value);
                if (isNaN(num) || num < 0) {
                  item.errors.push('Initial stock must be a positive number');
                } else {
                  item.initial_stock = num;
                }
              }
              break;
            case 'bin':
              if (value) {
                const bin = bins.find(b => 
                  b.bin_code.toLowerCase() === value.toLowerCase() ||
                  b.name.toLowerCase() === value.toLowerCase()
                );
                if (bin) {
                  item.bin_id = bin.id;
                } else {
                  item.warnings.push(`Bin "${value}" not found`);
                }
              }
              break;
            case 'supplier':
              if (value) {
                const supplier = suppliers.find(s => 
                  s.name.toLowerCase() === value.toLowerCase()
                );
                if (supplier) {
                  item.supplier_id = supplier.id;
                } else {
                  item.warnings.push(`Supplier "${value}" not found`);
                }
              }
              break;
            case 'company':
              if (value) {
                const company = companies.find(c => 
                  c.name.toLowerCase() === value.toLowerCase()
                );
                if (company) {
                  item.company_id = company.id;
                } else {
                  item.warnings.push(`Company "${value}" not found`);
                }
              }
              break;
            case 'reorder_level':
            case 'min_stock_level':
            case 'max_stock_level':
              if (value) {
                const num = parseFloat(value);
                if (isNaN(num)) {
                  item.errors.push(`${header} must be a number`);
                } else {
                  (item as any)[header] = num;
                }
              }
              break;
            case 'unit_cost':
            case 'selling_price':
              if (value) {
                const num = parseFloat(value);
                if (isNaN(num)) {
                  item.errors.push(`${header} must be a number`);
                } else {
                  (item as any)[header] = num;
                }
              }
              break;
            case 'status':
              if (value) {
                if (['active', 'inactive', 'discontinued'].includes(value.toLowerCase())) {
                  (item as any).status = value.toLowerCase();
                } else {
                  item.errors.push('Status must be: active, inactive, or discontinued');
                }
              } else {
                (item as any).status = 'active';
              }
              break;
            case 'is_serialized':
            case 'is_batch_tracked':
              if (value) {
                const boolValue = value.toLowerCase() === 'true';
                (item as any)[header] = boolValue;
              }
              break;
            case 'barcode':
            case 'sku':
            case 'brand':
            case 'manufacturer':
            case 'notes':
              (item as any)[header] = value || undefined;
              break;
          }
        });

        if (item.initial_stock && item.initial_stock > 0 && !item.bin_id) {
          item.warnings.push('Initial stock specified but no valid bin provided - stock will not be set');
        }

        parsed.push(item);
      }

      const itemCodeCounts = new Map<string, number>();
      parsed.forEach(item => {
        if (item.item_code) {
          const key = `${item.item_code?.toLowerCase()}_${item.company_id || selectedCompany?.id || ''}`;
          itemCodeCounts.set(key, (itemCodeCounts.get(key) || 0) + 1);
        }
      });

      parsed.forEach(item => {
        if (item.item_code) {
          const companyId = item.company_id || selectedCompany?.id || '';
          const key = `${item.item_code.toLowerCase()}_${companyId}`;
          
          if ((itemCodeCounts.get(key) || 0) > 1) {
            item.errors.push(`Duplicate item code "${item.item_code}" in CSV`);
          }
          
          const existsInDb = existingItems.some(
            existing => existing.item_code?.toLowerCase() === item.item_code?.toLowerCase() &&
                       existing.company_id === companyId
          );
          if (existsInDb) {
            item.errors.push(`Item code "${item.item_code}" already exists in database`);
          }
        }
      });

      setParsedData(parsed);
      
      const valid = parsed
        .filter(item => item.errors.length === 0)
        .map(({ rowNumber, errors, warnings, initial_stock, bin_id, ...item }) => item as CreateWarehouseItemData);
      
      setValidData(valid);
      setShowPreview(true);

      toast({
        title: "CSV Parsed",
        description: `Found ${parsed.length} rows: ${valid.length} valid, ${parsed.length - valid.length} with errors`,
      });
    } catch (error: any) {
      console.error('Error parsing CSV:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to parse CSV file",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (validData.length === 0) {
      toast({
        title: "Error",
        description: "No valid items to import",
        variant: "destructive",
      });
      return;
    }

    try {
      const createdItems = await bulkCreateItemsAsync(validData);
      
      const { data: user } = await supabase.auth.getUser();
      
      const binAllocations: Array<{
        warehouse_item_id: string;
        bin_id: string;
        allocated_quantity: number;
        company_id?: string;
        created_by?: string;
      }> = [];
      
      for (const createdItem of createdItems) {
        const originalItem = parsedData.find(p => 
          p.item_code === createdItem.item_code && 
          p.errors.length === 0
        );
        
        if (originalItem?.initial_stock && originalItem.initial_stock > 0 && originalItem?.bin_id) {
          binAllocations.push({
            warehouse_item_id: createdItem.id,
            bin_id: originalItem.bin_id,
            allocated_quantity: originalItem.initial_stock,
            company_id: selectedCompany?.id,
            created_by: user.user?.id,
          });
        }
      }
      
      if (binAllocations.length > 0) {
        const { error } = await supabase
          .from('warehouse_bin_allocations')
          .insert(binAllocations);
        
        if (error) {
          console.error('Error creating bin allocations:', error);
          toast({
            title: "Partial Success",
            description: `Items imported but some initial stock could not be set: ${error.message}`,
          });
        }
        
        queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
      }

      // Create opening stock transactions for items with initial stock
      const stockTransactions: Array<{
        item_id: string;
        transaction_type: 'opening_stock';
        reference_type: 'manual';
        quantity_change: number;
        quantity_before: number;
        quantity_after: number;
        unit_cost?: number;
        total_value?: number;
        notes: string;
        company_id?: string;
        created_by?: string;
      }> = [];

      for (const createdItem of createdItems) {
        const originalItem = parsedData.find(p => 
          p.item_code === createdItem.item_code && 
          p.errors.length === 0
        );
        
        if (originalItem?.initial_stock && originalItem.initial_stock > 0) {
          // Update current_stock on the item
          await supabase
            .from('warehouse_items')
            .update({ current_stock: originalItem.initial_stock })
            .eq('id', createdItem.id);

          // Prepare stock transaction for opening balance
          const unitCost = originalItem.unit_cost || 0;
          stockTransactions.push({
            item_id: createdItem.id,
            transaction_type: 'opening_stock',
            reference_type: 'manual',
            quantity_change: originalItem.initial_stock,
            quantity_before: 0,
            quantity_after: originalItem.initial_stock,
            unit_cost: unitCost > 0 ? unitCost : undefined,
            total_value: unitCost > 0 ? unitCost * originalItem.initial_stock : undefined,
            notes: 'Opening stock balance (bulk import)',
            company_id: selectedCompany?.id,
            created_by: user.user?.id,
          });
        }
      }

      // Insert all stock transactions
      if (stockTransactions.length > 0) {
        const { error: txnError } = await supabase
          .from('stock_transactions')
          .insert(stockTransactions);
        
        if (txnError) {
          console.error('Error creating stock transactions:', txnError);
        }
        
        queryClient.invalidateQueries({ queryKey: ['stock-transactions'] });
      }

      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      
      onSuccess();
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={downloadTemplate} className="flex-shrink-0">
          <Download className="mr-2 h-4 w-4" />
          Download Template
        </Button>

        <div className="flex-1">
          <Label htmlFor="csv-file" className="sr-only">CSV File</Label>
          <Input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={isProcessing || isBulkCreating}
          />
        </div>
      </div>

      {showPreview && parsedData.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Total: {parsedData.length}
            </Badge>
            <Badge variant="default" className="flex items-center gap-1 bg-green-100 text-green-800 border-green-200">
              <CheckCircle2 className="h-3 w-3" />
              Valid: {validData.length}
            </Badge>
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Errors: {parsedData.length - validData.length}
            </Badge>
          </div>

          {parsedData.some(item => item.errors.length > 0) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Some rows contain errors and will be skipped during import. Please review and fix the errors in your CSV file.
              </AlertDescription>
            </Alert>
          )}

          <ScrollArea className="h-[300px] border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Row</TableHead>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Validation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedData.map((item) => (
                  <TableRow key={item.rowNumber} className={item.errors.length > 0 ? 'bg-red-50' : 'bg-green-50'}>
                    <TableCell className="font-mono text-xs">{item.rowNumber}</TableCell>
                    <TableCell className="font-medium">{item.item_code || '-'}</TableCell>
                    <TableCell>{item.name || '-'}</TableCell>
                    <TableCell>
                      {item.category_id 
                        ? categories.find(c => c.id === item.category_id)?.name
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      {item.unit_id 
                        ? units.find(u => u.id === item.unit_id)?.abbreviation
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        item.status === 'active' ? 'bg-green-100 text-green-800 border-green-200' :
                        item.status === 'inactive' ? 'bg-gray-100 text-gray-800 border-gray-200' :
                        'bg-red-100 text-red-800 border-red-200'
                      }>
                        {item.status || 'active'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {item.errors.map((error, idx) => (
                          <div key={idx} className="flex items-center gap-1 text-xs text-red-600">
                            <AlertCircle className="h-3 w-3" />
                            {error}
                          </div>
                        ))}
                        {item.warnings.map((warning, idx) => (
                          <div key={idx} className="flex items-center gap-1 text-xs text-yellow-600">
                            <AlertCircle className="h-3 w-3" />
                            {warning}
                          </div>
                        ))}
                        {item.errors.length === 0 && item.warnings.length === 0 && (
                          <div className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Valid
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel} disabled={isBulkCreating}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={validData.length === 0 || isBulkCreating}
            >
              {isBulkCreating ? 'Importing...' : `Import ${validData.length} Items`}
            </Button>
          </div>
        </div>
      )}

      {!showPreview && (
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
