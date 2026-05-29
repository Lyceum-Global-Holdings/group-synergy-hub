import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  ClipboardPaste,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  CopyCheck,
  Split,
  Copy,
  CornerDownRight,
} from 'lucide-react';
import { useCompanies } from '@/hooks/useCompanies';
import { useCompany } from '@/contexts/CompanyContext';
import { useLocationFilter } from '@/contexts/LocationFilterContext';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { useBinsAtLocation } from '@/hooks/warehouse/useBinsAtLocation';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { CatalogItemCell } from './CatalogItemCell';
import { PasteCodesDialog } from './PasteCodesDialog';
import { useBulkCatalogImport } from './useBulkCatalogImport';
import type { BulkCatalogRow, BulkCatalogSplit } from './types';
import { buildLocationOptions } from '@/lib/warehouse/locationHierarchy';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function BulkCatalogToInventoryDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { companies } = useCompanies();
  const { selectedCompany } = useCompany();
  const { globalLocationId } = useLocationFilter();
  const { locations } = useWarehouseLocations();

  const defaultCompanyId = selectedCompany?.id ?? null;
  const defaultLocationId = useMemo(() => {
    if (!globalLocationId) return null;
    const loc = locations.find((l) => l.id === globalLocationId);
    if (!loc) return null;
    if (!loc.company_id || !defaultCompanyId || loc.company_id === defaultCompanyId) return globalLocationId;
    return null;
  }, [globalLocationId, locations, defaultCompanyId]);

  const {
    rows,
    setRow,
    setSplit,
    enableSplits,
    addSplit,
    removeSplit,
    collapseSplits,
    duplicateRowForNewBin,
    addRows,
    removeRow,
    clearInvalid,
    resetAll,
    seedFromPaste,
    submit,
    isSubmitting,
    validCount,
    invalidCount,
  } = useBulkCatalogImport({ company_id: defaultCompanyId, location_id: defaultLocationId });

  const [pasteOpen, setPasteOpen] = useState(false);

  const locationsByCompany = useMemo(() => {
    const opts = buildLocationOptions(locations, { activeOnly: true });
    return (_companyId: string | null) => opts;
  }, [locations]);

  const defaultCompanyName = companies.find((c) => c.id === defaultCompanyId)?.name ?? '—';
  const defaultLocationName = locations.find((l) => l.id === defaultLocationId)?.name ?? 'All locations';

  const handleImport = async () => {
    try {
      const results = await submit();
      const ok = results.filter((r) => r.status !== 'error').length;
      const err = results.filter((r) => r.status === 'error').length;
      toast({
        title: 'Import complete',
        description: `${ok} succeeded, ${err} failed`,
        variant: err > 0 ? 'destructive' : 'default',
      });
      if (ok > 0) {
        qc.invalidateQueries({ queryKey: ['warehouse-inventory'] });
        qc.invalidateQueries({ queryKey: ['warehouse-items'] });
        qc.invalidateQueries({ queryKey: ['warehouse-items-inventory'] });
        qc.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
        qc.invalidateQueries({ queryKey: ['warehouse-bins'] });
      }
    } catch (e: any) {
      toast({ title: 'Import failed', description: e.message, variant: 'destructive' });
    }
  };

  // Paste TSV directly into the grid: row-per-line, columns: code, qty, unit_cost, notes, bin_code
  const handleGridPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData?.getData('text');
    if (!text || !text.includes('\t')) return;
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    e.preventDefault();
    const entries = lines.map((l) => {
      const [code, qty, cost, notes, bin] = l.split('\t').map((c) => c.trim());
      const qN = Number(qty);
      const cN = Number(cost);
      return {
        code,
        opening_qty: Number.isFinite(qN) ? qN : null,
        unit_cost: Number.isFinite(cN) ? cN : null,
        notes: notes || null,
        bin_code: bin || null,
      };
    });
    void seedFromPaste(entries);
  };

  const applyFirstRowBinToAll = () => {
    const first = rows[0];
    if (!first || (!first.bin_id && (!first.splits || first.splits.length === 0))) {
      toast({
        title: 'No bin on first row',
        description: 'Select a company, location and bin on row 1 first.',
        variant: 'destructive',
      });
      return;
    }
    if (first.splits && first.splits.length > 0) {
      toast({
        title: 'Row 1 is split',
        description: 'Use "Duplicate row to new bin" or copy splits manually.',
        variant: 'destructive',
      });
      return;
    }
    let applied = 0;
    rows.forEach((r, i) => {
      if (i === 0) return;
      setRow(r.rowId, {
        company_id: first.company_id,
        location_id: first.location_id,
        bin_id: first.bin_id,
      });
      applied += 1;
    });
    toast({ title: 'Bin applied', description: `Applied row 1 bin to ${applied} row${applied === 1 ? '' : 's'}.` });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[95vh] flex flex-col p-0 gap-0">
          <SheetHeader className="px-6 py-4 border-b">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SheetTitle>Bulk add from catalog</SheetTitle>
                <SheetDescription>
                  Pick catalog items and place them in a company / location / bin with opening stock.
                  Use <strong>Split across bins</strong> to put the same item in multiple bins of the same warehouse
                  (SAP EWM putaway-split style).
                </SheetDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          {/* Toolbar */}
          <div className="flex items-center gap-2 px-6 py-3 border-b bg-muted/30 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => addRows(5)}>
              <Plus className="h-4 w-4 mr-1" /> Add 5 rows
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPasteOpen(true)}>
              <ClipboardPaste className="h-4 w-4 mr-1" /> Paste codes &amp; qty
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={applyFirstRowBinToAll}
              disabled={rows.length < 2 || !rows[0]?.bin_id}
            >
              <CopyCheck className="h-4 w-4 mr-1" /> Apply row 1 bin to all
            </Button>
            <Button size="sm" variant="ghost" onClick={clearInvalid} disabled={invalidCount === 0}>
              Clear invalid ({invalidCount})
            </Button>
            <Button size="sm" variant="ghost" onClick={resetAll}>Reset</Button>
            <Badge variant="secondary" className="font-normal">
              Defaults: {defaultCompanyName} · {defaultLocationName}
            </Badge>
            <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-success" /> {validCount} valid
              </span>
              <span className="flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-destructive" /> {invalidCount} invalid
              </span>
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-auto" onPaste={handleGridPaste}>
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead className="sticky top-0 bg-background z-10 shadow-[0_1px_0_hsl(var(--border))]">
                <tr className="text-xs font-medium text-muted-foreground">
                  <th className="px-2 py-2 text-left w-10">#</th>
                  <th className="px-2 py-2 text-left min-w-[260px]">Item</th>
                  <th className="px-2 py-2 text-left w-20">UoM</th>
                  <th className="px-2 py-2 text-left min-w-[180px]">Company</th>
                  <th className="px-2 py-2 text-left min-w-[180px]">Location</th>
                  <th className="px-2 py-2 text-left min-w-[160px]">Bin</th>
                  <th className="px-2 py-2 text-right w-24">Opening qty</th>
                  <th className="px-2 py-2 text-right w-24">Unit cost</th>
                  <th className="px-2 py-2 text-right w-24">Reorder</th>
                  <th className="px-2 py-2 text-left w-32">PO/CMR No</th>
                  <th className="px-2 py-2 text-left min-w-[200px]">Status / Actions</th>
                  <th className="px-2 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <RowGroup
                    key={r.rowId}
                    index={idx}
                    row={r}
                    companies={companies}
                    locations={locationsByCompany(r.company_id)}
                    defaultLocationId={defaultLocationId}
                    onChange={(patch) => setRow(r.rowId, patch)}
                    onRemove={() => removeRow(r.rowId)}
                    onEnableSplits={() => enableSplits(r.rowId)}
                    onAddSplit={() => addSplit(r.rowId)}
                    onRemoveSplit={(sid) => removeSplit(r.rowId, sid)}
                    onSplitChange={(sid, patch) => setSplit(r.rowId, sid, patch)}
                    onCollapseSplits={() => collapseSplits(r.rowId)}
                    onDuplicateForNewBin={() => duplicateRowForNewBin(r.rowId)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="border-t px-6 py-3 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Close</Button>
            <Button onClick={handleImport} disabled={isSubmitting || validCount === 0}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Import {validCount} row{validCount === 1 ? '' : 's'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <PasteCodesDialog open={pasteOpen} onOpenChange={setPasteOpen} onResolve={seedFromPaste} />
    </>
  );
}

