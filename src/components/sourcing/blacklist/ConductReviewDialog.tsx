import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { useBlacklistReviews } from "@/hooks/useBlacklistReviews";
import { Calendar } from "lucide-react";
import type { ReviewDecision } from "@/types/supplierRisk";

interface ConductReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blacklistEntry: any;
}

export function ConductReviewDialog({ open, onOpenChange, blacklistEntry }: ConductReviewDialogProps) {
  const { createReview } = useBlacklistReviews();
  const [decision, setDecision] = useState<ReviewDecision>("maintain");
  const [recommendation, setRecommendation] = useState("");
  const [nextReviewDate, setNextReviewDate] = useState("");

  const handleSubmit = async () => {
    if (!recommendation) return;

    await createReview.mutateAsync({
      blacklist_id: blacklistEntry.id,
      decision,
      recommendation,
      next_review_date: nextReviewDate || undefined,
    });

    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setDecision("maintain");
    setRecommendation("");
    setNextReviewDate("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conduct Blacklist Review</DialogTitle>
          <DialogDescription>
            Review and make a decision about {blacklistEntry?.suppliers?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm"><strong>Supplier:</strong> {blacklistEntry?.suppliers?.name}</p>
            <p className="text-sm mt-1"><strong>Current Status:</strong> {blacklistEntry?.status}</p>
            <p className="text-sm mt-1"><strong>Blacklist Reason:</strong> {blacklistEntry?.blacklist_reason}</p>
          </div>

          <div className="space-y-3">
            <Label>Review Decision *</Label>
            <RadioGroup value={decision} onValueChange={(value: ReviewDecision) => setDecision(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="maintain" id="maintain" />
                <Label htmlFor="maintain" className="font-normal cursor-pointer">
                  Maintain Blacklist - Keep current status
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="clear" id="clear" />
                <Label htmlFor="clear" className="font-normal cursor-pointer">
                  Clear Supplier - Remove from blacklist
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="escalate" id="escalate" />
                <Label htmlFor="escalate" className="font-normal cursor-pointer">
                  Escalate - Requires higher level review
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recommendation">Review Recommendation *</Label>
            <Textarea
              id="recommendation"
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              placeholder="Provide your recommendation and reasoning..."
              rows={4}
            />
          </div>

          {decision === "maintain" && (
            <div className="space-y-2">
              <Label htmlFor="next-review">Next Review Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="next-review"
                  type="date"
                  value={nextReviewDate}
                  onChange={(e) => setNextReviewDate(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!recommendation || createReview.isPending}
          >
            {createReview.isPending ? "Submitting..." : "Submit Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
