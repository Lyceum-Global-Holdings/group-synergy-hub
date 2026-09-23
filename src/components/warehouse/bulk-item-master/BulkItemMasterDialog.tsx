import { useState } from 'react';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Plus,
  Trash2,
  ClipboardPaste,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RotateCcw,
  Copy,
  Download,
  ChevronsUpDown,
  Check,
  ArrowDown,
} from 'lucide-react';
import { useBulkItemMaster } from './useBulkItemMaster';
import { useCompanies } from '@/hooks/useCompanies';
import { PasteNamesDialog, parsePastedLine } from './PasteNamesDialog';
import type { BulkItemMasterRow } from './types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function resolveCode(row: BulkItemMasterRow): string {
  return (row.item_code?.trim() || row.auto_item_code || '').trim();
}

function csvEscape(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function buildExportRows(
  rows: BulkItemMasterRow[],
  categories: any[],
  units: any[],
) {
  const catMap = new Map(categories.map((c) => [c.id, c.name as string]));
  const uomMap = new Map(units.map((u) => [u.id, (u.abbreviation as string) || (u.name as string)]));
  return rows
    .map((r) => ({
      code: resolveCode(r),
      name: r.name?.trim() ?? '',
      category: r.category_id ? catMap.get(r.category_id) ?? '' : '',
      uom: r.unit_id ? uomMap.get(r.unit_id) ?? '' : '',
    }))
    .filter((r) => r.code);
}

function timestamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function BulkItemMasterDialog({ open, onOpenChange }: Props) {
  const {
    rows,
    setRow,
    addRows,
    removeRow,
    clearInvalid,
    resetAll,
    applyCategoryToAll,
    applyUnitToAll,
    seedFromNames,
    autoClassifyAll,
    resetCode,
    submit,
    isSubmitting,
    validCount,
    invalidCount,
    skippedCount,
    duplicatePolicy,
    setDuplicatePolicy,
    codePrefix,
    setCodePrefix,
    categories,
    units,
  } = useBulkItemMaster();

  // Optional company scoping: selecting a company switches the code prefix
  // from the generic INV to the company code (e.g. TUH-TXT-FAB-0001), with an
  // independent sequence per prefix.
  const { companies = [] } = useCompanies();

  const [pasteOpen, setPasteOpen] = useState(false);

  const handleSubmit = async () => {
    await submit();
  };

  // Paste TSV/multi-line text anywhere in the grid (including directly into a
  // Name cell, which is what most users do).
  const handleGridPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData?.getData('text') ?? '';
    if (!text.trim()) return;

    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const isBulk = lines.length > 1 || text.includes('\t');
    // Single plain value → let the browser paste it into the focused cell.
    if (!isBulk) return;

    const target = e.target as HTMLElement | null;
    const tag = target?.tagName;
    const isField = tag === 'INPUT' || tag === 'TEXTAREA';
    // Inside a non-name field (description/brand/item code) keep native paste;
    // only the Name column seeds rows.
    if (isField && target?.getAttribute('data-bulk-cell') !== 'name') return;

    e.preventDefault();
    e.stopPropagation();
    const entries = lines
      .map((l) => parsePastedLine(l, false))
      .filter(Boolean) as { name: string; uom?: string }[];
    if (entries.length === 0) return;
    seedFromNames(entries);
    toast.success(`Added ${entries.length} row${entries.length === 1 ? '' : 's'} from clipboard`);
  };


  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[95vh] flex flex-col p-0 gap-0">
          <SheetHeader className="px-6 py-4 border-b">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SheetTitle>Bulk create items</SheetTitle>
                <SheetDescription>
                  Excel-like grid to add many items to the Item Master at once. Paste
                  item names from Excel and the category and UoM will be suggested
                  automatically using UNSPSC and UN/CEFACT Rec 20 standards. Item
                  codes are auto-generated per category and can be edited.
                </SheetDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          <div className="flex items-center gap-2 px-6 py-3 border-b bg-muted/30 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => addRows(10)}>
              <Plus className="h-4 w-4 mr-1" /> Add 10 rows
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPasteOpen(true)}>
              <ClipboardPaste className="h-4 w-4 mr-1" /> Paste names
            </Button>
            <Button size="sm" variant="outline" onClick={autoClassifyAll}>
              <Sparkles className="h-4 w-4 mr-1" /> Auto-classify all
            </Button>
            <Button size="sm" variant="ghost" onClick={clearInvalid} disabled={invalidCount === 0}>
              Clear invalid ({invalidCount})
            </Button>
            <Button size="sm" variant="ghost" onClick={resetAll}>Reset</Button>
            <div className="flex items-center gap-2 pl-2 border-l">
              <span className="text-xs text-muted-foreground">Company (optional):</span>
              <Select value={codePrefix} onValueChange={setCodePrefix}>
                <SelectTrigger className="h-8 w-[170px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INV">Generic (INV)</SelectItem>
                  {companies
                    .filter((c: any) => c.code && c.code.trim())
                    .map((c: any) => (
                      <SelectItem key={c.id} value={c.code.trim().toUpperCase()}>
                        {c.code.trim().toUpperCase()} — {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pl-2 border-l">
              <span className="text-xs text-muted-foreground">On duplicate code:</span>
              <Select value={duplicatePolicy} onValueChange={(v) => setDuplicatePolicy(v as any)}>
                <SelectTrigger className="h-8 w-[110px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fail">Fail</SelectItem>
                  <SelectItem value="skip">Skip</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(() => {
              const exportRows = buildExportRows(rows, categories, units);
              const n = exportRows.length;
              const header = ['Item Code', 'Name', 'Category', 'UoM'];
              const handleCopy = async () => {
                const tsv = [header.join('\t'), ...exportRows.map((r) => [r.code, r.name, r.category, r.uom].join('\t'))].join('\n');
                try {
                  await navigator.clipboard.writeText(tsv);
                  toast.success(`Copied ${n} code${n === 1 ? '' : 's'} to clipboard`);
                } catch {
                  toast.error('Copy failed');
                }
              };
              const handleDownload = () => {
                const csv = '\uFEFF' + [header.map(csvEscape).join(','), ...exportRows.map((r) => [r.code, r.name, r.category, r.uom].map(csvEscape).join(','))].join('\r\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `item-codes-${timestamp()}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              };
              return (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="outline" onClick={handleCopy} disabled={n === 0}>
                          <Copy className="h-4 w-4 mr-1" /> Copy codes
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy {n} code{n === 1 ? '' : 's'} as TSV (paste into Excel)</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="outline" onClick={handleDownload} disabled={n === 0}>
                          <Download className="h-4 w-4 mr-1" /> Download CSV
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download {n} code{n === 1 ? '' : 's'} as CSV</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              );
            })()}
            <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-success" /> {validCount} valid
              </span>
              <span className="flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-destructive" /> {invalidCount} invalid
              </span>
              {skippedCount > 0 && (
                <span className="flex items-center gap-1">
                  {skippedCount} skipped
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto" onPaste={handleGridPaste}>
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead className="sticky top-0 bg-background z-10 shadow-[0_1px_0_hsl(var(--border))]">
                <tr className="text-xs font-medium text-muted-foreground">
                  <th className="px-2 py-2 text-left w-10">#</th>
                  <th className="px-2 py-2 text-left min-w-[240px]">Name *</th>
                  <th className="px-2 py-2 text-left min-w-[200px]">Description</th>
                  <th className="px-2 py-2 text-left min-w-[180px]">
                    <div className="flex items-center gap-1">
                      Category *
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm" variant="ghost"
                            className="h-6 px-1.5 text-[11px] font-normal"
                            onClick={applyCategoryToAll}
                            disabled={!rows[0]?.category_id}
                          >
                            <ArrowDown className="h-3 w-3 mr-0.5" /> Apply to all
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy row 1's category to every row</TooltipContent>
                      </Tooltip>
                    </div>
                  </th>
                  <th className="px-2 py-2 text-left w-32">
                    <div className="flex items-center gap-1">
                      UoM *
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm" variant="ghost"
                            className="h-6 px-1.5 text-[11px] font-normal"
                            onClick={applyUnitToAll}
                            disabled={!rows[0]?.unit_id}
                          >
                            <ArrowDown className="h-3 w-3 mr-0.5" /> All
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy row 1's UoM to every row</TooltipContent>
                      </Tooltip>
                    </div>
                  </th>
                  <th className="px-2 py-2 text-left min-w-[140px]">Brand</th>
                  <th className="px-2 py-2 text-left min-w-[200px]">Item code</th>
                  <th className="px-2 py-2 text-left min-w-[160px]">Status</th>
                  <th className="px-2 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <Row
                    key={r.rowId}
                    index={idx}
                    row={r}
                    categories={categories}
                    units={units}
                    onChange={(patch) => setRow(r.rowId, patch)}
                    onRemove={() => removeRow(r.rowId)}
                    onResetCode={() => resetCode(r.rowId)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t px-6 py-3 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Close
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || validCount === 0}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {duplicatePolicy === 'fail'
                ? `Create ${validCount} item${validCount === 1 ? '' : 's'}`
                : `Process ${validCount} item${validCount === 1 ? '' : 's'}`}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <PasteNamesDialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        onSeed={seedFromNames}
        units={units}
      />
    </>
  );
}

interface RowProps {
  index: number;
  row: BulkItemMasterRow;
  categories: any[];
  units: any[];
  onChange: (patch: Partial<BulkItemMasterRow>) => void;
  onRemove: () => void;
  onResetCode: () => void;
}

function Row({ index, row, categories, units, onChange, onRemove, onResetCode }: RowProps) {
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
      case 'updated':
        return <Badge variant="outline" className="border-success text-success">Updated</Badge>;
      case 'skipped':
        return <Badge variant="secondary">Skipped</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const codeIsAuto = !row.code_manual && !!row.auto_item_code;
  const issues = [...row.errors, ...row.warnings];

  return (
    <tr
      className={cn(
        'border-b hover:bg-muted/30',
        row.status === 'invalid' && 'bg-destructive/5',
        ['imported','updated'].includes(row.status) && 'bg-success/5 opacity-70',
      )}
    >
      <td className="px-2 py-1.5 text-xs text-muted-foreground tabular-nums align-top pt-3">
        {index + 1}
      </td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1">
          <Input
            data-bulk-cell="name"
            value={row.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Item name"
            className="h-8 text-xs"
            disabled={['imported','updated'].includes(row.status)}
          />

          {row.classify_confidence !== 'none' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Sparkles
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      row.classify_confidence === 'high' ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  {row.classify_confidence === 'high'
                    ? 'Auto-classified (high confidence)'
                    : 'Suggested — please confirm'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5">
        <Input
          value={row.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className="h-8 text-xs"
          disabled={['imported','updated'].includes(row.status)}
        />
      </td>
      <td className="px-2 py-1.5">
        <CategoryCombobox
          categories={categories}
          value={row.category_id}
          onChange={(v) => onChange({ category_id: v })}
          disabled={['imported','updated'].includes(row.status)}
        />
      </td>
      <td className="px-2 py-1.5">
        <Select
          value={row.unit_id ?? undefined}
          onValueChange={(v) => onChange({ unit_id: v })}
          disabled={['imported','updated'].includes(row.status)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="UoM" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {units.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.abbreviation}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-2 py-1.5">
        <Input
          value={row.brand}
          onChange={(e) => onChange({ brand: e.target.value })}
          className="h-8 text-xs"
          disabled={['imported','updated'].includes(row.status)}
        />
      </td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1">
          <Input
            value={row.item_code}
            onChange={(e) => onChange({ item_code: e.target.value.toUpperCase() })}
            placeholder={row.auto_item_code || 'auto'}
            className="h-8 text-xs font-mono"
            disabled={['imported','updated'].includes(row.status)}
          />
          {codeIsAuto ? (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">Auto</Badge>
          ) : row.code_manual ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={onResetCode}
                    disabled={!row.auto_item_code || ['imported','updated'].includes(row.status)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset to auto ({row.auto_item_code || '—'})</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
      </td>
      <td className="px-2 py-1.5">
        <div className="flex flex-col gap-0.5">
          {statusBadge()}
          {issues.length > 0 && (
            <span className="text-[11px] text-muted-foreground line-clamp-2">
              {issues.join(' · ')}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onRemove}
          disabled={['imported','updated'].includes(row.status)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

interface CategoryComboboxProps {
  categories: any[];
  value: string | null;
  onChange: (v: string) => void;
  disabled?: boolean;
}

function CategoryCombobox({ categories, value, onChange, disabled }: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = categories.find((c) => c.id === value);
  const label = selected ? `${selected.name}${selected.code ? ` (${selected.code})` : ''}` : '';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'h-8 w-full justify-between text-xs font-normal px-2',
            !selected && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{label || 'Select…'}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[280px]" align="start">
        <Command
          filter={(val, search) => {
            // val is the lowercased label we set on CommandItem
            return val.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search category…" className="h-9" />
          <CommandList>
            <CommandEmpty>No category found.</CommandEmpty>
            <CommandGroup>
              {categories.map((c) => {
                const text = `${c.name}${c.code ? ` (${c.code})` : ''}`;
                return (
                  <CommandItem
                    key={c.id}
                    value={text.toLowerCase()}
                    onSelect={() => {
                      onChange(c.id);
                      setOpen(false);
                    }}
                    className="text-xs"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-3.5 w-3.5',
                        value === c.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {text}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
