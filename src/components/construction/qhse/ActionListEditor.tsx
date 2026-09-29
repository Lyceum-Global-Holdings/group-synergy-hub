import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type ActionDraft, emptyAction, useCompanyUsers } from "@/hooks/construction/useQhseWorkflow";

const NOBODY = "none";
const today = () => new Date().toISOString().slice(0, 10);

/** Corrective / preventive actions typed in with a result or a closure. */
export function ActionListEditor({ value, onChange, required }: { value: ActionDraft[]; onChange: (v: ActionDraft[]) => void; required?: boolean }) {
  const { data: users = [] } = useCompanyUsers();
  const set = (i: number, patch: Partial<ActionDraft>) => onChange(value.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Corrective actions{required ? " *" : ""}</Label>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...value, emptyAction()])}>
          <Plus className="mr-1 h-3 w-3" /> Add action
        </Button>
      </div>
      {value.length === 0 && <p className="text-sm text-muted-foreground">No actions added.</p>}
      {value.map((a, i) => (
        <div key={i} className="grid gap-2 rounded-md border p-2 md:grid-cols-[1fr_130px_170px_140px_auto]">
          <Input aria-label={`Action ${i + 1}`} placeholder="What needs doing" value={a.description} onChange={(e) => set(i, { description: e.target.value })} />
          <Select value={a.action_type} onValueChange={(v) => set(i, { action_type: v as ActionDraft["action_type"] })}>
            <SelectTrigger aria-label={`Action ${i + 1} type`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="corrective">Corrective</SelectItem>
              <SelectItem value="preventive">Preventive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={a.assigned_to || NOBODY} onValueChange={(v) => set(i, { assigned_to: v === NOBODY ? "" : v })}>
            <SelectTrigger aria-label={`Action ${i + 1} owner`}><SelectValue placeholder="Owner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NOBODY}>No owner yet</SelectItem>
              {users.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || u.email}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input aria-label={`Action ${i + 1} due date`} type="date" min={today()} value={a.due_date} onChange={(e) => set(i, { due_date: e.target.value })} />
          <Button type="button" size="icon" variant="ghost" aria-label={`Remove action ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
