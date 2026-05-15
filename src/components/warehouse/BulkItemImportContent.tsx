import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, FileText, AlertCircle, CheckCircle2, ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWarehouseItemCatalog } from '@/hooks/useWarehouseItemCatalog';
import { useItemCategories } from '@/hooks/useItemCategories';
import { useItemUnits } from '@/hooks/useItemUnits';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCompany } from '@/contexts/CompanyContext';
import { CreateCatalogItemData } from '@/types/itemBin';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { parseCSV, downloadCSV, allocateAutoCodes } from '@/lib/bulkImport';
type ImportStatus = 'new' | 'duplicate' | 'update_code' | 'error';

interface ParsedItem extends Partial<CreateCatalogItemData> {
  rowNumber: number;
  errors: string[];
  warnings: string[];
  importStatus: ImportStatus;
  existingId?: string;
  existingItemCode?: string;
  updateCodeEnabled?: boolean;
  autoGenerateCode?: boolean;
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
  const { bulkCreateItemsAsync, isBulkCreating, items: allExistingItems } = useWarehouseItemCatalog();
  // allExistingItems comes from useWarehouseItemCatalog above
  const { categories } = useItemCategories();
  const { units } = useItemUnits();
  const { data: suppliers = [] } = useSuppliers();
  const { companies, selectedCompany } = useCompany();
  const { locations } = useWarehouseLocations();
  const queryClient = useQueryClient();

