import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Calendar, User, AlertCircle } from "lucide-react";

interface BlacklistDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blacklistEntry: any;
}

export function BlacklistDetailsDialog({ open, onOpenChange, blacklistEntry }: BlacklistDetailsDialogProps) {
  if (!blacklistEntry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Blacklist Entry Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Supplier Info */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Supplier Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Supplier Name</p>
                <p className="font-medium">{blacklistEntry.suppliers?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={blacklistEntry.status === 'blacklisted' ? 'destructive' : 'default'}>
                  {blacklistEntry.status}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Blacklist Details */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Blacklist Details</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Reason</p>
                <p className="text-sm">{blacklistEntry.blacklist_reason}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Blacklisted Date
                  </p>
                  <p className="text-sm">{format(new Date(blacklistEntry.blacklisted_date), "MMM d, yyyy")}</p>
                </div>
                {blacklistEntry.cleared_date && (
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Cleared Date
                    </p>
                    <p className="text-sm">{format(new Date(blacklistEntry.cleared_date), "MMM d, yyyy")}</p>
                  </div>
                )}
              </div>

              {blacklistEntry.clearing_reason && (
                <div>
                  <p className="text-sm text-muted-foreground">Clearing Reason</p>
                  <p className="text-sm">{blacklistEntry.clearing_reason}</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Review Info */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Review Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Permanent</p>
                <p className="text-sm">{blacklistEntry.permanent ? "Yes" : "No"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Review Required</p>
                <p className="text-sm">{blacklistEntry.review_required ? "Yes" : "No"}</p>
              </div>
              {blacklistEntry.review_required && (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Review Frequency</p>
                    <p className="text-sm">{blacklistEntry.review_frequency_days} days</p>
                  </div>
                  {blacklistEntry.next_review_date && (
                    <div>
                      <p className="text-sm text-muted-foreground">Next Review Date</p>
                      <p className="text-sm">{format(new Date(blacklistEntry.next_review_date), "MMM d, yyyy")}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Restrictions */}
          {blacklistEntry.restrictions && Object.keys(blacklistEntry.restrictions).length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Restrictions
                </h3>
                <pre className="text-sm bg-muted p-3 rounded">
                  {JSON.stringify(blacklistEntry.restrictions, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
