import { useMemo, useState } from 'react';
import { format } from 'date-fns';
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wrench, Search, Loader2 } from 'lucide-react';
import { MaterialReturnNote } from '@/types/materialIssueReturn';
import {
  useRepairCandidateMrns,
  useMaterialReturnRepair,
} from '@/hooks/useMaterialReturnRepair';
import {
  useMaterialReturnItems,
  MaterialReturnItemWithDetails,
} from '@/hooks/useMaterialReturnItems';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetMrn: MaterialReturnNote | null;
}

export function RepairMaterialReturnDialog({ open, onOpenChange, targetMrn }: Props) {
  const [search, setSearch] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  const { data: candidates, isLoading: candidatesLoading } = useRepairCandidateMrns(
    open ? targetMrn?.id ?? null : null,
    search
  );

  const { returnItems: sourceItems, isLoading: sourceItemsLoading } =
    useMaterialReturnItems(selectedSourceId ?? undefined);

  const { repairAsync, isRepairing } = useMaterialReturnRepair();

  const previewItems = useMemo<MaterialReturnItemWithDetails[]>(
    () => sourceItems ?? [],
    [sourceItems]
  );

  const handleClose = () => {
    if (isRepairing) return;
    setSearch('');
    setSelectedSourceId(null);
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (!targetMrn || !selectedSourceId) return;
    try {
      await repairAsync({ targetMrnId: targetMrn.id, sourceMrnId: selectedSourceId });
      handleClose();
    } catch {
      /* toast handled */
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? handleClose() : onOpenChange(v))}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Repair Material Return
          </DialogTitle>
          <DialogDescription>
            Clone item lines from a reference MRN into{' '}
            <span className="font-semibold">{targetMrn?.mrn_number}</span>. Use this for
            historical returns that were saved without items.
          </DialogDescription>
        </DialogHeader>

        {targetMrn && (
          <div className="rounded-md border p-3 bg-muted/40 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium">{targetMrn.mrn_number}</span>
              <Badge variant="outline" className="capitalize">{targetMrn.status}</Badge>
            </div>
            <div className="text-muted-foreground">
              {format(new Date(targetMrn.return_date), 'PP')} • Returned by{' '}
              {targetMrn.returned_by || '—'}
            </div>
            {targetMrn.notes && (
              <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                {targetMrn.notes}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden">
          {/* Candidate list */}
          <div className="flex flex-col min-h-0">
            <div className="relative mb-2">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search MRN #, returned by, or notes..."
                className="pl-8"
              />
            </div>
            <ScrollArea className="flex-1 border rounded-md">
              {candidatesLoading ? (
                <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading candidates...
                </div>
              ) : !candidates || candidates.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  No populated MRNs found in this company.
                </div>
              ) : (
                <ul className="divide-y">
                  {candidates.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedSourceId(c.id)}
                        className={cn(
                          'w-full text-left p-3 hover:bg-accent transition-colors',
                          selectedSourceId === c.id && 'bg-accent'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{c.mrn_number}</span>
                          <Badge variant="secondary">{c.item_count} items</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(c.return_date), 'PP')} • {c.returned_by || '—'}
                        </div>
                        {c.notes && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {c.notes}
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>

          {/* Preview */}
          <div className="flex flex-col min-h-0">
            <div className="text-sm font-medium mb-2">
              {selectedSourceId ? 'Items that will be cloned' : 'Select a reference MRN'}
            </div>
            <ScrollArea className="flex-1 border rounded-md">
              {!selectedSourceId ? (
                <div className="p-4 text-sm text-muted-foreground">
                  Pick an MRN on the left to preview its items.
                </div>
              ) : sourceItemsLoading ? (
                <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading items...
                </div>
              ) : previewItems.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  This MRN has no items. Choose another.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr className="text-left">
                      <th className="p-2 font-medium">Item</th>
                      <th className="p-2 font-medium text-right">Qty</th>
                      <th className="p-2 font-medium">Cond.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewItems.map((it) => (
                      <tr key={it.id} className="border-t">
                        <td className="p-2">
                          <div className="font-medium">
                            {it.item_code || '—'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {it.item_name || ''}
                          </div>
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {Number(it.quantity_returned)}
                          {it.unit_of_measure ? (
                            <span className="text-xs text-muted-foreground ml-1">
                              {it.unit_of_measure}
                            </span>
                          ) : null}
                        </td>
                        <td className="p-2 capitalize">{it.condition}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isRepairing}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedSourceId || previewItems.length === 0 || isRepairing}
          >
            {isRepairing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Clone {previewItems.length || ''} item{previewItems.length === 1 ? '' : 's'} into{' '}
            {targetMrn?.mrn_number}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
