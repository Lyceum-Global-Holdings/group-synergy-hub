import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import type { BrowsePickedRow } from '../BrowseInventoryDialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  locationId: string | null;
  onResolved: (rows: BrowsePickedRow[]) => void;
}

type LineResult =
  | { code: string; qty: number; status: 'resolved'; row: BrowsePickedRow }
  | { code: string; qty: number; status: 'not_found' | 'out_of_stock' | 'duplicate' };

function parseLines(text: string): { code: string; qty: number }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      // Accept "CODE", "CODE,QTY", "CODE\tQTY", "CODE QTY"
      const parts = line.split(/[\t,]|\s{2,}|\s+(?=\d)/).map((p) => p.trim()).filter(Boolean);
      const code = parts[0];
      const qty = parts.length > 1 ? parseFloat(parts[1]) : 0;
      return { code, qty: isNaN(qty) ? 0 : qty };
    })
    .filter((p) => p.code);
}

export function PasteCodesDialog({ open, onOpenChange, companyId, locationId, onResolved }: Props) {
  const [text, setText] = useState('');
  const [results, setResults] = useState<LineResult[] | null>(null);
  const [resolving, setResolving] = useState(false);

  const handleResolve = async () => {
    setResolving(true);
    setResults(null);
    try {
      const lines = parseLines(text);
      const seen = new Set<string>();
      const out: LineResult[] = [];
      // Sequential per code; small N expected (paste use-case).
      for (const ln of lines) {
        const key = ln.code.toUpperCase();
        if (seen.has(key)) {
          out.push({ ...ln, status: 'duplicate' });
          continue;
        }
        seen.add(key);

        const { data, error } = await supabase.rpc('list_warehouse_inventory' as any, {
          _company_id: companyId,
          _search: ln.code,
          _category_id: null,
          _status: 'active',
          _location_ids: locationId ? [locationId] : null,
          _cursor_created_at: null,
          _cursor_id: null,
          _limit: 5,
          _stock_mode: 'all',
        } as any);
        if (error) {
          out.push({ ...ln, status: 'not_found' });
          continue;
        }
        const match = ((data || []) as any[]).find(
          (r) => (r.item_code || '').toUpperCase() === key,
        );
        if (!match) {
          out.push({ ...ln, status: 'not_found' });
          continue;
        }
        const avail = Number(match.current_stock || 0);
        if (avail <= 0) {
          out.push({ ...ln, status: 'out_of_stock' });
          continue;
        }
        const firstBin = Array.isArray(match.bins) && match.bins.length > 0 ? match.bins[0] : null;
        out.push({
          ...ln,
          status: 'resolved',
          row: {
            id: match.id,
            item_code: match.item_code,
            name: match.name,
            description: match.description ?? null,
            unit_of_measure: match.unit_abbreviation || match.unit_name || null,
            current_stock: avail,
            bin_code: firstBin?.bin_code || null,
            quantity: ln.qty > 0 ? Math.min(ln.qty, avail) : 0,
          },
        });
      }
      setResults(out);
    } finally {
      setResolving(false);
    }
  };

  const handleAdd = () => {
    if (!results) return;
    const rows = results.filter((r): r is Extract<LineResult, { status: 'resolved' }> => r.status === 'resolved').map((r) => r.row);
    onResolved(rows);
    setText('');
    setResults(null);
    onOpenChange(false);
  };

  const resolvedCount = results?.filter((r) => r.status === 'resolved').length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Paste item codes</DialogTitle>
          <DialogDescription>
            One per line. Format: <code>ITEM-CODE</code> or <code>ITEM-CODE, qty</code>. You can also
            paste two columns (code &amp; qty) directly from Excel.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          rows={10}
          placeholder={'INV-ELE-ELC-066, 5\nINV-ELE-PLM-034, 2'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="font-mono text-sm"
        />

        {results && (
          <div className="max-h-56 overflow-auto border rounded-md p-2 text-sm space-y-1">
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="font-mono">{r.code}</span>
                {r.status === 'resolved' && (
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">qty {r.row.quantity || '—'}</span>
                    <Badge variant="secondary">resolved</Badge>
                  </span>
                )}
                {r.status === 'not_found' && <Badge variant="destructive">not found</Badge>}
                {r.status === 'out_of_stock' && <Badge variant="destructive">out of stock</Badge>}
                {r.status === 'duplicate' && <Badge variant="outline">duplicate</Badge>}
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="secondary" onClick={handleResolve} disabled={!text.trim() || resolving || !locationId}>
            {resolving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Resolve
          </Button>
          <Button onClick={handleAdd} disabled={!results || resolvedCount === 0}>
            Add {resolvedCount > 0 ? resolvedCount : ''} to grid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
