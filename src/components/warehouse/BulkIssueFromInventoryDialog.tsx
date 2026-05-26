import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Trash2, AlertTriangle, PackageCheck, Plus, Search, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { useLocationFilter } from '@/contexts/LocationFilterContext';
import { useMaterialIssues } from '@/hooks/useMaterialIssues';
import { useMaterialIssueItems } from '@/hooks/useMaterialIssueItems';
import { useStockBearingLocationsForCompany } from '@/hooks/useWarehouseLocations';
import { useWarehouseItemsLazyInventory } from '@/hooks/useWarehouseItemsLazyInventory';
import { SrnDocumentUploadField } from '@/components/warehouse/SrnDocumentUploadField';
import { supabase } from '@/integrations/supabase/client';

interface InventoryRow {
  id: string;
  item_code?: string | null;
  name?: string | null;
  unit_of_measure?: string | null;
  current_stock?: number | null;
  location_id?: string | null;
  bins?: Array<{ id: string; bin_code: string; name?: string; quantity: number }> | null;
}

interface BulkIssueLine {
  item_id: string;
  item_code: string;
  name: string;
  unit_of_measure: string;
  available: number;
  quantity: number;
  purpose: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItems: InventoryRow[];
  defaultLocationId: string | null;
  onComplete?: () => void;
}