interface RowGroupProps {
  index: number;
  row: BulkCatalogRow;
  companies: any[];
  locations: any[];
  defaultLocationId: string | null;
  onChange: (patch: Partial<BulkCatalogRow>) => void;
  onRemove: () => void;
  onEnableSplits: () => void;
  onAddSplit: () => void;
  onRemoveSplit: (splitId: string) => void;
  onSplitChange: (splitId: string, patch: Partial<BulkCatalogSplit>) => void;
  onCollapseSplits: () => void;
  onDuplicateForNewBin: () => void;
}

function RowGroup(props: RowGroupProps) {
  const {
    index, row, companies, locations, defaultLocationId,
    onChange, onRemove, onEnableSplits, onAddSplit, onRemoveSplit,
    onSplitChange, onCollapseSplits, onDuplicateForNewBin,
  } = props;
  const companyId = row.company_id;
  const isSplit = !!(row.splits && row.splits.length > 0);
  const { data: bins = [], isLoading: binsLoading } = useBinsAtLocation(row.location_id);

  const statusBadge = () => {
    switch (row.status) {
      case 'valid':
        return <Badge variant="outline" className="border-success text-success">Valid</Badge>;
      case 'invalid':
        return <Badge variant="destructive">Invalid</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'imported':
        return <Badge variant="outline" className="border-success text-success">Imported</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const display = row.item_code && row.name ? `${row.item_code} — ${row.name}` : row.item_code || '';
  const totalSplitQty = isSplit
    ? (row.splits ?? []).reduce((sum, s) => sum + (Number(s.qty) || 0), 0)
    : 0;

  return (
    <>
      <tr className={cn('border-b hover:bg-muted/30', row.status === 'invalid' && 'bg-destructive/5', row.status === 'imported' && 'bg-success/5 opacity-70')}>
        <td className="px-2 py-1.5 text-xs text-muted-foreground tabular-nums align-top">{index + 1}</td>
        <td className="px-2 py-1.5 align-top">
          <CatalogItemCell
            value={row.catalog_item_id}
            display={display}
            onChange={(it) =>
              onChange({
                catalog_item_id: it.id,
                item_code: it.item_code,
                name: it.name,
                uom: it.unit_name,
              })
            }
          />
        </td>
        <td className="px-2 py-1.5 text-xs text-muted-foreground align-top">{row.uom ?? '—'}</td>
        <td className="px-2 py-1.5 align-top">
          <Select
            value={companyId ?? undefined}
            onValueChange={(v) => {
              const keepLoc = defaultLocationId && locations.some((l) => l.location.id === defaultLocationId);
              onChange({ company_id: v, location_id: keepLoc ? defaultLocationId : null, bin_id: null });
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        <td className="px-2 py-1.5 align-top">
          <Select
            value={row.location_id ?? undefined}
            onValueChange={(v) => onChange({ location_id: v, bin_id: null })}
            disabled={!companyId}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((opt: any) => (
                <SelectItem key={opt.location.id} value={opt.location.id}>
                  <span style={{ paddingLeft: `${opt.depth * 12}px` }}>{opt.breadcrumb}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        <td className="px-2 py-1.5 align-top">
          {isSplit ? (
            <div className="text-xs text-muted-foreground italic">
              {row.splits!.length} bin{row.splits!.length === 1 ? '' : 's'}
            </div>
          ) : (
            <Select
              value={row.bin_id ?? undefined}
              onValueChange={(v) => onChange({ bin_id: v })}
              disabled={!row.location_id || binsLoading || bins.length === 0}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={binsLoading ? 'Loading…' : bins.length === 0 ? 'No bins' : 'Optional'} />
              </SelectTrigger>
              <SelectContent>
                {bins.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.bin_code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </td>
        <td className="px-2 py-1.5 align-top">
          {isSplit ? (
            <div className="h-8 text-xs text-right tabular-nums text-muted-foreground flex items-center justify-end px-2">
              Σ {totalSplitQty}
            </div>
          ) : (
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={row.opening_qty}
              onChange={(e) => onChange({ opening_qty: e.target.value })}
              className="h-8 text-xs text-right tabular-nums"
            />
          )}
        </td>
        <td className="px-2 py-1.5 align-top">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={row.unit_cost}
            onChange={(e) => onChange({ unit_cost: e.target.value })}
            className="h-8 text-xs text-right tabular-nums"
            placeholder={isSplit ? 'default' : ''}
          />
        </td>
        <td className="px-2 py-1.5 align-top">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={row.reorder_level}
            onChange={(e) => onChange({ reorder_level: e.target.value })}
            className="h-8 text-xs text-right tabular-nums"
          />
        </td>
        <td className="px-2 py-1.5 align-top">
          <Input
            type="text"
            value={row.reference_no}
            onChange={(e) => onChange({ reference_no: e.target.value })}
            placeholder="PO/CMR No"
            className="h-8 text-xs"
          />
        </td>
        <td className="px-2 py-1.5 align-top">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 flex-wrap">
              {statusBadge()}
              {!isSplit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs"
                  onClick={onEnableSplits}
                  disabled={!row.catalog_item_id}
                  title="Place this item in multiple bins of the same warehouse"
                >
                  <Split className="h-3 w-3 mr-1" /> Split bins
                </Button>
              )}
              {!isSplit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs"
                  onClick={onDuplicateForNewBin}
                  disabled={!row.catalog_item_id}
                  title="Duplicate this row to add the same item in another bin"
                >
                  <Copy className="h-3 w-3 mr-1" /> Dup
                </Button>
              )}
              {isSplit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs"
                  onClick={onCollapseSplits}
                  title="Collapse back to a single bin"
                >
                  Collapse
                </Button>
              )}
            </div>
            {row.message && <span className="text-xs text-muted-foreground line-clamp-2">{row.message}</span>}
          </div>
        </td>
        <td className="px-2 py-1.5 align-top">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </td>
      </tr>

      {isSplit && row.splits!.map((s, sIdx) => (
        <SplitRow
          key={s.splitId}
          parentIndex={index}
          splitIndex={sIdx}
          split={s}
          bins={bins}
          binsLoading={binsLoading}
          locationReady={!!row.location_id}
          onChange={(patch) => onSplitChange(s.splitId, patch)}
          onRemove={() => onRemoveSplit(s.splitId)}
        />
      ))}

      {isSplit && (
        <tr className="bg-muted/10">
          <td></td>
          <td colSpan={11} className="px-2 py-1.5">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onAddSplit}>
              <Plus className="h-3 w-3 mr-1" /> Add bin
            </Button>
          </td>
        </tr>
      )}
    </>
  );
}

interface SplitRowProps {
  parentIndex: number;
  splitIndex: number;
  split: BulkCatalogSplit;
  bins: any[];
  binsLoading: boolean;
  locationReady: boolean;
  onChange: (patch: Partial<BulkCatalogSplit>) => void;
  onRemove: () => void;
}

function SplitRow({ parentIndex, splitIndex, split, bins, binsLoading, locationReady, onChange, onRemove }: SplitRowProps) {
  const statusBadge = () => {
    switch (split.status) {
      case 'valid':
        return <Badge variant="outline" className="border-success text-success text-[10px] px-1.5 py-0">Valid</Badge>;
      case 'invalid':
        return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Invalid</Badge>;
      case 'error':
        return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Error</Badge>;
      case 'imported':
        return <Badge variant="outline" className="border-success text-success text-[10px] px-1.5 py-0">Imported</Badge>;
      default:
        return null;
    }
  };

  return (
    <tr className={cn('border-b bg-muted/20', split.status === 'invalid' && 'bg-destructive/5', split.status === 'imported' && 'bg-success/10 opacity-70')}>
      <td className="px-2 py-1 text-[10px] text-muted-foreground tabular-nums align-middle text-right">
        {parentIndex + 1}.{splitIndex + 1}
      </td>
      <td className="px-2 py-1 align-middle" colSpan={4}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground pl-4">
          <CornerDownRight className="h-3 w-3" />
          <span>Split bin #{splitIndex + 1}</span>
        </div>
      </td>
      <td className="px-2 py-1 align-middle">
        <Select
          value={split.bin_id ?? undefined}
          onValueChange={(v) => onChange({ bin_id: v })}
          disabled={!locationReady || binsLoading || bins.length === 0}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder={binsLoading ? 'Loading…' : bins.length === 0 ? 'No bins' : 'Pick bin'} />
          </SelectTrigger>
          <SelectContent>
            {bins.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.bin_code}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-2 py-1 align-middle">
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={split.qty}
          onChange={(e) => onChange({ qty: e.target.value })}
          className="h-7 text-xs text-right tabular-nums"
        />
      </td>
      <td className="px-2 py-1 align-middle">
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={split.unit_cost}
          onChange={(e) => onChange({ unit_cost: e.target.value })}
          className="h-7 text-xs text-right tabular-nums"
          placeholder="inherit"
        />
      </td>
      <td className="px-2 py-1"></td>
      <td className="px-2 py-1"></td>
      <td className="px-2 py-1 align-middle">
        <div className="flex flex-col gap-0.5">
          {statusBadge()}
          {split.message && <span className="text-[10px] text-muted-foreground line-clamp-2">{split.message}</span>}
        </div>
      </td>
      <td className="px-2 py-1 align-middle">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </td>
    </tr>
  );
}
