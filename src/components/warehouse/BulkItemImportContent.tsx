import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, FileText, AlertCircle, CheckCircle2, ArrowRight, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWarehouseItems } from '@/hooks/useWarehouseItems';
import { useItemCategories } from '@/hooks/useItemCategories';
import { useItemUnits } from '@/hooks/useItemUnits';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCompany } from '@/contexts/CompanyContext';
import { CreateWarehouseItemData } from '@/types/itemBin';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

type ImportStatus = 'new' | 'duplicate' | 'update_code' | 'error';

interface ParsedItem extends Partial<CreateWarehouseItemData> {
  rowNumber: number;
  errors: string[];
  warnings: string[];
  importStatus: ImportStatus;
  existingId?: string;
  existingItemCode?: string;
  updateCodeEnabled?: boolean;
}

interface BulkItemImportContentProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function BulkItemImportContent({ onSuccess, onCancel }: BulkItemImportContentProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const { toast } = useToast();
  const { bulkCreateItemsAsync, isBulkCreating } = useWarehouseItems();
  const { items: allExistingItems = [] } = useWarehouseItems({ skipCompanyFilter: true });
  const { categories } = useItemCategories();
  const { units } = useItemUnits();
  const { data: suppliers = [] } = useSuppliers();
  const { companies, selectedCompany } = useCompany();
  const { locations } = useWarehouseLocations();
  const queryClient = useQueryClient();

  const downloadTemplate = () => {
    const headers = [
      'item_code', 'name', 'description', 'category', 'unit', 'location',
      'initial_stock', 'bin', 'reorder_level', 'min_stock_level', 'max_stock_level',
      'unit_cost', 'selling_price', 'barcode', 'sku', 'brand', 'manufacturer',
      'supplier', 'status', 'is_serialized', 'is_batch_tracked', 'notes', 'company'
    ];

    const sampleRow = [
      'ITEM001', 'Sample Item', 'This is a sample item', 'Electronics', 'PCS',
      'Main Warehouse', '100', 'BIN-001', '10', '5', '100', '50.00', '75.00',
      '123456789', 'SKU001', 'Sample Brand', 'Sample Manufacturer', 'Sample Supplier',
      'active', 'false', 'false', 'Sample notes', 'Sample Company'
    ];

    const csvContent = [headers.join(','), sampleRow.join(',')].join('\n');
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
        if (char === '\r' && nextChar === '\n') i++;
        if (currentField || currentRow.length > 0) {
          currentRow.push(currentField.trim());
          if (currentRow.some(field => field !== '')) lines.push(currentRow);
          currentRow = [];
          currentField = '';
        }
      } else {
        currentField += char;
      }
    }

    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field !== '')) lines.push(currentRow);
    }

    return lines;
  };

  const toggleUpdateCode = (rowNumber: number) => {
    setParsedData(prev =>
      prev.map(item =>
        item.rowNumber === rowNumber
          ? { ...item, updateCodeEnabled: !item.updateCodeEnabled }
          : item
      )
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({ title: "Error", description: "Please select a CSV file", variant: "destructive" });
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
          warnings: [],
          importStatus: 'new',
          updateCodeEnabled: true,
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
                const category = categories.find(c => c.name.toLowerCase() === value.toLowerCase());
                if (category) item.category_id = category.id;
                else item.warnings.push(`Category "${value}" not found`);
              }
              break;
            case 'unit':
              if (value) {
                const unit = units.find(u => u.abbreviation.toLowerCase() === value.toLowerCase());
                if (unit) item.unit_id = unit.id;
                else item.warnings.push(`Unit "${value}" not found`);
              }
              break;
            case 'location':
              if (value) {
                const warehouseLocations = locations.filter(l => l.type === 'location');
                const location = warehouseLocations.find(l =>
                  l.name.toLowerCase() === value.toLowerCase() ||
                  l.location_code?.toLowerCase() === value.toLowerCase()
                );
                if (location) item.location_id = location.id;
                else item.warnings.push(`Warehouse location "${value}" not found`);
              }
              break;
            case 'initial_stock':
              if (value) {
                const num = parseFloat(value);
                if (isNaN(num) || num < 0) item.errors.push('Initial stock must be a positive number');
                else item.initial_stock = num;
              }
              break;
            case 'bin':
              if (value) {
                const bin = bins.find(b =>
                  b.bin_code.toLowerCase() === value.toLowerCase() ||
                  b.name.toLowerCase() === value.toLowerCase()
                );
                if (bin) item.bin_id = bin.id;
                else item.warnings.push(`Bin "${value}" not found`);
              }
              break;
            case 'supplier':
              if (value) {
                const supplier = suppliers.find(s => s.name.toLowerCase() === value.toLowerCase());
                if (supplier) item.supplier_id = supplier.id;
                else item.warnings.push(`Supplier "${value}" not found`);
              }
              break;
            case 'company':
              if (value) {
                const company = companies.find(c => c.name.toLowerCase() === value.toLowerCase());
                if (company) item.company_id = company.id;
                else item.warnings.push(`Company "${value}" not found`);
              }
              break;
            case 'reorder_level':
            case 'min_stock_level':
            case 'max_stock_level':
              if (value) {
                const num = parseFloat(value);
                if (isNaN(num)) item.errors.push(`${header} must be a number`);
                else (item as any)[header] = num;
              }
              break;
            case 'unit_cost':
            case 'selling_price':
              if (value) {
                const num = parseFloat(value);
                if (isNaN(num)) item.errors.push(`${header} must be a number`);
                else (item as any)[header] = num;
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
              if (value) (item as any)[header] = value.toLowerCase() === 'true';
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

      // --- Duplicate detection within CSV (names, SKUs, and item_codes) ---
      const csvNameCounts = new Map<string, number>();
      const csvSkuCounts = new Map<string, number>();
      const csvCodeCounts = new Map<string, number>();
      parsed.forEach(item => {
        if (item.name) {
          const key = item.name.toLowerCase().trim();
          csvNameCounts.set(key, (csvNameCounts.get(key) || 0) + 1);
        }
        if ((item as any).sku) {
          const skuKey = String((item as any).sku).toLowerCase().trim();
          csvSkuCounts.set(skuKey, (csvSkuCounts.get(skuKey) || 0) + 1);
        }
        if (item.item_code) {
          const codeKey = item.item_code.toLowerCase().trim();
          csvCodeCounts.set(codeKey, (csvCodeCounts.get(codeKey) || 0) + 1);
        }
      });

      const seenNames = new Set<string>();
      const seenSkus = new Set<string>();
      const seenCodes = new Set<string>();
      parsed.forEach(item => {
        if (item.name) {
          const nameKey = item.name.toLowerCase().trim();
          if ((csvNameCounts.get(nameKey) || 0) > 1) {
            if (seenNames.has(nameKey)) {
              item.errors.push(`Duplicate name "${item.name}" within CSV`);
            }
            seenNames.add(nameKey);
          }
        }
        if ((item as any).sku) {
          const skuKey = String((item as any).sku).toLowerCase().trim();
          if ((csvSkuCounts.get(skuKey) || 0) > 1) {
            if (seenSkus.has(skuKey)) {
              item.errors.push(`Duplicate SKU "${(item as any).sku}" within CSV`);
            }
            seenSkus.add(skuKey);
          }
        }
        if (item.item_code) {
          const codeKey = item.item_code.toLowerCase().trim();
          if ((csvCodeCounts.get(codeKey) || 0) > 1) {
            if (seenCodes.has(codeKey)) {
              item.errors.push(`Duplicate item code "${item.item_code}" within CSV`);
            }
            seenCodes.add(codeKey);
          }
        }
      });

      // --- Name-based matching against DB ---
      const companyId = selectedCompany?.id || '';
      parsed.forEach(item => {
        if (item.errors.length > 0) {
          item.importStatus = 'error';
          return;
        }

        if (!item.name) {
          item.importStatus = 'error';
          return;
        }

        const existingByName = allExistingItems.find(
          existing =>
            existing.name?.toLowerCase() === item.name!.toLowerCase()
        );

        // Filter items scoped to target company for per-company uniqueness checks
        const targetCompanyItems = allExistingItems.filter(
          existing => existing.company_id === selectedCompany?.id
        );

        if (!existingByName) {
          // Check item_code uniqueness only within target company (constraint is per-company)
          if (item.item_code) {
            const existsCodeInCompany = targetCompanyItems.some(
              existing =>
                existing.item_code?.toLowerCase() === item.item_code?.toLowerCase()
            );
            if (existsCodeInCompany) {
              item.errors.push(`Item code "${item.item_code}" already exists in this company`);
              item.importStatus = 'error';
            }
          }
          // Check SKU uniqueness against DB for new items
          const itemSku = (item as any).sku;
          if (itemSku && typeof itemSku === 'string' && itemSku.trim()) {
            const existsSkuInDb = allExistingItems.some(
              existing =>
                (existing as any).sku?.toLowerCase() === itemSku.toLowerCase()
            );
            if (existsSkuInDb) {
              item.errors.push(`SKU "${itemSku}" already exists in database`);
              item.importStatus = 'error';
            }
          }
          if (item.importStatus !== 'error') {
            item.importStatus = 'new';
          }
        } else if (
          existingByName.item_code?.toLowerCase() !== item.item_code?.toLowerCase() &&
          item.item_code
        ) {
          // Validate that the new code doesn't conflict within the existing item's company
          const existingItemCompanyItems = allExistingItems.filter(
            existing => existing.company_id === existingByName.company_id
          );
          const codeConflict = existingItemCompanyItems.some(
            existing =>
              existing.id !== existingByName.id &&
              existing.item_code?.toLowerCase() === item.item_code?.toLowerCase()
          );
          if (codeConflict) {
            item.errors.push(`Item code "${item.item_code}" already exists for this item's company`);
            item.importStatus = 'error';
          } else {
            item.importStatus = 'update_code';
            item.existingId = existingByName.id;
            item.existingItemCode = existingByName.item_code || '';
          }
        } else {
          item.importStatus = 'duplicate';
        }
      });

      setParsedData(parsed);
      setShowPreview(true);

      const newCount = parsed.filter(i => i.importStatus === 'new').length;
      const dupCount = parsed.filter(i => i.importStatus === 'duplicate').length;
      const updateCount = parsed.filter(i => i.importStatus === 'update_code').length;
      const errorCount = parsed.filter(i => i.importStatus === 'error').length;

      toast({
        title: "CSV Parsed",
        description: `${newCount} new, ${dupCount} duplicates, ${updateCount} code updates, ${errorCount} errors`,
      });
    } catch (error: any) {
      console.error('Error parsing CSV:', error);
      toast({ title: "Error", description: error.message || "Failed to parse CSV file", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const newItems = parsedData.filter(i => i.importStatus === 'new');
  const duplicateItems = parsedData.filter(i => i.importStatus === 'duplicate');
  const updateCodeItems = parsedData.filter(i => i.importStatus === 'update_code');
  const errorItems = parsedData.filter(i => i.importStatus === 'error');
  const enabledUpdateItems = updateCodeItems.filter(i => i.updateCodeEnabled);

  const handleImport = async () => {
    const hasWork = newItems.length > 0 || enabledUpdateItems.length > 0;
    if (!hasWork) {
      toast({ title: "Error", description: "No items to import or update", variant: "destructive" });
      return;
    }

    setIsImporting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "You must be logged in to import items", variant: "destructive" });
        setIsImporting(false);
        return;
      }

      // --- Pre-import safety gate: re-check item_code uniqueness ---
      if (newItems.length > 0) {
        const targetCompanyItems = allExistingItems.filter(
          existing => existing.company_id === selectedCompany?.id
        );
        const existingCodesSet = new Set(
          targetCompanyItems
            .filter(i => i.item_code)
            .map(i => i.item_code!.toLowerCase().trim())
        );

        // Check for intra-batch duplicates and DB conflicts
        const batchCodesSeen = new Set<string>();
        const conflictRows: string[] = [];
        for (const item of newItems) {
          if (!item.item_code) continue;
          const normalized = item.item_code.toLowerCase().trim();
          if (existingCodesSet.has(normalized) || batchCodesSeen.has(normalized)) {
            conflictRows.push(item.item_code);
          }
          batchCodesSeen.add(normalized);
        }

        if (conflictRows.length > 0) {
          toast({
            title: "Item code conflict",
            description: `${conflictRows.length} item code(s) conflict with existing items in this company: ${conflictRows.slice(0, 3).join(', ')}${conflictRows.length > 3 ? '...' : ''}`,
            variant: "destructive",
          });
          setIsImporting(false);
          setShowConfirmation(false);
          return;
        }
      }

      let createdCount = 0;
      let updatedCount = 0;

      // --- Insert new items ---
      if (newItems.length > 0) {
        const validData = newItems.map(({ rowNumber, errors, warnings, initial_stock, bin_id, importStatus, existingId, existingItemCode, updateCodeEnabled, ...item }) => {
          // Sanitize empty strings to null for optional fields to avoid unique constraint violations
          const sanitized = { ...item } as any;
          const nullableFields = ['sku', 'barcode', 'description', 'brand', 'manufacturer', 'notes', 'image_url'];
          for (const field of nullableFields) {
            if (sanitized[field] !== undefined && (!sanitized[field] || String(sanitized[field]).trim() === '')) {
              sanitized[field] = null;
            }
          }
          return sanitized as CreateWarehouseItemData;
        });
        const createdItems = await bulkCreateItemsAsync(validData);
        createdCount = createdItems.length;

        // Handle bin allocations and stock transactions for new items
        const binAllocations: Array<{
          warehouse_item_id: string;
          bin_id: string;
          allocated_quantity: number;
          company_id?: string;
          created_by?: string;
        }> = [];

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
          const originalItem = newItems.find(p => p.item_code === createdItem.item_code);

          if (originalItem?.initial_stock && originalItem.initial_stock > 0 && originalItem?.bin_id) {
            binAllocations.push({
              warehouse_item_id: createdItem.id,
              bin_id: originalItem.bin_id,
              allocated_quantity: originalItem.initial_stock,
              company_id: selectedCompany?.id,
              created_by: user.id,
            });
          }

          if (originalItem?.initial_stock && originalItem.initial_stock > 0) {
            await supabase
              .from('warehouse_items')
              .update({ current_stock: originalItem.initial_stock })
              .eq('id', createdItem.id);

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
              created_by: user.id,
            });
          }
        }

        if (binAllocations.length > 0) {
          const { error } = await supabase.from('warehouse_bin_allocations').insert(binAllocations);
          if (error) console.error('Error creating bin allocations:', error);
          queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
        }

        if (stockTransactions.length > 0) {
          const { error } = await supabase.from('stock_transactions').insert(stockTransactions);
          if (error) console.error('Error creating stock transactions:', error);
          queryClient.invalidateQueries({ queryKey: ['stock-transactions'] });
        }
      }

      // --- Update item codes ---
      if (enabledUpdateItems.length > 0) {
        for (const item of enabledUpdateItems) {
          if (item.existingId && item.item_code) {
            const { error } = await supabase
              .from('warehouse_items')
              .update({ item_code: item.item_code })
              .eq('id', item.existingId);

            if (error) {
              console.error(`Error updating item code for ${item.name}:`, error);
            } else {
              updatedCount++;
            }
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });

      toast({
        title: "Import Complete",
        description: `${createdCount} items created, ${updatedCount} item codes updated, ${duplicateItems.length} duplicates skipped`,
      });

      onSuccess();
    } catch (error: any) {
      console.error('Import error:', error);
      toast({ title: "Error", description: error.message || "Import failed", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const busy = isProcessing || isBulkCreating || isImporting;

  const getStatusBadge = (item: ParsedItem) => {
    switch (item.importStatus) {
      case 'new':
        return <Badge className="bg-green-100 text-green-800 border-green-200">New</Badge>;
      case 'duplicate':
        return <Badge className="bg-muted text-muted-foreground border-border">Duplicate - Skip</Badge>;
      case 'update_code':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Update Code</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
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
          <Input id="csv-file" type="file" accept=".csv" onChange={handleFileChange} disabled={busy} />
        </div>
      </div>

      {showPreview && parsedData.length > 0 && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Total: {parsedData.length}
            </Badge>
            <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              New: {newItems.length}
            </Badge>
            <Badge className="bg-muted text-muted-foreground border-border flex items-center gap-1">
              Duplicates: {duplicateItems.length}
            </Badge>
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              Code Updates: {updateCodeItems.length}
            </Badge>
            {errorItems.length > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Errors: {errorItems.length}
              </Badge>
            )}
          </div>

          {duplicateItems.length > 0 && (
            <Alert>
              <AlertDescription>
                {duplicateItems.length} item(s) already exist with the same name and item code — they will be skipped.
              </AlertDescription>
            </Alert>
          )}

          {updateCodeItems.length > 0 && (
            <Alert className="border-amber-200 bg-amber-50">
              <RefreshCw className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                {updateCodeItems.length} item(s) exist with the same name but a different item code. Use the checkboxes below to update their codes.
              </AlertDescription>
            </Alert>
          )}

          {errorItems.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {errorItems.length} row(s) contain errors and will be skipped.
              </AlertDescription>
            </Alert>
          )}

          <ScrollArea className="h-[300px] border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Row</TableHead>
                  <TableHead>Import Action</TableHead>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Validation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedData.map((item) => (
                  <TableRow
                    key={item.rowNumber}
                    className={
                      item.importStatus === 'error' ? 'bg-red-50' :
                      item.importStatus === 'duplicate' ? 'bg-muted/30 opacity-60' :
                      item.importStatus === 'update_code' ? 'bg-amber-50' :
                      'bg-green-50'
                    }
                  >
                    <TableCell className="font-mono text-xs">{item.rowNumber}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.importStatus === 'update_code' && (
                          <Checkbox
                            checked={item.updateCodeEnabled}
                            onCheckedChange={() => toggleUpdateCode(item.rowNumber)}
                          />
                        )}
                        {getStatusBadge(item)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.importStatus === 'update_code' ? (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-muted-foreground line-through">{item.existingItemCode}</span>
                          <ArrowRight className="h-3 w-3 text-amber-600" />
                          <span className="font-medium text-amber-800">{item.item_code}</span>
                        </div>
                      ) : (
                        <span className="font-medium">{item.item_code || '-'}</span>
                      )}
                    </TableCell>
                    <TableCell>{item.name || '-'}</TableCell>
                    <TableCell>
                      {item.category_id
                        ? categories.find(c => c.id === item.category_id)?.name
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {item.errors.map((error, idx) => (
                          <div key={idx} className="flex items-center gap-1 text-xs text-destructive">
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
                        {item.errors.length === 0 && item.warnings.length === 0 && item.importStatus === 'new' && (
                          <div className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Ready to import
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          {showConfirmation ? (
            <div className="space-y-4 rounded-lg border bg-card p-4">
              <h3 className="text-lg font-semibold text-card-foreground">Confirm Import</h3>
              <p className="text-sm text-muted-foreground">Review the summary below before proceeding.</p>

              <div className="grid gap-3 sm:grid-cols-2">
                {newItems.length > 0 && (
                  <div className="rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-800 dark:text-green-300">Create ({newItems.length})</span>
                    </div>
                    <ScrollArea className="max-h-32">
                      <ul className="space-y-1 text-xs text-green-700 dark:text-green-400">
                        {newItems.map(item => (
                          <li key={item.rowNumber} className="truncate">
                            {item.item_code ? <span className="font-mono">{item.item_code}</span> : null}
                            {item.item_code && item.name ? ' — ' : ''}
                            {item.name}
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </div>
                )}

                {enabledUpdateItems.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                    <div className="flex items-center gap-2 mb-2">
                      <RefreshCw className="h-4 w-4 text-amber-600" />
                      <span className="font-medium text-amber-800 dark:text-amber-300">Update Code ({enabledUpdateItems.length})</span>
                    </div>
                    <ScrollArea className="max-h-32">
                      <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-400">
                        {enabledUpdateItems.map(item => (
                          <li key={item.rowNumber} className="flex items-center gap-1 truncate">
                            <span className="font-mono line-through">{item.existingItemCode || '(none)'}</span>
                            <ArrowRight className="h-3 w-3 shrink-0" />
                            <span className="font-mono font-medium">{item.item_code}</span>
                            <span className="text-muted-foreground ml-1">({item.name})</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </div>
                )}

                {duplicateItems.length > 0 && (
                  <div className="rounded-md border bg-muted/30 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-muted-foreground">Skipped — Duplicates ({duplicateItems.length})</span>
                    </div>
                    <p className="text-xs text-muted-foreground">These items already exist and will not be changed.</p>
                  </div>
                )}

                {errorItems.length > 0 && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="font-medium text-destructive">Errors ({errorItems.length})</span>
                    </div>
                    <p className="text-xs text-muted-foreground">These items have validation errors and will be skipped.</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowConfirmation(false)} disabled={busy}>
                  Back
                </Button>
                <Button onClick={handleImport} disabled={busy}>
                  {busy ? 'Importing...' : 'Confirm Import'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onCancel} disabled={busy}>
                Cancel
              </Button>
              <Button
                onClick={() => setShowConfirmation(true)}
                disabled={(newItems.length === 0 && enabledUpdateItems.length === 0) || busy}
              >
                {`Import ${newItems.length} New${enabledUpdateItems.length > 0 ? ` + Update ${enabledUpdateItems.length} Codes` : ''}`}
              </Button>
            </div>
          )}
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
