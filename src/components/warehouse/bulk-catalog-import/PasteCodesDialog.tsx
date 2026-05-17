import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { PasteEntry } from './types';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onResolve: (entries: PasteEntry[]) => Promise<{ resolved: number; missing: string[]; withQty?: number }>;
}

const HEADER_RE = /^(code|item|sku|gtin|barcode)/i;

function detectDelimiter(line: string): RegExp {
  if (line.includes('\t')) return /\t/;
  if (line.includes(';')) return /;/;
  if (line.includes(',')) return /,/;
  return /\s{2,}/; // fall back to 2+ spaces
}

function toNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parsePaste(text: string): PasteEntry[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const out: PasteEntry[] = [];
  lines.forEach((line, idx) => {
    const delim = detectDelimiter(line);
    const cells = line.split(delim).map((c) => c.trim());
    if (idx === 0 && cells[0] && HEADER_RE.test(cells[0])) return; // skip header
    const [code, qty, cost, ...rest] = cells;
    if (!code) return;
    out.push({
      code,
      opening_qty: toNumber(qty),
      unit_cost: toNumber(cost),
      notes: rest.length ? rest.join(' ').trim() || null : null,
    });
  });
  return out;
}

export function PasteCodesDialog({ open, onOpenChange, onResolve }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const previewCount = useMemo(() => parsePaste(text).length, [text]);

  const handleResolve = async () => {
    const entries = parsePaste(text);
    if (entries.length === 0) return;
    setBusy(true);
    try {
      const { resolved, missing, withQty } = await onResolve(entries);
      toast({
        title: 'Resolved',
        description: `${resolved} matched · ${withQty ?? 0} with qty · ${missing.length} not found${
          missing.length ? `: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}` : ''
        }`,
        variant: missing.length ? 'destructive' : 'default',
      });
      setText('');
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Resolve failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Paste items & opening qty</DialogTitle>
          <DialogDescription>
            One row per line. Columns separated by <strong>tab</strong>, comma or semicolon —
            paste directly from Excel or Google Sheets. A header row is auto-skipped.
            <br />
            Columns (in order): <strong>code</strong>, opening qty, unit cost, notes.
            Code accepts item code, GTIN/barcode or SKU. Location/bin come from the dialog defaults;
            rows with qty &gt; 0 need a bin set before import.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'code\topening_qty\tunit_cost\tnotes\nITM-001\t50\t12.50\tOpening from FY26 audit\n5012345678900\t10\nITM-XYZ\t0'}
          className="font-mono text-sm"
        />
        <div className="text-xs text-muted-foreground">
          {previewCount > 0 ? `${previewCount} row${previewCount === 1 ? '' : 's'} ready` : 'Paste rows above'}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleResolve} disabled={busy || previewCount === 0}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Resolve &amp; add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
