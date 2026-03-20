import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { useLocationFilter } from '@/contexts/LocationFilterContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface ParsedRow {
  rowNumber: number;
  item_code: string;
  quantity: number;
  bin_code: string;
  // resolved
  item_id?: string;
  item_name?: string;
  bin_id?: string;
  status: 'matched' | 'item_not_found' | 'bin_not_found' | 'error';
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

  const downloadTemplate = () => {
    const csv = 'item_code,quantity,bin_code\nITEM001,50,BIN-A1\nITEM002,100,BIN-B2';
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

      if (codeIdx === -1 || qtyIdx === -1 || binIdx === -1) {
        toast.error('CSV must have columns: item_code, quantity, bin_code');
        setIsValidating(false);
        return;
      }

      const dataRows = rows.slice(1);
      const itemCodes = [...new Set(dataRows.map(r => (r[codeIdx] || '').toLowerCase().trim()).filter(Boolean))];
      const binCodes = [...new Set(dataRows.map(r => (r[binIdx] || '').toLowerCase().trim()).filter(Boolean))];

      // Fetch items for this company by item_code (batch)
      const itemMap = new Map<string, { id: string; name: string }>();
      for (let i = 0; i < itemCodes.length; i += 500) {
        const chunk = itemCodes.slice(i, i + 500);
        const { data } = await supabase
          .from('warehouse_items')
          .select('id, name, item_code')
          .eq('company_id', selectedCompany.id)
          .in('item_code', chunk);
        data?.forEach(item => {
          itemMap.set((item.item_code || '').toLowerCase().trim(), { id: item.id, name: item.name });
        });
      }

      // Fetch bins for this location
      const binMap = new Map<string, string>();
      for (let i = 0; i < binCodes.length; i += 500) {
        const chunk = binCodes.slice(i, i + 500);
        const { data } = await supabase
          .from('warehouse_bins')
          .select('id, bin_code')
          .eq('location_id', effectiveLocationId)
          .in('bin_code', chunk);
        data?.forEach(bin => {
          binMap.set((bin.bin_code || '').toLowerCase().trim(), bin.id);
        });
      }

      // Parse and validate
      const parsed: ParsedRow[] = dataRows.map((row, idx) => {
        const itemCode = (row[codeIdx] || '').trim();
        const qtyStr = (row[qtyIdx] || '').trim();
        const binCode = (row[binIdx] || '').trim();
        const qty = parseFloat(qtyStr);

        if (!itemCode || !binCode || !qtyStr) {
          return { rowNumber: idx + 2, item_code: itemCode, quantity: 0, bin_code: binCode, status: 'error' as const, error: 'Missing required fields' };
        }
        if (isNaN(qty) || qty <= 0) {
          return { rowNumber: idx + 2, item_code: itemCode, quantity: 0, bin_code: binCode, status: 'error' as const, error: 'Quantity must be a positive number' };
        }

        const item = itemMap.get(itemCode.toLowerCase());
        if (!item) {
          return { rowNumber: idx + 2, item_code: itemCode, quantity: qty, bin_code: binCode, status: 'item_not_found' as const, error: `Item code "${itemCode}" not found in inventory` };
        }

        const binId = binMap.get(binCode.toLowerCase());
        if (!binId) {
          return { rowNumber: idx + 2, item_code: itemCode, quantity: qty, bin_code: binCode, item_id: item.id, item_name: item.name, status: 'bin_not_found' as const, error: `Bin "${binCode}" not found at this location` };
        }

        return { rowNumber: idx + 2, item_code: itemCode, quantity: qty, bin_code: binCode, item_id: item.id, item_name: item.name, bin_id: binId, status: 'matched' as const };
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

  const matchedRows = parsedRows.filter(r => r.status === 'matched');
  const errorRows = parsedRows.filter(r => r.status !== 'matched');

  const handleImport = async () => {
    if (matchedRows.length === 0) return;
    setIsImporting(true);

    let successCount = 0;
    let failCount = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      for (const row of matchedRows) {
        try {
          // Check existing allocation
          const { data: existing } = await supabase
            .from('warehouse_bin_allocations')
            .select('id, allocated_quantity')
            .eq('warehouse_item_id', row.item_id!)
            .eq('bin_id', row.bin_id!)
            .maybeSingle();

          if (existing) {
            const newQty = (existing.allocated_quantity || 0) + row.quantity;
            await supabase
              .from('warehouse_bin_allocations')
              .update({ allocated_quantity: newQty, available_quantity: newQty })
              .eq('id', existing.id);
          } else {
            await supabase
              .from('warehouse_bin_allocations')
              .insert({
                warehouse_item_id: row.item_id!,
                bin_id: row.bin_id!,
                allocated_quantity: row.quantity,
                available_quantity: row.quantity,
                company_id: selectedCompany?.id,
              });
          }

          // Get current stock for transaction record
          const { data: itemData } = await supabase
            .from('warehouse_items')
            .select('current_stock')
            .eq('id', row.item_id!)
            .single();

          const qtyBefore = itemData?.current_stock || 0;

          // Create stock transaction
          await supabase
            .from('stock_transactions')
            .insert({
              item_id: row.item_id!,
              transaction_type: 'opening_stock',
              reference_type: 'manual',
              quantity_change: row.quantity,
              quantity_before: qtyBefore,
              quantity_after: qtyBefore + row.quantity,
              notes: `Bulk stock upload - Bin: ${row.bin_code}`,
              company_id: selectedCompany?.id,
              created_by: user?.id,
            });

          successCount++;
        } catch (err) {
          console.error(`Failed to process row ${row.rowNumber}:`, err);
          failCount++;
        }
      }

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['all-items-location-stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items-lazy-inventory'] });

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
      case 'item_not_found': return <Badge variant="destructive">Item Not Found</Badge>;
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
                Upload a CSV to add stock quantities to existing inventory items. Items are matched by <strong>item_code</strong> and bins by <strong>bin_code</strong>.
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

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" /> Download Template
              </Button>
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
                disabled={isValidating || !selectedCompany?.id || !effectiveLocationId}
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
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-green-700">
                <CheckCircle2 className="mr-1 h-3 w-3" /> {matchedRows.length} matched
              </Badge>
              {errorRows.length > 0 && (
                <Badge variant="destructive">
                  <AlertCircle className="mr-1 h-3 w-3" /> {errorRows.length} errors
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Total: {parsedRows.length} rows
              </span>
            </div>

            <ScrollArea className="flex-1 max-h-[400px] border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Row</TableHead>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Bin</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, idx) => (
                    <TableRow key={idx} className={row.status !== 'matched' ? 'bg-destructive/5' : ''}>
                      <TableCell className="text-xs text-muted-foreground">{row.rowNumber}</TableCell>
                      <TableCell className="font-mono text-xs">{row.item_code}</TableCell>
                      <TableCell className="text-sm">{row.item_name || '-'}</TableCell>
                      <TableCell className="text-right">{row.quantity || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{row.bin_code}</TableCell>
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
          {showPreview && matchedRows.length > 0 && (
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...</>
              ) : (
                <><Upload className="mr-2 h-4 w-4" /> Import {matchedRows.length} Items</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
