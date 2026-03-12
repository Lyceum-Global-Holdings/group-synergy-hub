import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useUpsertDailyEntry } from "@/hooks/useProduction";

interface Props {
  stageId: string;
  existingEntries: any[];
  unitCost?: number;
}

const fmt = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DailyEntryForm({ stageId, existingEntries, unitCost = 0 }: Props) {
  const upsert = useUpsertDailyEntry();
  const [date, setDate] = useState<Date>(new Date());
  const [inputQty, setInputQty] = useState(0);
  const [outputQty, setOutputQty] = useState(0);
  const [wastageQty, setWastageQty] = useState(0);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const dateStr = format(date, "yyyy-MM-dd");
    const existing = existingEntries?.find((e) => e.entry_date === dateStr);
    if (existing) {
      setInputQty(existing.input_qty || 0);
      setOutputQty(existing.output_qty || 0);
      setWastageQty(existing.wastage_qty || 0);
      setNotes(existing.notes || "");
    } else {
      setInputQty(0);
      setOutputQty(0);
      setWastageQty(0);
      setNotes("");
    }
  }, [date, existingEntries]);

  const handleSubmit = () => {
    upsert.mutate({
      stage_id: stageId,
      entry_date: format(date, "yyyy-MM-dd"),
      input_qty: inputQty,
      output_qty: outputQty,
      wastage_qty: wastageQty,
      notes: notes || undefined,
    });
  };

  const dateStr = format(date, "yyyy-MM-dd");
  const isEdit = existingEntries?.some((e) => e.entry_date === dateStr);

  const inputCost = inputQty * unitCost;
  const outputCost = outputQty * unitCost;
  const wastageCost = wastageQty * unitCost;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
      <h4 className="text-sm font-medium text-foreground">
        {isEdit ? "Edit" : "Add"} Daily Entry
      </h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div>
          <Label className="text-xs text-muted-foreground">Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                size="sm"
              >
                <CalendarIcon className="mr-1 h-3 w-3" />
                {format(date, "MMM dd")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Input Qty</Label>
          <Input type="number" value={inputQty} onChange={(e) => setInputQty(Number(e.target.value))} className="h-8" />
          {unitCost > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">Cost: {fmt(inputCost)}</p>}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Output Qty</Label>
          <Input type="number" value={outputQty} onChange={(e) => setOutputQty(Number(e.target.value))} className="h-8" />
          {unitCost > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">Cost: {fmt(outputCost)}</p>}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Wastage</Label>
          <Input type="number" value={wastageQty} onChange={(e) => setWastageQty(Number(e.target.value))} className="h-8" />
          {unitCost > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">Cost: {fmt(wastageCost)}</p>}
        </div>
        <div className="flex items-end">
          <Button size="sm" onClick={handleSubmit} disabled={upsert.isPending} className="w-full">
            {upsert.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
            {isEdit ? "Update" : "Add"}
          </Button>
        </div>
      </div>
      {unitCost > 0 && (
        <p className="text-xs font-medium text-muted-foreground">
          Total Daily Cost: {fmt(inputCost + wastageCost)}
        </p>
      )}
      <div>
        <Label className="text-xs text-muted-foreground">Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={1} className="resize-none text-sm" placeholder="Optional notes..." />
      </div>
    </div>
  );
}
