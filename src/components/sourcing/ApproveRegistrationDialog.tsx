import { useEffect, useState } from "react";
import { AlertTriangle, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useApproveRegistration, useRegistrationReview } from "@/hooks/useSupplierRegistration";
import type { SupplierRegistrationRequest } from "@/types/supplierRegistration";
import { DuplicateMatchList } from "./registration/DuplicateMatchList";

const NEW_SUPPLIER = "new";

/** "Commercial Bank, account ending 4567" from the registration's bank fields. */
function bankSummary(data: Record<string, any>): string | null {
  const account = String(data.bank_account_number || data.iban || data.bank_iban || "").replace(/\s/g, "");
  if (!account) return null;
  const bank = data.bank_name ? `${data.bank_name}, ` : "";
  return `${bank}account ending ${account.slice(-4)}`;
}

interface ApproveRegistrationDialogProps {
  registration: SupplierRegistrationRequest;
  onOpenChange: (open: boolean) => void;
}

/**
 * Approving checks the registration against existing suppliers. A match is
 * either linked (the existing supplier is added to the company) or, with a
 * reason, created as a new supplier. A tax ID already on file must be linked.
 */
export function ApproveRegistrationDialog({ registration, onOpenChange }: ApproveRegistrationDialogProps) {
  const review = useRegistrationReview(registration.id);
  const approve = useApproveRegistration();
  const [choice, setChoice] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const duplicates = review.data?.duplicates ?? [];
  const supplierMatches = duplicates.filter((d) => d.kind === "supplier");
  const taxMatch = supplierMatches.find((d) => d.reasons.includes("tax_id"));

  // Default: link to the supplier with the same tax ID, otherwise create new.
  useEffect(() => {
    if (review.data && choice === null) setChoice(taxMatch ? taxMatch.id : NEW_SUPPLIER);
  }, [review.data, taxMatch, choice]);

  const data = (registration.supplier_data ?? {}) as Record<string, any>;
  const bank = bankSummary(data);
  const linking = choice !== null && choice !== NEW_SUPPLIER;
  const needsReason = choice === NEW_SUPPLIER && duplicates.length > 0;
  const canConfirm =
    !!review.data?.can_approve &&
    choice !== null &&
    !approve.isPending &&
    !(choice === NEW_SUPPLIER && taxMatch) &&
    (!needsReason || reason.trim().length > 0);

  const confirm = () => {
    approve.mutate(
      {
        id: registration.id,
        notes,
        duplicateReason: needsReason ? reason : undefined,
        linkSupplierId: linking ? choice! : undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Approve {data.supplier_name || "registration"}</DialogTitle>
          <DialogDescription>
            {registration.request_type === "self_service" ? "Public registration" : "Internal registration"}
            {data.email ? ` · ${data.email}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {review.isLoading && <p className="text-muted-foreground">Checking for existing suppliers…</p>}
          {review.error && (
            <Alert variant="destructive">
              <AlertDescription>Couldn't check this registration: {(review.error as Error).message}</AlertDescription>
            </Alert>
          )}
          {review.data && !review.data.can_approve && (
            <Alert>
              <AlertDescription>Only an administrator can approve supplier registrations.</AlertDescription>
            </Alert>
          )}

          {review.data?.duplicate_reason && (
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="font-medium">Requester's reason for submitting despite a possible duplicate</p>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{review.data.duplicate_reason}</p>
            </div>
          )}

          {review.data && duplicates.length === 0 && (
            <p className="text-muted-foreground">
              No existing supplier matches. Approving creates a new supplier with the contact and bank details from the
              registration and adds it to this company's suppliers.
            </p>
          )}

          {duplicates.length > 0 && (
            <>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="space-y-3">
                  <p className="font-medium">This registration matches:</p>
                  <DuplicateMatchList matches={duplicates} />
                </AlertDescription>
              </Alert>

              <RadioGroup value={choice ?? undefined} onValueChange={setChoice} className="space-y-2">
                {supplierMatches.map((m) => (
                  <div key={m.id} className="flex items-start gap-2">
                    <RadioGroupItem value={m.id} id={`link-${m.id}`} className="mt-0.5" />
                    <Label htmlFor={`link-${m.id}`} className="font-normal leading-snug">
                      <span className="font-medium">Link to {m.code} {m.name}</span>
                      <span className="block text-muted-foreground">
                        {m.in_company ? "Already one of this company's suppliers; no new record." : "Adds the existing supplier to this company; no new record."}
                      </span>
                    </Label>
                  </div>
                ))}
                <div className="flex items-start gap-2">
                  <RadioGroupItem value={NEW_SUPPLIER} id="create-new" disabled={!!taxMatch} className="mt-0.5" />
                  <Label htmlFor="create-new" className="font-normal leading-snug">
                    <span className="font-medium">Create a new supplier</span>
                    <span className="block text-muted-foreground">
                      {taxMatch
                        ? `Not possible: tax ID ${data.tax_id} is already on file for ${taxMatch.code} ${taxMatch.name}.`
                        : "Only if this really is a different supplier."}
                    </span>
                  </Label>
                </div>
              </RadioGroup>

              {needsReason && (
                <div className="space-y-1.5">
                  <Label htmlFor="approve-duplicate-reason">Why is this a different supplier? *</Label>
                  <Textarea
                    id="approve-duplicate-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                  />
                </div>
              )}
            </>
          )}

          {bank && (
            <p className="flex items-start gap-2 text-muted-foreground">
              <Landmark className="mt-0.5 h-4 w-4 shrink-0" />
              {linking
                ? `The bank details on the application (${bank}) are not copied to an existing supplier. Check them with the supplier before changing its bank record.`
                : `Bank details (${bank}) are copied to the new supplier's bank record.`}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="approve-notes">Approval notes</Label>
            <Textarea id="approve-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!canConfirm}>
            {linking ? "Approve and link" : "Approve and create supplier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
