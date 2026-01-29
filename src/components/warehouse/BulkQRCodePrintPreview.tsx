import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";
import { generateAllLabelDataUrls, AssetForPrint } from "@/utils/printQRCodeLabels";
import { useToast } from "@/hooks/use-toast";

interface BulkQRCodePrintPreviewProps {
  assets: AssetForPrint[];
  onComplete?: () => void;
}

export function openPrintWindow(labelDataUrls: string[]) {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  
  if (!printWindow) {
    throw new Error('Failed to open print window. Please allow popups for this site.');
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>QR Code Labels</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: Arial, sans-serif;
          background: #f5f5f5;
        }
        
        .controls {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: white;
          padding: 16px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 100;
        }
        
        .controls h1 {
          font-size: 18px;
          font-weight: 600;
        }
        
        .print-btn {
          background: #2563eb;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        }
        
        .print-btn:hover {
          background: #1d4ed8;
        }
        
        .label-container {
          padding: 80px 24px 24px;
          max-width: 1000px;
          margin: 0 auto;
        }
        
        .label-grid {
          display: grid;
          grid-template-columns: repeat(2, 2in);
          gap: 0.25in;
          justify-content: center;
        }
        
        .label-item {
          width: 2in;
          height: 1in;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
          background: white;
        }
        
        .label-item img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        
        @media print {
          .controls {
            display: none !important;
          }
          
          body {
            background: white;
          }
          
          .label-container {
            padding: 0.5in;
            max-width: none;
          }
          
          .label-grid {
            display: grid;
            grid-template-columns: repeat(2, 2in);
            gap: 0.25in;
            justify-content: center;
          }
          
          .label-item {
            width: 2in;
            height: 1in;
            page-break-inside: avoid;
            break-inside: avoid;
            border: 1px solid #e5e7eb;
          }
          
          .label-item img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
        }
      </style>
    </head>
    <body>
      <div class="controls">
        <h1>🏷️ QR Code Labels (${labelDataUrls.length})</h1>
        <button class="print-btn" onclick="window.print()">🖨️ Print Labels</button>
      </div>
      
      <div class="label-container">
        <div class="label-grid">
          ${labelDataUrls.map((url, i) => `
            <div class="label-item">
              <img src="${url}" alt="QR Label ${i + 1}" />
            </div>
          `).join('')}
        </div>
      </div>
      
      <script>
        // Auto-trigger print after a short delay to ensure images are loaded
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 500);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

export function BulkQRCodePrintButton({ assets, onComplete }: BulkQRCodePrintPreviewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handlePrint = async () => {
    if (assets.length === 0) return;

    setIsGenerating(true);
    try {
      const dataUrls = await generateAllLabelDataUrls(assets);
      openPrintWindow(dataUrls);
      onComplete?.();
    } catch (error) {
      console.error("Error generating labels:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate print labels",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={handlePrint}
      disabled={isGenerating || assets.length === 0}
    >
      {isGenerating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Printer className="mr-2 h-4 w-4" />
          Print Labels
        </>
      )}
    </Button>
  );
}

export function BulkQRCodePrintPreview({ 
  open, 
  onOpenChange, 
  assets 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  assets: AssetForPrint[]; 
}) {
  const { toast } = useToast();

  // When opened, immediately generate and open print window
  if (open && assets.length > 0) {
    generateAllLabelDataUrls(assets)
      .then((dataUrls) => {
        openPrintWindow(dataUrls);
        onOpenChange(false);
      })
      .catch((error) => {
        console.error("Error generating labels:", error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to generate print labels",
          variant: "destructive",
        });
        onOpenChange(false);
      });
  }

  // No UI needed - we open a new window instead
  return null;
}
