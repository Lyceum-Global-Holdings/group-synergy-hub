import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Loader2, QrCode, CheckCircle, FileImage, FileText } from "lucide-react";
import { generateBulkQRCodePdf, downloadBulkQRCodePdf, AssetForQR } from "@/utils/bulkQRCodePdf";
import { generateBulkQRCodePngZip, downloadBulkQRCodePngZip } from "@/utils/bulkQRCodePng";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface BulkQRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: AssetForQR[];
}

type DownloadFormat = "pdf" | "png";

export function BulkQRCodeDialog({ open, onOpenChange, assets }: BulkQRCodeDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [format, setFormat] = useState<DownloadFormat>("pdf");
  const { toast } = useToast();

  const handleDownload = async () => {
    if (assets.length === 0) return;

    setIsGenerating(true);
    try {
      if (format === "pdf") {
        const blob = await generateBulkQRCodePdf(assets);
        downloadBulkQRCodePdf(blob);
        toast({
          title: "Success",
          description: `Downloaded QR codes PDF for ${assets.length} assets`,
        });
      } else {
        const blob = await generateBulkQRCodePngZip(assets);
        downloadBulkQRCodePngZip(blob);
        toast({
          title: "Success",
          description: `Downloaded QR codes ZIP with ${assets.length} PNG files`,
        });
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Error generating QR codes:', error);
      toast({
        title: "Error",
        description: `Failed to generate QR code ${format === "pdf" ? "PDF" : "ZIP"}`,
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
            Download all QR codes for printing labels.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Asset Preview */}
          <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Assets to include:
            </p>
            <ul className="space-y-1">
              {assets.slice(0, 10).map((asset) => (
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

          {/* Format Selection */}
          <div className="border rounded-lg p-4">
            <p className="text-sm font-medium mb-3">Download Format:</p>
            <RadioGroup
              value={format}
              onValueChange={(value) => setFormat(value as DownloadFormat)}
              className="space-y-3"
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem value="pdf" id="pdf" className="mt-0.5" />
                <Label htmlFor="pdf" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-destructive" />
                    <span className="font-medium">PDF Document</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Multi-page PDF with one 2×1 inch label per page. Best for direct printing.
                  </p>
                </Label>
              </div>
              <div className="flex items-start gap-3">
                <RadioGroupItem value="png" id="png" className="mt-0.5" />
                <Label htmlFor="png" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <FileImage className="h-4 w-4 text-primary" />
                    <span className="font-medium">PNG Images (ZIP)</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Individual 600×300px PNG files in a ZIP archive. Best for custom label software.
                  </p>
                </Label>
              </div>
            </RadioGroup>
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
                  Download {format === "pdf" ? "PDF" : "ZIP"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