export function BulkIssueFromInventoryDialog({
  open,
  onOpenChange,
  selectedItems,
  defaultLocationId,
  onComplete,
}: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();
  const { globalLocationId } = useLocationFilter();
  const { createMaterialIssueAsync, isCreating } = useMaterialIssues();
  const { createItems, isCreating: isCreatingItems } = useMaterialIssueItems();
  const { data: stockLocations = [] } = useStockBearingLocationsForCompany(selectedCompany?.id);

  const today = new Date().toISOString().split('T')[0];

  const [header, setHeader] = useState({
    issue_date: today,
    requested_by: '',
    department: '',
    purpose: '',
    job_number: '',
    pr_number: '',
    po_number: '',
    srn_number: '',
    notes: '',
    location_id: defaultLocationId || globalLocationId || '',
  });

  const [lines, setLines] = useState<BulkIssueLine[]>([]);
  const [srnDocumentTempPath, setSrnDocumentTempPath] = useState<string>('');


  // Seed lines from the selected inventory rows when the dialog opens.
  // Merge with any lines already in state so re-opens don't wipe edits,
  // and dedupe by item_id so passing the same row twice is a no-op.
  useEffect(() => {
    if (!open) return;
    setHeader((prev) => ({
      ...prev,
      location_id: defaultLocationId || globalLocationId || prev.location_id || '',
    }));
    setLines((prev) => {
      const byId = new Map<string, BulkIssueLine>();
      prev.forEach((l) => byId.set(l.item_id, l));
      selectedItems.forEach((it) => {
        if (!it?.id || byId.has(it.id)) return;
        const available = Number(it.current_stock ?? 0);
        byId.set(it.id, {
          item_id: it.id,
          item_code: it.item_code || '',
          name: it.name || '',
          unit_of_measure: it.unit_of_measure || '',
          available,
          quantity: available > 0 ? Math.min(1, available) : 0,
          purpose: '',
        });
      });
      return Array.from(byId.values());
    });
  }, [open, selectedItems, defaultLocationId, globalLocationId]);

  const addLines = (rows: InventoryRow[]) => {
    setLines((prev) => {
      const byId = new Map<string, BulkIssueLine>();
      prev.forEach((l) => byId.set(l.item_id, l));
      rows.forEach((it) => {
        if (!it?.id || byId.has(it.id)) return;
        const available = Number(it.current_stock ?? 0);
        byId.set(it.id, {
          item_id: it.id,
          item_code: it.item_code || '',
          name: it.name || '',
          unit_of_measure: it.unit_of_measure || '',
          available,
          quantity: available > 0 ? Math.min(1, available) : 0,
          purpose: '',
        });
      });
      return Array.from(byId.values());
    });
  };

  const updateLine = (idx: number, patch: Partial<BulkIssueLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const validationErrors = useMemo(() => {
    const errs: string[] = [];
    if (!header.location_id) errs.push('Select an issue location.');
    if (!header.requested_by.trim()) errs.push('Issued To / Requested By is required.');
    if (lines.length === 0) errs.push('At least one line item is required.');
    lines.forEach((l) => {
      if (!l.quantity || l.quantity <= 0)
        errs.push(`${l.item_code || l.name}: quantity must be greater than zero.`);
      else if (l.quantity > l.available)
        errs.push(
          `${l.item_code || l.name}: quantity ${l.quantity} exceeds available ${l.available}.`,
        );
    });
    return errs;
  }, [header, lines]);

  const canSubmit =
    validationErrors.length === 0 && !!selectedCompany?.id && !isCreating && !isCreatingItems;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedCompany?.id) return;
    try {
      const issueNote = await createMaterialIssueAsync({
        issue_date: header.issue_date,
        issued_to: header.requested_by,
        department: header.department || undefined,
        purpose: header.purpose || undefined,
        notes: header.notes || undefined,
        requested_by: header.requested_by,
        items_required_date: header.issue_date,
        job_number: header.job_number || undefined,
        pr_number: header.pr_number || undefined,
        po_number: header.po_number || undefined,
        srn_number: header.srn_number || undefined,
        location_id: header.location_id,
        company_id: selectedCompany.id,
      });

      // Move SRN document from temp/ into the new MIN folder, then persist column.
      if (srnDocumentTempPath && issueNote?.id && selectedCompany?.id) {
        try {
          const ext = srnDocumentTempPath.split('.').pop() ?? 'bin';
          const finalPath = `${selectedCompany.id}/${issueNote.id}/srn_${Date.now()}.${ext}`;
          const { error: moveErr } = await supabase.storage
            .from('min-srn-documents')
            .move(srnDocumentTempPath, finalPath);
          const persistedPath = moveErr ? srnDocumentTempPath : finalPath;
          await supabase
            .from('material_issue_notes')
            .update({ srn_document_url: persistedPath })
            .eq('id', issueNote.id);
        } catch (e) {
          console.error('Failed to attach SRN document to MIN', e);
        }
      }


      const itemsPayload = lines.map((l, idx) => ({
        min_id: issueNote.id,
        item_id: l.item_id,
        quantity_issued: l.quantity,
        quantity_required: l.quantity,
        line_number: idx + 1,
        item_code: l.item_code,
        description: l.name,
        unit_of_measure: l.unit_of_measure,
        purpose: l.purpose || undefined,
        from_reservation: false,
      })) as any;

      await createItems(itemsPayload);

      toast({
        title: 'Material Issued',
        description: `MIN ${issueNote.min_number} created with ${lines.length} item(s).`,
      });

      onOpenChange(false);
      onComplete?.();
      navigate('/warehouse/material-issue');
    } catch (err: any) {
      console.error('Bulk issue failed', err);
      toast({
        title: 'Bulk Issue Failed',
        description: err?.message || 'Could not create material issue.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-primary" />
            Bulk Issue Materials
          </DialogTitle>
          <DialogDescription>
            Create a single Material Issue Note (MIN) covering the selected inventory items.
            Stock is deducted from the issue location's bins on submit (SAP-style Goods Issue).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          {/* Header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Issue Date *</Label>
              <Input
                type="date"
                value={header.issue_date}
                onChange={(e) => setHeader({ ...header, issue_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Issued To / Requested By *</Label>
              <Input
                value={header.requested_by}
                onChange={(e) => setHeader({ ...header, requested_by: e.target.value })}
                placeholder="Recipient name"
              />
            </div>
            <div>
              <Label>Department</Label>
              <Input
                value={header.department}
                onChange={(e) => setHeader({ ...header, department: e.target.value })}
              />
            </div>
            <div>
              <Label>Issue Location *</Label>
              <Select
                value={header.location_id}
                onValueChange={(v) => setHeader({ ...header, location_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {(stockLocations as any[]).map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Job Number</Label>
              <Input
                value={header.job_number}
                onChange={(e) => setHeader({ ...header, job_number: e.target.value })}
              />
            </div>
            <div>
              <Label>PR / PO Number</Label>
              <Input
                value={header.pr_number}
                onChange={(e) => setHeader({ ...header, pr_number: e.target.value })}
                placeholder="Reference"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Purpose</Label>
              <Input
                value={header.purpose}
                onChange={(e) => setHeader({ ...header, purpose: e.target.value })}
                placeholder="e.g. Site consumption, Project ABC"
              />
            </div>
            <div>
              <Label>SRN Number</Label>
              <Input
                value={header.srn_number}
                onChange={(e) => setHeader({ ...header, srn_number: e.target.value })}
              />
            </div>
            <div className="md:col-span-3">
              <Label>Notes</Label>
              <Textarea
                value={header.notes}
                onChange={(e) => setHeader({ ...header, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          {/* Validation summary */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Fix the following before issuing</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-5 space-y-0.5 text-sm">
                  {validationErrors.slice(0, 6).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                  {validationErrors.length > 6 && (
                    <li>…and {validationErrors.length - 6} more</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Add items picker */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Items to issue</div>
            <AddItemsPicker
              locationId={header.location_id || null}
              existingIds={new Set(lines.map((l) => l.item_id))}
              onAdd={addLines}
            />
          </div>

          {/* Lines */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Item Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[80px]">UoM</TableHead>
                  <TableHead className="w-[110px] text-right">Available</TableHead>
                  <TableHead className="w-[140px]">Qty to Issue *</TableHead>
                  <TableHead>Line Purpose</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      No items yet — click <strong>Add items</strong> above to start, or open this
                      dialog from the inventory table with rows selected.
                    </TableCell>
                  </TableRow>
                ) : (
                  lines.map((l, idx) => {
                    const over = l.quantity > l.available;
                    return (
                      <TableRow key={l.item_id}>
                        <TableCell className="font-mono text-xs">{l.item_code}</TableCell>
                        <TableCell className="text-sm">{l.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {l.unit_of_measure || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={l.available > 0 ? 'secondary' : 'outline'}>
                            {l.available}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={l.available}
                            step="any"
                            value={l.quantity}
                            onChange={(e) =>
                              updateLine(idx, { quantity: Number(e.target.value) || 0 })
                            }
                            className={over ? 'border-destructive' : ''}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={l.purpose}
                            onChange={(e) => updateLine(idx, { purpose: e.target.value })}
                            placeholder="Optional"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLine(idx)}
                            aria-label="Remove line"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isCreating || isCreatingItems
              ? 'Issuing…'
              : `Issue ${lines.length} item${lines.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// In-dialog item picker
// ---------------------------------------------------------------------------

interface AddItemsPickerProps {
  locationId: string | null;
  existingIds: Set<string>;
  onAdd: (rows: InventoryRow[]) => void;
}

function AddItemsPicker({ locationId, existingIds, onAdd }: AddItemsPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const { data, isLoading, isFetching } = useWarehouseItemsLazyInventory({
    pageSize: 25,
    search,
    locationId,
    stockMode: 'in_stock',
    sortBy: 'name',
    sortDir: 'asc',
  });

  const rows = useMemo(() => {
    const items = data?.pages?.flatMap((p) => p.items) ?? [];
    return items.filter((r: any) => !existingIds.has(r.id));
  }, [data, existingIds]);

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const chosen = rows.filter((r: any) => picked.has(r.id)) as InventoryRow[];
    if (chosen.length > 0) onAdd(chosen);
    setPicked(new Set());
    setSearch('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add items
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[480px] p-0">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items by code or name…"
              className="pl-8"
            />
          </div>
        </div>
        <ScrollArea className="h-72">
          {isLoading || isFetching ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No matching items with stock at this location.
            </div>
          ) : (
            <ul className="divide-y">
              {rows.map((r: any) => {
                const checked = picked.has(r.id);
                const stock = Number(r.current_stock ?? 0);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => togglePick(r.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/60 ${
                        checked ? 'bg-muted/60' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        readOnly
                        className="h-4 w-4"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{r.name}</div>
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {r.item_code}
                        </div>
                      </div>
                      <Badge variant={stock > 0 ? 'secondary' : 'outline'} className="shrink-0">
                        {stock} {r.unit_of_measure || ''}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <div className="p-3 border-t flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {picked.size} selected
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={picked.size === 0}>
              Add {picked.size > 0 ? picked.size : ''}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
