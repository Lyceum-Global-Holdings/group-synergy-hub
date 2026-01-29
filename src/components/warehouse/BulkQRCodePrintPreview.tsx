import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Printer, Loader2, X } from "lucide-react";
import { generateAllLabelDataUrls, AssetForPrint } from "@/utils/printQRCodeLabels";

interface BulkQRCodePrintPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: AssetForPrint[];
}

export function BulkQRCodePrintPreview({ open, onOpenChange, assets }: BulkQRCodePrintPreviewProps) {
  const [labelDataUrls, setLabelDataUrls] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (open && assets.length > 0) {
      generateLabels();
    }
  }, [open, assets]);

  const generateLabels = async () => {
    setIsGenerating(true);
    try {
      const dataUrls = await generateAllLabelDataUrls(assets);
      setLabelDataUrls(dataUrls);
    } catch (error) {
      console.error("Error generating labels:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-0 overflow-hidden print:p-0 print:m-0">
        {/* Print Controls - Hidden during print */}
        <div className="print:hidden bg-background border-b p-4 flex items-center justify-between">
          <DialogHeader className="space-y-0">
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Print QR Code Labels
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              disabled={isGenerating || labelDataUrls.length === 0}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Printer className="mr-2 h-4 w-4" />
                  Print ({assets.length} labels)
                </>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Print Area */}
        <div className="overflow-auto flex-1 p-6 print:p-0 print:overflow-visible">
          {isGenerating ? (
            <div className="flex items-center justify-center h-64 print:hidden">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">Generating {assets.length} labels...</p>
              </div>
            </div>
          ) : (
            <div className="qr-label-grid">
              {labelDataUrls.map((dataUrl, index) => (
                <div key={index} className="qr-label-item">
                  <img
                    src={dataUrl}
                    alt={`QR Label ${index + 1}`}
                    className="w-full h-full object-contain"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Print-specific styles */}
        <style>{`
          @media print {
            /* Hide everything except print content */
            body > *:not(.print-root) {
              display: none !important;
            }
            
            /* Reset dialog styles for print */
            [role="dialog"] {
              position: static !important;
              transform: none !important;
              width: 100% !important;
              height: auto !important;
              max-width: none !important;
              max-height: none !important;
              border: none !important;
              box-shadow: none !important;
              background: white !important;
            }
            
            /* Label grid layout for print */
            .qr-label-grid {
              display: grid;
              grid-template-columns: repeat(2, 2in);
              gap: 0.25in;
              padding: 0.5in;
              justify-content: center;
            }
            
            .qr-label-item {
              width: 2in;
              height: 1in;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            
            .qr-label-item img {
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
          }
          
          /* Screen styles for preview */
          @media screen {
            .qr-label-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
              gap: 1rem;
              max-width: 1200px;
              margin: 0 auto;
            }
            
            .qr-label-item {
              border: 1px solid hsl(var(--border));
              border-radius: 0.5rem;
              overflow: hidden;
              aspect-ratio: 2 / 1;
            }
            
            .qr-label-item img {
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
