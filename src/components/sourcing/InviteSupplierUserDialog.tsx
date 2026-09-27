import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Copy } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  supplierId: string;
  supplierName?: string;
}

export const InviteSupplierUserDialog = ({ open, onOpenChange, supplierId, supplierName }: Props) => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "admin" | "user" | "viewer">("user");
  const [hours, setHours] = useState(168);
  const [busy, setBusy] = useState(false);
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null);

  const reset = () => { setEmail(""); setRole("user"); setHours(168); setAcceptUrl(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("supplier-invite", {
      body: { supplier_id: supplierId, email, portal_role: role, expires_in_hours: hours },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast({
        title: "Invite failed",
        description: String((data as any)?.error || error?.message || "Unknown error"),
        variant: "destructive",
      });
      return;
    }
    setAcceptUrl((data as any).accept_url ?? null);
    // Nothing is emailed: the admin shares the link below with the supplier.
    toast({ title: "Invitation link created", description: `Copy the link and send it to ${email}.` });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to supplier portal</DialogTitle>
          <DialogDescription>
            {supplierName ? `Invite a user to ${supplierName}.` : "Invite a user to this supplier."}
          </DialogDescription>
        </DialogHeader>
        {acceptUrl ? (
          <div className="space-y-3">
            <Label>Acceptance link (one-time)</Label>
            <div className="flex gap-2">
              <Input readOnly value={acceptUrl} />
              <Button type="button" variant="outline" onClick={() => { navigator.clipboard.writeText(acceptUrl); toast({ title: "Copied" }); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this link with the invitee. On that page they set a password for <strong>{email}</strong>, or sign in if they already have an account.
            </p>
            <DialogFooter>
              <Button onClick={() => { onOpenChange(false); reset(); }}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Portal role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-hours">Expires in (hours)</Label>
                <Input id="invite-hours" type="number" min={1} max={720} value={hours}
                  onChange={(e) => setHours(Number(e.target.value))} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send invitation
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
