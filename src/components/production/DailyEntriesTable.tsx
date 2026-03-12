import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";

interface Props {
  entries: any[];
  onSelectDate: (date: Date) => void;
}

export default function DailyEntriesTable({ entries, onSelectDate }: Props) {
  if (!entries || entries.length === 0) {
    return <p className="text-xs text-muted-foreground italic py-2">No daily entries yet.</p>;
  }

  const totals = entries.reduce(
    (acc, e) => ({
      input: acc.input + (e.input_qty || 0),
      output: acc.output + (e.output_qty || 0),
      wastage: acc.wastage + (e.wastage_qty || 0),
    }),
    { input: 0, output: 0, wastage: 0 }
  );

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Date</TableHead>
            <TableHead className="text-xs text-right">Input</TableHead>
            <TableHead className="text-xs text-right">Output</TableHead>
            <TableHead className="text-xs text-right">Wastage</TableHead>
            <TableHead className="text-xs">Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow
              key={entry.id}
              className="cursor-pointer hover:bg-accent/40"
              onClick={() => onSelectDate(new Date(entry.entry_date + "T00:00:00"))}
            >
              <TableCell className="text-xs font-medium">
                {format(new Date(entry.entry_date + "T00:00:00"), "MMM dd, yyyy")}
              </TableCell>
              <TableCell className="text-xs text-right">{entry.input_qty}</TableCell>
              <TableCell className="text-xs text-right">{entry.output_qty}</TableCell>
              <TableCell className="text-xs text-right">{entry.wastage_qty}</TableCell>
              <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">
                {entry.notes || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="text-xs font-semibold">Total</TableCell>
            <TableCell className="text-xs text-right font-semibold">{totals.input}</TableCell>
            <TableCell className="text-xs text-right font-semibold">{totals.output}</TableCell>
            <TableCell className="text-xs text-right font-semibold">{totals.wastage}</TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
