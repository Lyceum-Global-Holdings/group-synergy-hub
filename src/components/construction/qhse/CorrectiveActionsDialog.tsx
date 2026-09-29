import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionListEditor } from "./ActionListEditor";
import {
  ACTION_STATUS_LABEL, type ActionDraft, type CorrectiveAction, type QhseSourceType, actionsPayload,
  useCompanyUsers, useCorrectiveActions, useQhseStep,
} from "@/hooks/construction/useQhseWorkflow";

const STATUS_CLASS: Record<string, string> = {
  open: "bg-amber-100 text-amber-800",
  done: "bg-blue-100 text-blue-800",
  verified: "bg-green-100 text-green-800",
  cancelled: "bg-muted text-muted-foreground",
};

type Pending = { action: CorrectiveAction; mode: "complete" | "accept" | "send_back" | "cancel" } | null;
const PROMPT: Record<NonNullable<Pending>["mode"], string> = {
  complete: "What was done *",
  accept: "Verification note",
  send_back: "What still needs doing *",
  cancel: "Reason for cancelling *",
};

/**
 * The actions raised on one inspection or incident. Owners mark them done;
 * a manager verifies them (not the person who did the work) or sends them back.
 */
export function CorrectiveActionsDialog({ open, onOpenChange, sourceType, source, canAdd }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceType: QhseSourceType;
  source: { id: string; number: string; title?: string | null } | null;
  canAdd: boolean;
}) {
  const { data: actions = [], isLoading } = useCorrectiveActions(sourceType, source?.id);
  const { data: users = [] } = useCompanyUsers();
  const step = useQhseStep();
  const [drafts, setDrafts] = useState<ActionDraft[]>([]);
  const [pending, setPending] = useState<Pending>(null);
  const [note, setNote] = useState("");
  useEffect(() => { if (open) { setDrafts([]); setPending(null); } }, [open]);
  useEffect(() => setNote(""), [pending]);

  const name = useMemo(() => new Map(users.map((u) => [u.user_id, u.full_name || u.email || "User"])), [users]);
  const noteRequired = pending && pending.mode !== "accept";

  const run = () => {
    if (!pending) return;
    const a = pending.action;
    const call =
      pending.mode === "complete" ? { fn: "complete_corrective_action", args: { p_action_id: a.id, p_note: note }, done: "Marked done; waiting for verification" }
      : pending.mode === "cancel" ? { fn: "cancel_corrective_action", args: { p_action_id: a.id, p_reason: note }, done: "Action cancelled" }
      : { fn: "verify_corrective_action", args: { p_action_id: a.id, p_accept: pending.mode === "accept", p_note: note },
          done: pending.mode === "accept" ? "Action verified" : "Sent back to its owner" };
    step.mutate(call, { onSuccess: () => setPending(null) });
  };

  const add = () => {
    if (!source) return;
    const list = actionsPayload(drafts);
    // One call per action keeps each one's own checks and message.
    list.reduce<Promise<unknown>>((p, a) => p.then(() => step.mutateAsync({
      fn: "add_corrective_action",
      args: { p_source_type: sourceType, p_source_id: source.id, p_description: a.description, p_action_type: a.action_type,
              p_assigned_to: a.assigned_to, p_due_date: a.due_date },
    })), Promise.resolve()).then(() => setDrafts([])).catch(() => undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Corrective actions · {source?.number}</DialogTitle>
          <DialogDescription>{source?.title}</DialogDescription>
        </DialogHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead><TableHead>Action</TableHead><TableHead>Owner</TableHead><TableHead>Due</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Next step</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && actions.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No actions yet.</TableCell></TableRow>
            )}
            {actions.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs">{a.action_number}</TableCell>
                <TableCell>
                  <div>{a.description}</div>
                  <div className="text-xs text-muted-foreground capitalize">{a.action_type}</div>
                  {a.completion_note && <div className="text-xs text-muted-foreground">Done: {a.completion_note}</div>}
                  {a.verification_note && <div className="text-xs text-muted-foreground">Note: {a.verification_note}</div>}
                </TableCell>
                <TableCell>{a.assigned_to ? name.get(a.assigned_to) ?? "—" : "—"}</TableCell>
                <TableCell>{a.due_date ? format(new Date(a.due_date), "d MMM yyyy") : "—"}</TableCell>
                <TableCell><Badge className={STATUS_CLASS[a.status]}>{ACTION_STATUS_LABEL[a.status]}</Badge></TableCell>
                <TableCell className="text-right space-x-1 whitespace-nowrap">
                  {a.status === "open" && <Button size="sm" variant="outline" onClick={() => setPending({ action: a, mode: "complete" })}>Mark done</Button>}
                  {a.status === "done" && (
                    <>
                      <Button size="sm" onClick={() => setPending({ action: a, mode: "accept" })}>Verify</Button>
                      <Button size="sm" variant="outline" onClick={() => setPending({ action: a, mode: "send_back" })}>Send back</Button>
                    </>
                  )}
                  {(a.status === "open" || a.status === "done") && (
                    <Button size="sm" variant="ghost" onClick={() => setPending({ action: a, mode: "cancel" })}>Cancel</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {pending && (
          <div className="flex items-end gap-2 rounded-md border p-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="action-note">{pending.action.action_number}: {PROMPT[pending.mode]}</Label>
              <Input id="action-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button onClick={run} disabled={(!!noteRequired && !note.trim()) || step.isPending}>Save</Button>
            <Button variant="outline" onClick={() => setPending(null)}>Back</Button>
          </div>
        )}

        {canAdd && (
          <div className="space-y-2 border-t pt-3">
            <ActionListEditor value={drafts} onChange={setDrafts} />
            {drafts.length > 0 && (
              <Button size="sm" onClick={add} disabled={actionsPayload(drafts).length === 0 || step.isPending}>Save actions</Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
