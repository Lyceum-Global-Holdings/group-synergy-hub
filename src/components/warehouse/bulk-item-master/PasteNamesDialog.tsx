import { useState } from 'react';
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

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSeed: (names: string[]) => void;
}

export function PasteNamesDialog({ open, onOpenChange, onSeed }: Props) {
  const [text, setText] = useState('');

  const handleAdd = () => {
    const names = text
      .split(/\r?\n/)
      .map((l) => l.split('\t')[0].trim())
      .filter(Boolean);
    if (names.length === 0) return;
    onSeed(names);
    setText('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Paste item names</DialogTitle>
          <DialogDescription>
            One item per line. You can paste a column copied from Excel — only the
            first column is used as the item name. Category and UoM are suggested
            automatically using UNSPSC and UN/CEFACT Rec 20 standards.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={12}
          placeholder={'LED ceiling recessed 8W\nPVC conduit 25mm 3m\nPortland cement 50kg'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="font-mono text-sm"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!text.trim()}>
            Add {text.split(/\r?\n/).filter((l) => l.trim()).length} row(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
