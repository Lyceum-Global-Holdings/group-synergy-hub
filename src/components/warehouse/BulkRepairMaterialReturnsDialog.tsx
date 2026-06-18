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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wrench, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { MaterialReturnNote } from '@/types/materialIssueReturn';
import {
  useRepairCandidateMrns,
  useMaterialReturnRepair,
} from '@/hooks/useMaterialReturnRepair';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emptyMrns: MaterialReturnNote[];
}

type Result = { mrnId: string; ok: boolean; message?: string; count?: number };

export function BulkRepairMaterialReturnsDialog({ open, onOpenChange, emptyMrns }: Props) {
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState(false);
  const { toast } = useToast();

  // Use the first empty MRN as the "target" for candidate listing; the RPC
  // scopes by company which is the same across all empty MRNs in this batch.
  const referenceTargetId = emptyMrns[0]?.id ?? null;
  const { data: candidates, isLoading: candidatesLoading } = useRepairCandidateMrns(
    open ? referenceTargetId : null,
    ''
  );
  const { repairAsync } = useMaterialReturnRepair();

  const eligible = useMemo(
    () => emptyMrns.filter((m) => m.status !== 'cancelled'),
    [emptyMrns]
  );

  const handleClose = () => {
    if (running) return;
    setSelectedSourceId(null);
    setResults([]);
    onOpenChange(false);
  };

  const handleRun = async () => {
    if (!selectedSourceId) return;
    setRunning(true);
    setResults([]);
    const acc: Result[] = [];
    for (const m of eligible) {
      try {
        const count = await repairAsync({
          targetMrnId: m.id,
          sourceMrnId: selectedSourceId,
        });
        acc.push({ mrnId: m.id, ok: true, count });
      } catch (e: any) {
        acc.push({ mrnId: m.id, ok: false, message: e?.message ?? 'Failed' });
      }
      setResults([...acc]);
    }
    setRunning(false);
    const ok = acc.filter((r) => r.ok).length;
    const fail = acc.length - ok;
    toast({
      title: 'Bulk repair finished',
      description: `${ok} succeeded, ${fail} failed.`,
      variant: fail > 0 ? 'destructive' : 'default',
    });
  };

  const resultFor = (id: string) => results.find((r) => r.mrnId === id);

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? handleClose() : onOpenChange(v))}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Bulk Repair Empty Material Returns
          </DialogTitle>
          <DialogDescription>
            Pick one reference MRN and clone its items into every empty MRN below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden">
          {/* Reference picker */}
          <div className="flex flex-col min-h-0">
            <div className="text-sm font-medium mb-2">Reference MRN</div>
            <ScrollArea className="flex-1 border rounded-md">
              {candidatesLoading ? (
                <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : !candidates || candidates.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  No populated MRNs available.
                </div>
              ) : (
                <ul className="divide-y">
                  {candidates.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedSourceId(c.id)}
                        disabled={running}
                        className={cn(
                          'w-full text-left p-3 hover:bg-accent transition-colors',
                          selectedSourceId === c.id && 'bg-accent'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{c.mrn_number}</span>
                          <Badge variant="secondary">{c.item_count} items</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
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

          {/* Target list */}
          <div className="flex flex-col min-h-0">
            <div className="text-sm font-medium mb-2">
              Targets ({eligible.length})
            </div>
            <ScrollArea className="flex-1 border rounded-md">
              <ul className="divide-y">
                {eligible.map((m) => {
                  const r = resultFor(m.id);
                  return (
                    <li key={m.id} className="p-3 text-sm flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{m.mrn_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(m.return_date), 'PP')} •{' '}
                          <span className="capitalize">{m.status}</span>
                        </div>
                        {r && !r.ok && (
                          <div className="text-xs text-destructive mt-1">{r.message}</div>
                        )}
                      </div>
                      {r?.ok && (
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      )}
                      {r && !r.ok && (
                        <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={running}>
            Close
          </Button>
          <Button
            onClick={handleRun}
            disabled={!selectedSourceId || running || eligible.length === 0}
          >
            {running && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Repair {eligible.length} MRN{eligible.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
