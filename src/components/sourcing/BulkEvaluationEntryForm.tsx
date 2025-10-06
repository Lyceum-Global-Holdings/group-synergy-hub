import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import { QUALITY_OPTIONS, PUNCTUALITY_OPTIONS } from "@/types/supplierEvaluation";
import { format } from "date-fns";

interface EvaluationRow {
  id: string;
  receipt_date: string;
  po_delivery_date: string;
  po_number: string;
  quality: string;
  punctuality: string;
  quality_score: number;
  punctuality_score: number;
  total_score: number;
}

interface BulkEvaluationEntryFormProps {
  onSubmit: (entries: any[]) => void;
  onCancel: () => void;
}

export function BulkEvaluationEntryForm({ onSubmit, onCancel }: BulkEvaluationEntryFormProps) {
  const [rows, setRows] = useState<EvaluationRow[]>([
    createEmptyRow()
  ]);

  function createEmptyRow(): EvaluationRow {
    return {
      id: crypto.randomUUID(),
      receipt_date: format(new Date(), "yyyy-MM-dd"),
      po_delivery_date: "",
      po_number: "",
      quality: "",
      punctuality: "",
      quality_score: 0,
      punctuality_score: 0,
      total_score: 0,
    };
  }

  const handleAddRow = () => {
    setRows([...rows, createEmptyRow()]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter(row => row.id !== id));
    }
  };

  const handleFieldChange = (id: string, field: keyof EvaluationRow, value: any) => {
    setRows(rows.map(row => {
      if (row.id !== id) return row;
      
      const updated = { ...row, [field]: value };
      
      // Recalculate scores when quality or punctuality changes
      if (field === 'quality') {
        const qualityOption = QUALITY_OPTIONS.find(opt => opt.key === value);
        updated.quality_score = qualityOption?.score || 0;
      }
      if (field === 'punctuality') {
        const punctualityOption = PUNCTUALITY_OPTIONS.find(opt => opt.key === value);
        updated.punctuality_score = punctualityOption?.score || 0;
      }
      
      updated.total_score = updated.quality_score + updated.punctuality_score;
      
      return updated;
    }));
  };

  const handleSubmit = () => {
    const entries = rows.map(row => ({
      receipt_date: row.receipt_date,
      po_delivery_date: row.po_delivery_date,
      po_number: row.po_number || undefined,
      passed_first_time: row.quality === 'passed_first_time',
      passed_after_rework: row.quality === 'passed_after_rework',
      failed_but_accepted: row.quality === 'failed_but_accepted',
      failed_returned: row.quality === 'failed_returned',
      within_due_date: row.punctuality === 'within_due_date',
      five_days_late: row.punctuality === 'five_days_late',
      within_14_days: row.punctuality === 'within_14_days',
      over_14_days_late: row.punctuality === 'over_14_days_late',
    }));
    
    onSubmit(entries);
  };

  const totalPoints = rows.reduce((sum, row) => sum + row.total_score, 0);
  const totalPossible = rows.length * 100;
  const performanceRate = totalPossible > 0 ? (totalPoints / totalPossible) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="p-3 text-left text-sm font-medium">Receipt Date</th>
                <th className="p-3 text-left text-sm font-medium">PO Delivery Date</th>
                <th className="p-3 text-left text-sm font-medium">PO Number</th>
                <th className="p-3 text-left text-sm font-medium">Product Quality (50%)</th>
                <th className="p-3 text-left text-sm font-medium">Punctuality (50%)</th>
                <th className="p-3 text-center text-sm font-medium">Score</th>
                <th className="p-3 text-center text-sm font-medium w-20">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="p-3">
                    <Input
                      type="date"
                      value={row.receipt_date}
                      onChange={(e) => handleFieldChange(row.id, 'receipt_date', e.target.value)}
                      className="h-9"
                    />
                  </td>
                  <td className="p-3">
                    <Input
                      type="date"
                      value={row.po_delivery_date}
                      onChange={(e) => handleFieldChange(row.id, 'po_delivery_date', e.target.value)}
                      className="h-9"
                    />
                  </td>
                  <td className="p-3">
                    <Input
                      value={row.po_number}
                      onChange={(e) => handleFieldChange(row.id, 'po_number', e.target.value)}
                      placeholder="Optional"
                      className="h-9"
                    />
                  </td>
                  <td className="p-3">
                    <RadioGroup
                      value={row.quality}
                      onValueChange={(value) => handleFieldChange(row.id, 'quality', value)}
                      className="space-y-2"
                    >
                      {QUALITY_OPTIONS.map(option => (
                        <div key={option.key} className="flex items-center space-x-2">
                          <RadioGroupItem value={option.key} id={`${row.id}-quality-${option.key}`} />
                          <Label 
                            htmlFor={`${row.id}-quality-${option.key}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {option.label} ({option.score})
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </td>
                  <td className="p-3">
                    <RadioGroup
                      value={row.punctuality}
                      onValueChange={(value) => handleFieldChange(row.id, 'punctuality', value)}
                      className="space-y-2"
                    >
                      {PUNCTUALITY_OPTIONS.map(option => (
                        <div key={option.key} className="flex items-center space-x-2">
                          <RadioGroupItem value={option.key} id={`${row.id}-punctuality-${option.key}`} />
                          <Label 
                            htmlFor={`${row.id}-punctuality-${option.key}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {option.label} ({option.score})
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </td>
                  <td className="p-3 text-center">
                    <div className="font-semibold text-lg">{row.total_score}</div>
                    <div className="text-xs text-muted-foreground">
                      Q:{row.quality_score} P:{row.punctuality_score}
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveRow(row.id)}
                      disabled={rows.length === 1}
                      className="h-9 w-9"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleAddRow}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Delivery Entry
        </Button>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Total Performance</div>
            <div className="text-2xl font-bold">
              {performanceRate.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">
              {totalPoints} / {totalPossible} points
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={rows.some(row => !row.receipt_date || !row.po_delivery_date || !row.quality || !row.punctuality)}
        >
          Save {rows.length} {rows.length === 1 ? 'Entry' : 'Entries'}
        </Button>
      </div>
    </div>
  );
}
