import { useMemo, useState } from 'react';
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
import { AlertCircle } from 'lucide-react';

export interface PastedEntry {
  name: string;
  uom?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSeed: (entries: PastedEntry[]) => void;
  /** Known units, used to preview which pasted UoM values will match. */
  units?: { id: string; name: string; abbreviation?: string | null }[];
}

/**
 * Split a pasted line into name + optional UoM. Accepts tab (Excel), a " | "
 * separator, or a comma so users can type by hand too.
 *
 * `allowComma` must be false for grid paste: names frequently contain commas
 * ("LED panel 8W, 12V") and splitting on them silently truncates the name.
 */
export function parsePastedLine(line: string, allowComma = true): PastedEntry | null {
  const raw = line.trim();
  if (!raw) return null;
  let parts: string[];
  if (raw.includes('\t')) parts = raw.split('\t');
  else if (raw.includes('|')) parts = raw.split('|');
  else if (allowComma && raw.includes(',')) parts = raw.split(',');
  else parts = [raw];
  const name = parts[0]?.trim() ?? '';
  const uom = parts[1]?.trim();
  if (!name) return null;
  return uom ? { name, uom } : { name };
}


export function PasteNamesDialog({ open, onOpenChange, onSeed, units = [] }: Props) {
  const [text, setText] = useState('');

  const unitTokens = useMemo(() => {
    const set = new Set<string>();
    units.forEach((u) => {
      if (u.abbreviation) set.add(String(u.abbreviation).trim().toLowerCase());
      if (u.name) set.add(String(u.name).trim().toLowerCase());
    });
    return set;
  }, [units]);

  const entries = useMemo(
    () => text.split(/\r?\n/).map((l) => parsePastedLine(l)).filter(Boolean) as PastedEntry[],
    [text],
  );

  const withUom = entries.filter((e) => e.uom);
  const unknownUom = withUom.filter((e) => !unitTokens.has(e.uom!.toLowerCase()));

  const handleAdd = () => {
    if (entries.length === 0) return;
    onSeed(entries);
    setText('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Paste item names</DialogTitle>
          <DialogDescription>
            One item per line. Optionally add the unit of measure as a second
            column — paste two columns from Excel, or type{' '}
            <code className="text-xs">Name, UoM</code> / <code className="text-xs">Name | UoM</code>.
            Anything not supplied is suggested automatically using UNSPSC and
            UN/CEFACT Rec 20 standards.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          rows={12}
          placeholder={'LED ceiling recessed 8W, Nos\nPVC conduit 25mm 3m, m\nPortland cement 50kg, kg'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="font-mono text-sm"
        />

        {entries.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">{entries.length} row(s)</Badge>
            {withUom.length > 0 && (
              <Badge variant="secondary">{withUom.length} with UoM</Badge>
            )}
            {unknownUom.length > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {unknownUom.length} unrecognised UoM
                {` (${[...new Set(unknownUom.map((e) => e.uom))].slice(0, 3).join(', ')}${
                  unknownUom.length > 3 ? '…' : ''
                }) — pick those in the grid`}
              </span>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={entries.length === 0}>
            Add {entries.length} row(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
