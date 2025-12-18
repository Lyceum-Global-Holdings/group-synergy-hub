import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Download, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWarehouseItems } from '@/hooks/useWarehouseItems';
import { useItemCategories } from '@/hooks/useItemCategories';
import { useItemUnits } from '@/hooks/useItemUnits';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCompany } from '@/contexts/CompanyContext';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { CreateWarehouseItemData } from '@/types/itemBin';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ParsedItem extends Partial<CreateWarehouseItemData> {
  rowNumber: number;
  errors: string[];
  warnings: string[];
}

export function BulkItemImportDialog() {
  const [open, setOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedItem[]>([]);
  const [validData, setValidData] = useState<CreateWarehouseItemData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { toast } = useToast();
  const { bulkCreateItemsAsync, isBulkCreating } = useWarehouseItems();
  const { categories } = useItemCategories();
  const { units } = useItemUnits();
  const { data: suppliers = [] } = useSuppliers();
  const { companies } = useCompany();
  const { locations } = useWarehouseLocations();

  const downloadTemplate = () => {
    const headers = [
      'item_code',
      'name',
      'description',
      'category',
      'unit',
      'location',
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

        parsed.push(item);
      }

      setParsedData(parsed);
      
      const valid = parsed
        .filter(item => item.errors.length === 0)
        .map(({ rowNumber, errors, warnings, ...item }) => item as CreateWarehouseItemData);
      
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
      await bulkCreateItemsAsync(validData);
      setOpen(false);
      resetState();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const resetState = () => {
    setCsvFile(null);
    setParsedData([]);
    setValidData([]);
    setShowPreview(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetState();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Bulk Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Bulk Import Items from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple items at once. Download the template to get started.
          </DialogDescription>
        </DialogHeader>

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

              <ScrollArea className="h-[400px] border rounded-lg">
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
                <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isBulkCreating}>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
