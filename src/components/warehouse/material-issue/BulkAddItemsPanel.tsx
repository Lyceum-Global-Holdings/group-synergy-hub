import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, ClipboardPaste, PackageSearch, Trash2, X, Boxes } from 'lucide-react';
import { ItemSelector } from '@/components/common/ItemSelector';
import { cn } from '@/lib/utils';
import { BrowseInventoryDialog, type BrowsePickedRow } from '../BrowseInventoryDialog';
import { PasteCodesDialog } from './PasteCodesDialog';
import { AddByBinDialog } from './AddByBinDialog';

interface Props {
  companyId: string | null;
  locationId: string | null;
  existingItemIds: string[];
  onCommit: (rows: BrowsePickedRow[]) => void;
}

type Row = BrowsePickedRow & { _key: string; _empty?: boolean };

const emptyRow = (): Row => ({
  _key: crypto.randomUUID(),
  _empty: true,
  id: '',
  item_code: '',
  name: '',
  description: null,
  unit_of_measure: null,
  current_stock: 0,
  bin_code: null,
  quantity: 0,
});

export function BulkAddItemsPanel({ companyId, locationId, existingItemIds, onCommit }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);

  const disabled = !locationId;

  const mergePicked = (picked: BrowsePickedRow[]) => {
    setRows((prev) => {
      const byId = new Map<string, Row>();
      // keep existing non-empty rows
      for (const r of prev) {
        if (!r._empty && r.id) byId.set(r.id, r);
      }
      for (const p of picked) {
        const existing = byId.get(p.id);
        if (existing) {
          existing.quantity = (existing.quantity || 0) + (p.quantity || 0);
        } else {
          byId.set(p.id, { ...p, _key: crypto.randomUUID() });
        }
      }
      // preserve any empty/typed rows still being filled
      const empties = prev.filter((r) => r._empty || !r.id);
      return [...Array.from(byId.values()), ...empties];
    });
  };

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r._key !== key));
  };

  const handleSelectItem = (key: string, item: any | null) => {
    if (!item) {
      updateRow(key, { _empty: true, id: '', item_code: '', name: '', current_stock: 0 });
      return;
    }
    updateRow(key, {
      _empty: false,
      id: item.id,
      item_code: item.item_code,
      name: item.name || item.item_name,
      description: item.description ?? null,
      unit_of_measure: item.unit_of_measure ?? null,
      current_stock: Number(item.current_stock || 0),
      bin_code: null,
      quantity: 0,
    });
  };

  const summary = useMemo(() => {
    const valid = rows.filter(
      (r) =>
        !r._empty &&
        r.id &&
        r.quantity > 0 &&
        r.quantity <= r.current_stock &&
        !existingItemIds.includes(r.id),
    );
    const issues = rows.filter(
      (r) =>
        !r._empty &&
        r.id &&
        (r.quantity <= 0 || r.quantity > r.current_stock || existingItemIds.includes(r.id)),
    );
    return { valid, issues };
  }, [rows, existingItemIds]);

  const handleCommit = () => {
    if (summary.valid.length === 0) return;
    onCommit(summary.valid.map(({ _key, _empty, ...r }) => r));
    setRows([]);
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-semibold">Bulk add items</h3>
          <p className="text-xs text-muted-foreground">
            Stage many items at once, tweak quantities, then add them to the MIN in one click.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRows((p) => [...p, emptyRow()])}
            disabled={disabled}
          >
            <Plus className="h-4 w-4 mr-1" /> Add row
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPasteOpen(true)}
            disabled={disabled}
          >
            <ClipboardPaste className="h-4 w-4 mr-1" /> Paste codes
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBrowseOpen(true)}
            disabled={disabled}
          >
            <PackageSearch className="h-4 w-4 mr-1" /> Browse inventory
          </Button>
          {rows.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setRows([])}>
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      {disabled && (
        <div className="text-xs text-muted-foreground italic">
          Select an Issue Location on the Header step first.
        </div>
      )}

      {rows.length > 0 && (
        <div className="border rounded-md overflow-hidden bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead>UoM</TableHead>
                <TableHead className="w-28">Qty to issue</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const already = !!r.id && existingItemIds.includes(r.id);
                const qtyInvalid = !r._empty && r.id && (r.quantity <= 0 || r.quantity > r.current_stock);
                return (
                  <TableRow
                    key={r._key}
                    className={cn(
                      qtyInvalid && 'bg-destructive/10',
                      already && 'bg-amber-500/10',
                    )}
                  >
                    <TableCell className="min-w-[260px]">
                      {r._empty || !r.id ? (
                        <ItemSelector
                          value=""
                          onSelect={(it) => handleSelectItem(r._key, it)}
                          placeholder="Search item…"
                          locationId={locationId || undefined}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[240px]">{r.name}</span>
                          {already && (
                            <Badge variant="secondary" className="text-[10px]">already in MIN</Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.item_code ? (
                        <Badge variant="outline" className="text-xs">{r.item_code}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.id ? r.current_stock : '—'}
                    </TableCell>
                    <TableCell>{r.unit_of_measure || '—'}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={r.current_stock || undefined}
                        step="0.01"
                        value={r.id ? r.quantity || '' : ''}
                        disabled={!r.id}
                        onChange={(e) =>
                          updateRow(r._key, { quantity: parseFloat(e.target.value) || 0 })
                        }
                        className={cn('h-8', qtyInvalid && 'border-destructive')}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => removeRow(r._key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">
            {rows.length} row{rows.length === 1 ? '' : 's'} · {summary.valid.length} valid
            {summary.issues.length > 0 && (
              <span className="text-destructive"> · {summary.issues.length} issue{summary.issues.length === 1 ? '' : 's'}</span>
            )}
          </div>
          <Button onClick={handleCommit} disabled={summary.valid.length === 0}>
            <Plus className="h-4 w-4 mr-1" />
            Add {summary.valid.length || ''} to MIN
          </Button>
        </div>
      )}

      <BrowseInventoryDialog
        open={browseOpen}
        onOpenChange={setBrowseOpen}
        companyId={companyId}
        locationId={locationId}
        existingItemIds={[...existingItemIds, ...rows.filter((r) => r.id).map((r) => r.id)]}
        onConfirm={(picked) => mergePicked(picked)}
      />

      <PasteCodesDialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        companyId={companyId}
        locationId={locationId}
        onResolved={(picked) => mergePicked(picked)}
      />
    </div>
  );
}
