import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AssetRequestWithItems } from "@/types/assetRequest";

interface AssetRequestDetailsDialogProps {
  request: AssetRequestWithItems;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AssetRequestDetailsDialog = ({ request, open, onOpenChange }: AssetRequestDetailsDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Request Details: {request.request_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground">Component under construction...</p>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
