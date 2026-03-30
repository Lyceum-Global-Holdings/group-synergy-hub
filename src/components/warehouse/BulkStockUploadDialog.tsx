import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Download, Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { useLocationFilter } from '@/contexts/LocationFilterContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';

interface CatalogItem {
  id: string;
  item_code: string;
  name: string;
  description: string | null;
  category_id: string | null;
  unit_id: string | null;
  brand: string | null;
  manufacturer: string | null;
  barcode: string | null;
  sku: string | null;
  unit_cost: number | null;
  selling_price: number | null;
  reorder_level: number | null;
  min_stock_level: number | null;
  max_stock_level: number | null;
  image_url: string | null;
  is_batch_tracked: boolean | null;
  is_serialized: boolean | null;
}

interface ParsedRow {
  rowNumber: number;
  item_code: string;
  quantity: number;
  bin_code: string;
  // resolved
  item_id?: string;
  item_name?: string;
  bin_id?: string;
  catalog_item?: CatalogItem;
  existing_inventory_id?: string;
  needs_import?: boolean;
  status: 'matched' | 'new_to_inventory' | 'item_not_found' | 'bin_not_found' | 'error';
  error?: string;
}

interface BulkStockUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkStockUploadDialog({ open, onOpenChange }: BulkStockUploadDialogProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [binMode, setBinMode] = useState<'single' | 'per-row'>('per-row');
  const [selectedBinId, setSelectedBinId] = useState<string>('');

  const { selectedCompany } = useCompany();
  const { locations } = useWarehouseLocations();
  const { globalLocationId } = useLocationFilter();
  const queryClient = useQueryClient();

  // Only top-level locations
  const topLocations = useMemo(() =>
    (locations || []).filter(l => !l.parent_id),
    [locations]
  );

  // Pre-select from global filter
  const effectiveLocationId = selectedLocationId || globalLocationId || '';

  // Fetch bins for the selected location
  const { data: locationBins = [] } = useQuery({
    queryKey: ['warehouse-bins-for-location', effectiveLocationId],
    queryFn: async (): Promise<{ id: string; bin_code: string; description: string | null }[]> => {
      if (!effectiveLocationId) return [];
      let query: any = supabase
        .from('warehouse_bins')
        .select('id, bin_code, description');
      query = query.eq('location_id', effectiveLocationId).eq('status', 'active').order('bin_code');
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as { id: string; bin_code: string; description: string | null }[];
    },
    enabled: !!effectiveLocationId,
  });

  // Reset selected bin when location changes
  useEffect(() => {
    setSelectedBinId('');
  }, [effectiveLocationId]);

  const selectedBinLabel = useMemo(() => {
    const bin = locationBins.find(b => b.id === selectedBinId);
    return bin ? bin.bin_code : '';
  }, [locationBins, selectedBinId]);

  const downloadTemplate = () => {
    const csv = binMode === 'single'
      ? 'item_code,quantity\nITEM001,50\nITEM002,100'
      : 'item_code,quantity,bin_code\nITEM001,50,BIN-A1\nITEM002,100,BIN-B2';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock_upload_template.csv';
    a.click();
    URL.revokeObjectURL(url);
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
        if (inQuotes && nextChar === '"') { currentField += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
        if (char === '\r') i++;
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f !== '')) lines.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f !== '')) lines.push(currentRow);
    return lines;
  };

  const handleFileUpload = async (file: File) => {
    setCsvFile(file);
    if (!selectedCompany?.id) {
      toast.error('Please select a company first');
      return;
    }
    if (!effectiveLocationId) {
      toast.error('Please select a location first');
      return;
    }
    if (binMode === 'single' && !selectedBinId) {
      toast.error('Please select a bin first');
      return;
    }

    setIsValidating(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length < 2) {
        toast.error('CSV must have a header row and at least one data row');
        setIsValidating(false);
        return;
      }

      const headers = rows[0].map(h => h.toLowerCase().replace(/\s+/g, '_'));
      const codeIdx = headers.indexOf('item_code');
      const qtyIdx = headers.indexOf('quantity');
      const binIdx = headers.indexOf('bin_code');

      if (codeIdx === -1 || qtyIdx === -1) {
        toast.error('CSV must have columns: item_code, quantity' + (binMode === 'per-row' ? ', bin_code' : ''));
        setIsValidating(false);
        return;
      }

      if (binMode === 'per-row' && binIdx === -1) {
        toast.error('CSV must have a bin_code column when using per-row bin mode');
        setIsValidating(false);
        return;
      }

      const dataRows = rows.slice(1);
      const itemCodesOriginal = [...new Set(dataRows.map(r => (r[codeIdx] || '').trim()).filter(Boolean))];

      // Fetch items from global catalog by item_code (batch)
      const catalogMap = new Map<string, CatalogItem>();
      for (let i = 0; i < itemCodesOriginal.length; i += 500) {
        const chunk = itemCodesOriginal.slice(i, i + 500);
        const { data } = await supabase
          .from('warehouse_item_catalog')
          .select('id, item_code, name, description, category_id, unit_id, brand, manufacturer, barcode, sku, unit_cost, selling_price, reorder_level, min_stock_level, max_stock_level, image_url, is_batch_tracked, is_serialized')
          .eq('status', 'active')
          .in('item_code', chunk);
        data?.forEach(item => {
          catalogMap.set((item.item_code || '').toLowerCase().trim(), item as CatalogItem);
        });
      }

      // Fetch existing inventory items for this company to check which already exist
      const inventoryMap = new Map<string, string>(); // item_code -> warehouse_items.id
      const allCatalogIds = [...catalogMap.values()].map(c => c.id);
      for (let i = 0; i < allCatalogIds.length; i += 500) {
        const chunk = allCatalogIds.slice(i, i + 500);
        const { data } = await supabase
          .from('warehouse_items')
          .select('id, item_code, catalog_item_id')
          .eq('company_id', selectedCompany.id)
          .in('catalog_item_id', chunk);
        data?.forEach(item => {
          inventoryMap.set((item.item_code || '').toLowerCase().trim(), item.id);
        });
      }

      // Fetch bins for this location (only needed for per-row mode)
      const binMap = new Map<string, string>();
      if (binMode === 'per-row') {
        const binCodesOriginal = [...new Set(dataRows.map(r => (r[binIdx] || '').trim()).filter(Boolean))];
        for (let i = 0; i < binCodesOriginal.length; i += 500) {
          const chunk = binCodesOriginal.slice(i, i + 500);
          const { data } = await supabase
            .from('warehouse_bins')
            .select('id, bin_code')
            .eq('location_id', effectiveLocationId)
            .in('bin_code', chunk);
          data?.forEach(bin => {
            binMap.set((bin.bin_code || '').toLowerCase().trim(), bin.id);
          });
        }
      }

      // Parse and validate
      const parsed: ParsedRow[] = dataRows.map((row, idx) => {
        const itemCode = (row[codeIdx] || '').trim();
        const qtyStr = (row[qtyIdx] || '').trim();
        const binCode = binMode === 'single' ? selectedBinLabel : (row[binIdx] || '').trim();
        const binId = binMode === 'single' ? selectedBinId : binMap.get(binCode.toLowerCase());
        const qty = parseFloat(qtyStr);

        if (!itemCode || !qtyStr) {
          return { rowNumber: idx + 2, item_code: itemCode, quantity: 0, bin_code: binCode, status: 'error' as const, error: 'Missing required fields' };
        }
        if (binMode === 'per-row' && !binCode) {
          return { rowNumber: idx + 2, item_code: itemCode, quantity: 0, bin_code: '', status: 'error' as const, error: 'Missing bin_code' };
        }
        if (isNaN(qty) || qty <= 0) {
          return { rowNumber: idx + 2, item_code: itemCode, quantity: 0, bin_code: binCode, status: 'error' as const, error: 'Quantity must be a positive number' };
        }

        const catalogItem = catalogMap.get(itemCode.toLowerCase());
        if (!catalogItem) {
          return { rowNumber: idx + 2, item_code: itemCode, quantity: qty, bin_code: binCode, status: 'item_not_found' as const, error: `Item code "${itemCode}" not found in Item Master` };
        }

        if (!binId) {
          return { rowNumber: idx + 2, item_code: itemCode, quantity: qty, bin_code: binCode, item_name: catalogItem.name, catalog_item: catalogItem, status: 'bin_not_found' as const, error: `Bin "${binCode}" not found at this location` };
        }

        const existingId = inventoryMap.get(itemCode.toLowerCase());
        if (existingId) {
          return { rowNumber: idx + 2, item_code: itemCode, quantity: qty, bin_code: binCode, item_id: existingId, item_name: catalogItem.name, bin_id: binId, catalog_item: catalogItem, existing_inventory_id: existingId, status: 'matched' as const };
        } else {
          return { rowNumber: idx + 2, item_code: itemCode, quantity: qty, bin_code: binCode, item_name: catalogItem.name, bin_id: binId, catalog_item: catalogItem, needs_import: true, status: 'new_to_inventory' as const };
        }
      });

      setParsedRows(parsed);
      setShowPreview(true);
    } catch (err) {
      console.error('CSV parse error:', err);
      toast.error('Failed to parse CSV file');
    } finally {
      setIsValidating(false);
    }
  };

  const importableRows = parsedRows.filter(r => r.status === 'matched' || r.status === 'new_to_inventory');
  const errorRows = parsedRows.filter(r => r.status !== 'matched' && r.status !== 'new_to_inventory');
  const newToInventoryRows = parsedRows.filter(r => r.status === 'new_to_inventory');

  const handleImport = async () => {
    if (importableRows.length === 0) return;
    setIsImporting(true);

    let successCount = 0;
    let failCount = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Process rows in parallel batches of 10 for speed
      const BATCH_SIZE = 10;
      for (let i = 0; i < importableRows.length; i += BATCH_SIZE) {
        const batch = importableRows.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async (row) => {
            let itemId = row.item_id;

            // Auto-import from catalog if needed
            if (row.needs_import && row.catalog_item) {
              const cat = row.catalog_item;

              const { data: existingRow } = await supabase
                .from('warehouse_items')
                .select('id')
                .eq('company_id', selectedCompany!.id)
                .or(`catalog_item_id.eq.${cat.id},item_code.eq.${cat.item_code}`)
                .maybeSingle();

              if (existingRow) {
                await supabase
                  .from('warehouse_items')
                  .update({
                    current_stock: 0,
                    reserved_quantity: 0,
                    status: 'active',
                    location_id: effectiveLocationId || null,
                    name: cat.name,
                    description: cat.description,
                    category_id: cat.category_id,
                    unit_id: cat.unit_id,
                    brand: cat.brand,
                    manufacturer: cat.manufacturer,
                    barcode: cat.barcode,
                    sku: cat.sku,
                    unit_cost: cat.unit_cost,
                    selling_price: cat.selling_price,
                    reorder_level: cat.reorder_level,
                    min_stock_level: cat.min_stock_level,
                    max_stock_level: cat.max_stock_level,
                    image_url: cat.image_url,
                    is_batch_tracked: cat.is_batch_tracked,
                    is_serialized: cat.is_serialized,
                  })
                  .eq('id', existingRow.id);
                itemId = existingRow.id;
              } else {
                const { data: newItem, error: insertError } = await supabase
                  .from('warehouse_items')
                  .insert({
                    catalog_item_id: cat.id,
                    item_code: cat.item_code,
                    name: cat.name,
                    description: cat.description,
                    category_id: cat.category_id,
                    unit_id: cat.unit_id,
                    brand: cat.brand,
                    manufacturer: cat.manufacturer,
                    barcode: cat.barcode,
                    sku: cat.sku,
                    unit_cost: cat.unit_cost,
                    selling_price: cat.selling_price,
                    reorder_level: cat.reorder_level,
                    min_stock_level: cat.min_stock_level,
                    max_stock_level: cat.max_stock_level,
                    image_url: cat.image_url,
                    is_batch_tracked: cat.is_batch_tracked,
                    is_serialized: cat.is_serialized,
                    status: 'active',
                    company_id: selectedCompany!.id,
                    location_id: effectiveLocationId || null,
                    current_stock: 0,
                    reserved_quantity: 0,
                    created_by: user?.id,
                  })
                  .select('id')
                  .single();
                if (insertError) throw insertError;
                itemId = newItem.id;
              }
            }

            if (!itemId) throw new Error('Could not resolve item ID');

            // Read current_stock BEFORE updating allocation
            const { data: itemData } = await supabase
              .from('warehouse_items')
              .select('current_stock')
              .eq('id', itemId)
              .single();
            const qtyBefore = Number(itemData?.current_stock || 0);

            // Upsert bin allocation (no available_quantity — it's a generated column)
            const { error: allocErr } = await supabase
              .from('warehouse_bin_allocations')
              .upsert(
                {
                  warehouse_item_id: itemId,
                  bin_id: row.bin_id!,
                  allocated_quantity: row.quantity,
                  company_id: selectedCompany?.id,
                },
                { onConflict: 'warehouse_item_id,bin_id,company_id' }
              );
            if (allocErr) {
              // Fallback: if upsert fails due to existing row, do additive update
              const { data: existing } = await supabase
                .from('warehouse_bin_allocations')
                .select('id, allocated_quantity')
                .eq('warehouse_item_id', itemId)
                .eq('bin_id', row.bin_id!)
                .eq('company_id', selectedCompany?.id || '')
                .maybeSingle();
              if (existing) {
                const newQty = (existing.allocated_quantity || 0) + row.quantity;
                await supabase
                  .from('warehouse_bin_allocations')
                  .update({ allocated_quantity: newQty })
                  .eq('id', existing.id);
              } else {
                throw allocErr;
              }
            }

            // Create stock transaction
            await supabase
              .from('stock_transactions')
              .insert({
                item_id: itemId,
                transaction_type: 'opening_stock',
                reference_type: 'manual',
                quantity_change: row.quantity,
                quantity_before: qtyBefore,
                quantity_after: qtyBefore + row.quantity,
                notes: `Bulk stock upload - Bin: ${row.bin_code}`,
                company_id: selectedCompany?.id,
                created_by: user?.id,
              });
          })
        );

        results.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            successCount++;
          } else {
            console.error(`Failed to process row ${batch[idx].rowNumber}:`, result.reason);
            failCount++;
          }
        });
      }

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['all-items-location-stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items-lazy-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items-catalog-ids'] });

      if (failCount === 0) {
        toast.success(`Successfully uploaded stock for ${successCount} items`);
      } else {
        toast.warning(`Uploaded ${successCount} items, ${failCount} failed`);
      }

      handleReset();
      onOpenChange(false);
    } catch (err) {
      console.error('Bulk stock upload error:', err);
      toast.error('Failed to upload stock');
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setCsvFile(null);
    setParsedRows([]);
    setShowPreview(false);
  };

  const statusBadge = (status: ParsedRow['status']) => {
    switch (status) {
      case 'matched': return <Badge className="bg-green-100 text-green-800 border-green-200">Matched</Badge>;
      case 'new_to_inventory': return <Badge className="bg-blue-100 text-blue-800 border-blue-200">New to Inventory</Badge>;
      case 'item_not_found': return <Badge variant="destructive">Not in Item Master</Badge>;
      case 'bin_not_found': return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Bin Not Found</Badge>;
      case 'error': return <Badge variant="destructive">Error</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isImporting) { onOpenChange(v); if (!v) handleReset(); } }}>
      <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload Stock via CSV</DialogTitle>
        </DialogHeader>

        {!showPreview ? (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Upload a CSV to add stock quantities. Items are matched by <strong>item_code</strong> from the Item Master catalog. Items not yet in this company's inventory will be auto-imported.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Company</Label>
                <Input value={selectedCompany?.name || 'No company selected'} disabled />
              </div>
              <div>
                <Label>Location</Label>
                <Select value={effectiveLocationId} onValueChange={setSelectedLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {topLocations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bin Selection Mode */}
            <div className="space-y-3 rounded-md border p-3">
              <Label className="text-sm font-medium">Bin Assignment</Label>
              <RadioGroup
                value={binMode}
                onValueChange={(v) => setBinMode(v as 'single' | 'per-row')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="single" id="bin-single" />
                  <Label htmlFor="bin-single" className="text-sm font-normal cursor-pointer">
                    Single bin for all rows
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="per-row" id="bin-per-row" />
                  <Label htmlFor="bin-per-row" className="text-sm font-normal cursor-pointer">
                    Per-row bin (from CSV)
                  </Label>
                </div>
              </RadioGroup>

              {binMode === 'single' && (
                <Select
                  value={selectedBinId}
                  onValueChange={setSelectedBinId}
                  disabled={!effectiveLocationId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={effectiveLocationId ? 'Select bin' : 'Select a location first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {locationBins.map(bin => (
                      <SelectItem key={bin.id} value={bin.id}>
                        {bin.bin_code}{bin.description ? ` — ${bin.description}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" /> Download Template
              </Button>
              <span className="text-xs text-muted-foreground">
                {binMode === 'single' ? 'Template: item_code, quantity' : 'Template: item_code, quantity, bin_code'}
              </span>
            </div>

            <div>
              <Label>CSV File</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                disabled={isValidating || !selectedCompany?.id || !effectiveLocationId || (binMode === 'single' && !selectedBinId)}
              />
            </div>

            {isValidating && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Validating CSV...
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-4 flex-wrap">
              <Badge variant="outline" className="text-green-700">
                <CheckCircle2 className="mr-1 h-3 w-3" /> {importableRows.length} ready
              </Badge>
              {newToInventoryRows.length > 0 && (
                <Badge variant="outline" className="text-blue-700">
                  {newToInventoryRows.length} new to inventory
                </Badge>
              )}
              {errorRows.length > 0 && (
                <Badge variant="destructive">
                  <AlertCircle className="mr-1 h-3 w-3" /> {errorRows.length} errors
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Total: {parsedRows.length} rows
              </span>
              {binMode === 'single' && selectedBinLabel && (
                <Badge variant="secondary">
                  Bin: {selectedBinLabel}
                </Badge>
              )}
            </div>

            <ScrollArea className="h-[400px] border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Row</TableHead>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    {binMode === 'per-row' && <TableHead>Bin</TableHead>}
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, idx) => (
                    <TableRow key={idx} className={row.status !== 'matched' && row.status !== 'new_to_inventory' ? 'bg-destructive/5' : ''}>
                      <TableCell className="text-xs text-muted-foreground">{row.rowNumber}</TableCell>
                      <TableCell className="font-mono text-xs">{row.item_code}</TableCell>
                      <TableCell className="text-sm">{row.item_name || '-'}</TableCell>
                      <TableCell className="text-right">{row.quantity || '-'}</TableCell>
                      {binMode === 'per-row' && <TableCell className="font-mono text-xs">{row.bin_code}</TableCell>}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {statusBadge(row.status)}
                          {row.error && <span className="text-xs text-destructive">{row.error}</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="gap-2">
          {showPreview && (
            <Button variant="outline" onClick={handleReset} disabled={isImporting}>
              Back
            </Button>
          )}
          <Button variant="outline" onClick={() => { onOpenChange(false); handleReset(); }} disabled={isImporting}>
            Cancel
          </Button>
          {showPreview && importableRows.length > 0 && (
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...</>
              ) : (
                <><Upload className="mr-2 h-4 w-4" /> Import {importableRows.length} Items</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