  const downloadTemplate = () => {
    const headers = [
      'item_code', 'name', 'description', 'category', 'unit', 'location',
      'reorder_level', 'min_stock_level', 'max_stock_level',
      'unit_cost', 'selling_price', 'barcode', 'sku', 'brand', 'manufacturer',
      'supplier', 'status', 'is_serialized', 'is_batch_tracked', 'notes', 'company'
    ];

    // Sample row leaves item_code BLANK so it auto-generates as INV-{CAT}-{NNN}
    const sampleRow = [
      '', 'Sample Item', 'This is a sample item', 'Electronics', 'PCS',
      'Main Warehouse', '10', '5', '100', '50.00', '75.00',
      '123456789', 'SKU001', 'Sample Brand', 'Sample Manufacturer', 'Sample Supplier',
      'active', 'false', 'false', 'Sample notes', 'Sample Company'
    ];

    downloadCSV('item_import_template.csv', headers, [sampleRow]);
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
                // Blank → mark for auto-generation; validated later when category is known
                item.autoGenerateCode = true;
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
                const location = locations.find(l =>
                  (['location', 'sublocation', 'department'].includes(l.type ?? 'location')) && (
                    l.name.toLowerCase() === value.toLowerCase() ||
                    l.location_code?.toLowerCase() === value.toLowerCase()
                  )
                );
                if (location) item.location_id = location.id;
                else item.warnings.push(`Warehouse location "${value}" not found`);
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
              // Company column ignored for catalog imports (catalog is global)
              if (value) {
                item.warnings.push('Company column ignored — catalog items are global');
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


        parsed.push(item);
      }

      // --- Validate auto-generation requirements ---
      // Rows with blank item_code need a resolvable category that has a 3-letter mnemonic code.
      parsed.forEach(item => {
        if (item.autoGenerateCode) {
          if (!item.category_id) {
            item.errors.push('Item code is required when category is missing — provide an item_code or set a valid category for auto-generation');
            return;
          }
          const cat = categories.find(c => c.id === item.category_id);
          if (!cat?.code || !cat.code.trim()) {
            item.errors.push(`Category "${cat?.name || 'unknown'}" has no 3-letter code — cannot auto-generate item code`);
          }
        }
      });

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

      // --- Name-based matching against global catalog ---
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

        if (!existingByName) {
          // Check item_code uniqueness globally (catalog has unique item_code)
          if (item.item_code) {
            const existsCode = allExistingItems.some(
              existing =>
                existing.item_code?.toLowerCase() === item.item_code?.toLowerCase()
            );
            if (existsCode) {
              item.errors.push(`Item code "${item.item_code}" already exists in catalog`);
              item.importStatus = 'error';
            }
          }
          // Check SKU uniqueness against catalog
          const itemSku = (item as any).sku;
          if (itemSku && typeof itemSku === 'string' && itemSku.trim()) {
            const existsSkuInDb = allExistingItems.some(
              existing =>
                (existing as any).sku?.toLowerCase() === itemSku.toLowerCase()
            );
            if (existsSkuInDb) {
              item.errors.push(`SKU "${itemSku}" already exists in catalog`);
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
          // Check if new code conflicts with another catalog item
          const codeConflict = allExistingItems.some(
            existing =>
              existing.id !== existingByName.id &&
              existing.item_code?.toLowerCase() === item.item_code?.toLowerCase()
          );
          if (codeConflict) {
            item.errors.push(`Item code "${item.item_code}" already exists in catalog`);
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

      // --- Auto-generate item codes for rows that need them (batch-aware) ---
      // Delegates grouping + sequential allocation to the shared bulk-import pipeline.
      const rowsNeedingCodes = newItems.filter(i => i.autoGenerateCode && !i.item_code && i.category_id);
      if (rowsNeedingCodes.length > 0) {
        const allocated = await allocateAutoCodes(rowsNeedingCodes as any, categories, { scope: 'catalog' });
        const failedRows = rowsNeedingCodes.filter(r => !r.item_code);
        if (!allocated || failedRows.length > 0) {
          const firstError = failedRows[0]?.errors?.find(e => e.toLowerCase().includes('allocation') || e.toLowerCase().includes('code'));
          toast({
            title: "Code allocation failed",
            description: firstError || 'Unable to auto-generate item codes',
            variant: "destructive",
          });
          setIsImporting(false);
          setShowConfirmation(false);
          return;
        }
        // Force re-render so preview reflects newly assigned codes
        setParsedData(prev => [...prev]);
      }

      // --- Pre-import safety gate: re-check item_code uniqueness in catalog ---
      if (newItems.length > 0) {
        const existingCodesSet = new Set(
          allExistingItems
            .filter(i => i.item_code)
            .map(i => i.item_code!.toLowerCase().trim())
        );

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
            description: `${conflictRows.length} item code(s) conflict with existing catalog items: ${conflictRows.slice(0, 3).join(', ')}${conflictRows.length > 3 ? '...' : ''}`,
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
        const validData = newItems.map(({ rowNumber, errors, warnings, importStatus, existingId, existingItemCode, updateCodeEnabled, autoGenerateCode, ...item }) => {
          const sanitized = { ...item } as any;
          const nullableFields = ['sku', 'barcode', 'description', 'brand', 'manufacturer', 'notes', 'image_url'];
          for (const field of nullableFields) {
            if (sanitized[field] !== undefined && (!sanitized[field] || String(sanitized[field]).trim() === '')) {
              sanitized[field] = null;
            }
          }
          // Ensure status is set
          if (!sanitized.status) sanitized.status = 'active';
          return sanitized as CreateCatalogItemData;
        });
        const createdItems = await bulkCreateItemsAsync(validData);
        createdCount = createdItems.length;

      }

      // --- Update item codes ---
      if (enabledUpdateItems.length > 0) {
        for (const item of enabledUpdateItems) {
          if (item.existingId && item.item_code) {
            const { error } = await supabase
              .from('warehouse_item_catalog')
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

      queryClient.invalidateQueries({ queryKey: ['warehouse-item-catalog'] });

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
      <Alert>
        <Sparkles className="h-4 w-4" />
        <AlertDescription>
          Leave <span className="font-mono font-medium">item_code</span> blank to auto-generate codes following the standard{' '}
          <span className="font-mono font-medium">INV-{'{CATEGORY}'}-{'{SEQUENCE}'}</span> (GS1 / ISO 8000-110). A valid category with a 3-letter mnemonic is required.
        </AlertDescription>
      </Alert>
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
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.item_code || (item.autoGenerateCode ? <span className="text-muted-foreground italic">auto on import</span> : '-')}</span>
                          {item.autoGenerateCode && (
                            <Badge variant="outline" className="gap-1 text-[10px] py-0 px-1.5">
                              <Sparkles className="h-2.5 w-2.5" />
                              Auto
                            </Badge>
                          )}
                        </div>
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
