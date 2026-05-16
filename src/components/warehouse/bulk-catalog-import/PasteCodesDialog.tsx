import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onResolve: (codes: string[]) => Promise<{ resolved: number; missing: string[] }>;
}

export function PasteCodesDialog({ open, onOpenChange, onResolve }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const handleResolve = async () => {
    const codes = text
      .split(/[\n,;\t]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (codes.length === 0) return;
    setBusy(true);
    try {
      const { resolved, missing } = await onResolve(codes);
      toast({
        title: 'Resolved',
        description: `${resolved} matched, ${missing.length} not found${missing.length ? `: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}` : ''}`,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Paste catalog codes</DialogTitle>
          <DialogDescription>
            One item per line. Accepts <strong>item code</strong>, <strong>GTIN/barcode</strong>, or <strong>SKU</strong>.
            Unknown values will be flagged in the grid.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'ITM-001\nITM-002\n5012345678900'}
          className="font-mono text-sm"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleResolve} disabled={busy || !text.trim()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Resolve &amp; add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
