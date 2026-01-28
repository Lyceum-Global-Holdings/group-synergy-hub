import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Loader2, QrCode, CheckCircle } from "lucide-react";
import { generateBulkQRCodePdf, downloadBulkQRCodePdf, AssetForQR } from "@/utils/bulkQRCodePdf";
import { useToast } from "@/hooks/use-toast";

interface BulkQRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: AssetForQR[];
}

export function BulkQRCodeDialog({ open, onOpenChange, assets }: BulkQRCodeDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    if (assets.length === 0) return;

    setIsGenerating(true);
    try {
      const blob = await generateBulkQRCodePdf(assets);
      downloadBulkQRCodePdf(blob);
      toast({
        title: "Success",
        description: `Downloaded QR codes for ${assets.length} assets`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error generating QR code PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate QR code PDF",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-6 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            Assets Created Successfully
          </DialogTitle>
          <DialogDescription>
            {assets.length} asset{assets.length > 1 ? 's have' : ' has'} been created. 
            Download all QR codes as a PDF for printing labels.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Asset Preview */}
          <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Assets to include:
            </p>
            <ul className="space-y-1">
              {assets.slice(0, 10).map((asset, index) => (
                <li key={asset.id} className="text-sm flex items-center gap-2">
                  <QrCode className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate">{asset.name}</span>
                  {asset.asset_id && (
                    <span className="text-muted-foreground text-xs">
                      ({asset.asset_id})
                    </span>
                  )}
                </li>
              ))}
              {assets.length > 10 && (
                <li className="text-sm text-muted-foreground">
                  ... and {assets.length - 10} more
                </li>
              )}
            </ul>
          </div>

          {/* PDF Info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">
              <strong>PDF Format:</strong> Each page contains one 2×1 inch QR code label, 
              optimized for standard label printers.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Skip
            </Button>
            <Button
              onClick={handleDownload}
              disabled={isGenerating || assets.length === 0}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download All QR Codes
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
