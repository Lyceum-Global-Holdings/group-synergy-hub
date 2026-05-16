import { useState, useMemo, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Download,
  Upload,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { useItemCategories } from '@/hooks/useItemCategories';
import { useItemUnits } from '@/hooks/useItemUnits';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { useWarehouseBins } from '@/hooks/useWarehouseBins';
import { COLUMNS, Row, emptyRow, STATUS_OPTIONS } from './excel-import/excelColumns';
import { Lookups, RowError, toPayload, validateRow } from './excel-import/validate';
import { downloadTemplate, parseTSV, readXlsxFile } from './excel-import/xlsxIo';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const INITIAL_ROWS = 10;

export function ExcelInventoryImportDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { companies, selectedCompany } = useCompany();
  const { categories } = useItemCategories();
  const { units } = useItemUnits();
  const { locations } = useWarehouseLocations();
  const { bins } = useWarehouseBins({ skipLocationFilter: true });

  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: INITIAL_ROWS }, () => {
      const r = emptyRow();
      if (selectedCompany) r.company = selectedCompany.name;
      return r;
    }),
  );
  const [isImporting, setIsImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const lookups: Lookups = useMemo(
    () => ({
      categories: categories.map((c: any) => ({ id: c.id, name: c.name, code: c.code })),
      units: units.map((u: any) => ({ id: u.id, abbreviation: u.abbreviation, name: u.name })),
      locations: locations
        .filter((l: any) => ['location', 'sublocation', 'department'].includes(l.type ?? 'location'))
        .map((l: any) => ({ id: l.id, name: l.name, location_code: l.location_code })),
      bins: bins.map((b: any) => ({ id: b.id, bin_code: b.bin_code, name: b.name, location_id: b.location_id })),
      companies: (companies || []).map((c: any) => ({ id: c.id, name: c.name })),
    }),
    [categories, units, locations, bins, companies],
  );

  const errorsByRow = useMemo(() => {
    const map = new Map<number, RowError[]>();
    rows.forEach((r, i) => {
      const errs = validateRow(r, i + 1, lookups);
      if (errs.length) map.set(i, errs);
    });
    return map;
  }, [rows, lookups]);

  const filledRows = rows.filter((r) => COLUMNS.some((c) => r[c.key]?.trim()));
  const errorCount = Array.from(errorsByRow.values()).reduce((a, b) => a + b.length, 0);
  const validRowCount = filledRows.length - errorsByRow.size;

  const updateCell = useCallback((rowIdx: number, key: string, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [key]: value };
      return next;
    });
  }, []);

  const addRows = (n = 5) =>
    setRows((p) => [
      ...p,
      ...Array.from({ length: n }, () => {
        const r = emptyRow();
        if (selectedCompany) r.company = selectedCompany.name;
        return r;
      }),
    ]);

  const deleteRow = (i: number) => setRows((p) => p.filter((_, idx) => idx !== i));

  const clearAll = () =>
    setRows(
      Array.from({ length: INITIAL_ROWS }, () => {
        const r = emptyRow();
        if (selectedCompany) r.company = selectedCompany.name;
        return r;
      }),
    );

  /** Paste handler — supports Excel TSV. Replaces from the target cell. */
  const handlePaste = (e: React.ClipboardEvent, startRow: number, startColKey: string) => {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\t') && !text.includes('\n')) return; // single cell — let default
    e.preventDefault();
    const rowsData = text.replace(/\r/g, '').split('\n').filter((l) => l.length > 0);
    const startColIdx = COLUMNS.findIndex((c) => c.key === startColKey);
    setRows((prev) => {
      const next = [...prev];
      rowsData.forEach((line, ri) => {
        const cells = line.split('\t');
        const targetIdx = startRow + ri;
        while (next.length <= targetIdx) next.push(emptyRow());
        const row = { ...next[targetIdx] };
        cells.forEach((val, ci) => {
          const col = COLUMNS[startColIdx + ci];
          if (col) row[col.key] = val;
        });
        next[targetIdx] = row;
      });
      return next;
    });
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await readXlsxFile(file);
      if (imported.length === 0) {
        toast({ title: 'Empty file', description: 'No data rows found', variant: 'destructive' });
        return;
      }
      setRows(imported);
      toast({ title: 'Imported', description: `${imported.length} rows loaded — review and validate` });
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    } finally {
      e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    if (errorCount > 0) {
      toast({ title: 'Fix errors first', description: `${errorCount} validation issues`, variant: 'destructive' });
      return;
    }
    if (filledRows.length === 0) {
      toast({ title: 'No rows', description: 'Add data first', variant: 'destructive' });
      return;
    }
    setIsImporting(true);
    try {
      const payload = filledRows.map((r) => toPayload(r, lookups));
      const { data, error } = await supabase.rpc('bulk_import_inventory_with_stock', {
        p_rows: payload as any,
      });
      if (error) throw error;
      const results: any[] = Array.isArray(data) ? data : [];
      const created = results.filter((r) => r.status === 'created').length;
      const matched = results.filter((r) => r.status === 'matched').length;
      const errs = results.filter((r) => r.status === 'error');
      if (errs.length) {
        toast({
          title: `${errs.length} rows failed`,
          description: errs.slice(0, 3).map((e) => `Row ${e.row}: ${e.error}`).join('\n'),
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Import complete',
          description: `${created} created, ${matched} matched existing`,
        });
        onOpenChange(false);
      }
      qc.invalidateQueries({ queryKey: ['warehouse-item-catalog'] });
      qc.invalidateQueries({ queryKey: ['warehouse-items'] });
      qc.invalidateQueries({ queryKey: ['list-warehouse-inventory'] });
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Add Inventory via Excel</DialogTitle>
          <DialogDescription>
            Paste rows from Excel/Sheets, upload an .xlsx file, or type inline. Catalog + opening
            stock posted in one transaction. GS1 GTIN and ISO unit validation enforced.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 px-6 py-3 border-b bg-muted/30">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Upload .xlsx
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileImport}
          />
          <Button variant="outline" size="sm" onClick={() => addRows(5)}>
            <Plus className="h-4 w-4 mr-2" />
            +5 rows
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear
          </Button>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              {validRowCount} valid
            </Badge>
            <Badge variant={errorCount ? 'destructive' : 'outline'} className="gap-1">
              <AlertCircle className="h-3 w-3" />
              {errorCount} errors
            </Badge>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto">
          <TooltipProvider delayDuration={150}>
            <table className="border-collapse text-xs">
              <thead className="sticky top-0 bg-background z-10">
                <tr>
                  <th className="border-b border-r p-1 w-10 bg-muted/50 sticky left-0 z-20">#</th>
                  {COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      className={`border-b border-r p-2 text-left font-medium whitespace-nowrap ${
                        c.group === 'stock' ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-muted/30'
                      }`}
                      style={{ minWidth: c.width || 120 }}
                    >
                      {c.label}
                      {c.help && <div className="text-[10px] text-muted-foreground font-normal">{c.help}</div>}
                    </th>
                  ))}
                  <th className="border-b p-1 w-10 bg-muted/50 sticky right-0">×</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => {
                  const rowErrs = errorsByRow.get(ri) || [];
                  const errByField = new Map(rowErrs.map((e) => [e.field, e.message]));
                  return (
                    <tr key={ri} className="hover:bg-muted/20">
                      <td className="border-b border-r p-1 text-center text-muted-foreground sticky left-0 bg-background">
                        {ri + 1}
                      </td>
                      {COLUMNS.map((c) => {
                        const err = errByField.get(c.key);
                        const cellClass = `border-b border-r p-0 ${err ? 'bg-destructive/10' : ''}`;
                        return (
                          <td key={c.key} className={cellClass}>
                            {renderCell(c, row, ri, updateCell, handlePaste, lookups)}
                            {err && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="absolute" />
                                </TooltipTrigger>
                                <TooltipContent>{err}</TooltipContent>
                              </Tooltip>
                            )}
                          </td>
                        );
                      })}
                      <td className="border-b text-center sticky right-0 bg-background">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => deleteRow(ri)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TooltipProvider>
        </div>

        {errorCount > 0 && (
          <Alert variant="destructive" className="m-4 mb-0">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {errorCount} validation error(s). Hover red cells for details. Fix before importing.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isImporting || errorCount > 0 || validRowCount === 0}>
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing…
              </>
            ) : (
              `Import ${validRowCount} row${validRowCount === 1 ? '' : 's'}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function renderCell(
  col: typeof COLUMNS[number],
  row: Row,
  ri: number,
  update: (ri: number, k: string, v: string) => void,
  paste: (e: React.ClipboardEvent, ri: number, k: string) => void,
  lookups: Lookups,
) {
  const value = row[col.key] || '';
  const common = {
    onPaste: (e: React.ClipboardEvent) => paste(e, ri, col.key),
    className:
      'h-7 w-full border-0 rounded-none bg-transparent focus-visible:ring-1 focus-visible:ring-inset px-2 text-xs',
  };

  if (col.type === 'bool') {
    return (
      <div className="flex items-center justify-center h-7">
        <Checkbox
          checked={value === 'true' || value === 'TRUE' || value === '1'}
          onCheckedChange={(c) => update(ri, col.key, c ? 'true' : 'false')}
        />
      </div>
    );
  }

  if (col.type === 'select') {
    let options: string[] = [];
    if (col.source === 'category') options = lookups.categories.map((x) => x.name);
    else if (col.source === 'unit') options = lookups.units.map((x) => x.abbreviation);
    else if (col.source === 'location') options = lookups.locations.map((x) => x.name);
    else if (col.source === 'bin') options = lookups.bins.map((x) => x.bin_code);
    else if (col.source === 'company') options = lookups.companies.map((x) => x.name);
    else if (col.source === 'status') options = STATUS_OPTIONS;

    return (
      <>
        <Input
          {...common}
          list={`opts-${col.key}`}
          value={value}
          onChange={(e) => update(ri, col.key, e.target.value)}
        />
        <datalist id={`opts-${col.key}`}>
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </>
    );
  }

  return (
    <Input
      {...common}
      type={col.type === 'number' ? 'number' : 'text'}
      step="any"
      value={value}
      onChange={(e) => update(ri, col.key, e.target.value)}
    />
  );
}
