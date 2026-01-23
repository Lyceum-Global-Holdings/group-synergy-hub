import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { QrCode, Download, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';

interface AssetQRCodeProps {
  assetId: string;
  assetName: string;
  assetIdentifier?: string;
}

export default function AssetQRCode({ assetId, assetName, assetIdentifier }: AssetQRCodeProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Use the published URL so QR codes work publicly without Lovable login
  const PUBLISHED_APP_URL = 'https://group-synergy-hub.lovable.app';
  const publicUrl = `${PUBLISHED_APP_URL}/asset/${assetId}`;

  const generateQRCode = async () => {
    if (!publicUrl || !assetId) {
      toast.error('Invalid asset information');
      return;
    }

    setIsLoading(true);
    setIsGenerated(false);
    
    try {
      // 2x1 inch label at 300 DPI for print quality
      const DPI = 300;
      const labelWidth = 2 * DPI;   // 600 pixels (2 inches)
      const labelHeight = 1 * DPI;  // 300 pixels (1 inch)
      const padding = 10;
      const qrSize = labelHeight - (padding * 2); // 280px square QR code

      // Generate QR code at print quality
      const qrDataUrl = await QRCode.toDataURL(publicUrl, {
        width: qrSize,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });

      // Create canvas for 2x1 inch horizontal label
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const label = assetIdentifier || assetId;
          
          // Set canvas to 2x1 inch at 300 DPI
          canvas.width = labelWidth;
          canvas.height = labelHeight;
          
          // Fill white background
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Draw border for cutting guide
          ctx.strokeStyle = '#E5E7EB';
          ctx.lineWidth = 2;
          ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
          
          // Draw QR code on LEFT side
          const qrImg = new Image();
          qrImg.onload = () => {
            ctx.drawImage(qrImg, padding, padding, qrSize, qrSize);
            
            // Draw asset ID on RIGHT side - split category path from number
            if (label) {
              const textX = qrSize + padding + 20;
              
              const labelParts = label.split('/');
              
              if (labelParts.length > 1) {
                // Category path (e.g., FUR/CHA/CH)
                const categoryPath = labelParts.slice(0, -1).join('/');
                // Number (e.g., 000468)
                const number = labelParts[labelParts.length - 1];
                
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                
                // Draw category path on line 1
                ctx.font = 'bold 28px monospace';
                ctx.fillText(categoryPath, textX, labelHeight * 0.35);
                
                // Draw number on line 2
                ctx.font = 'bold 32px monospace';
                ctx.fillText(number, textX, labelHeight * 0.65);
              } else {
                // Single part - display centered
                ctx.font = 'bold 32px monospace';
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, textX, labelHeight / 2);
              }
            }
            
            // Convert canvas to data URL
            const finalDataUrl = canvas.toDataURL('image/png');
            setQrCodeUrl(finalDataUrl);
            setIsGenerated(true);
          };
          qrImg.src = qrDataUrl;
        }
      } else {
        // Fallback if canvas is not available
        setQrCodeUrl(qrDataUrl);
        setIsGenerated(true);
      }
      
      console.log('QR code generated successfully for:', publicUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error(`Failed to generate QR code: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsGenerated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadQRCode = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a');
      const label = assetIdentifier || assetId;
      const sanitized = label.replace(/[^a-z0-9\-]/gi, '_');
      const fileName = `qr-${sanitized}.png`;
      link.download = fileName;
      link.href = qrCodeUrl;
      link.click();
      toast.success(`QR code downloaded as ${fileName}`);
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success('URL copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy URL');
    }
  };

  return (
    <Dialog onOpenChange={(open) => {
      if (open && !isGenerated) {
        generateQRCode();
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <QrCode className="h-4 w-4 mr-2" />
          QR Code
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Asset QR Code</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan this QR code to view asset details without login
            </p>
            
            {/* QR Code Container */}
            <div className="flex justify-center">
              <div className="w-full max-w-80 flex items-center justify-center bg-muted rounded-lg border p-3">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="text-sm text-muted-foreground">Generating QR code...</p>
                  </div>
                ) : isGenerated && qrCodeUrl ? (
                  <div className="bg-background rounded-lg border">
                    <img 
                      src={qrCodeUrl} 
                      alt={`QR Code for ${assetName}${assetIdentifier ? ` - ${assetIdentifier}` : ''}`}
                      className="w-full h-auto rounded"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground px-4">Click to generate QR code</p>
                )}
                {/* Canvas for generating combined QR code + text */}
                <canvas
                  ref={canvasRef}
                  className="hidden"
                  width={600}
                  height={300}
                />
              </div>
            </div>
          </div>
          
          {/* Public URL Section */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Public URL:</p>
            <div className="flex items-stretch gap-2">
              <code className="flex-1 p-3 bg-muted rounded-md text-xs break-all leading-relaxed">
                {publicUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={copyUrl}
                className="shrink-0 h-auto px-3"
                title="Copy URL"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Download Button */}
          <div className="flex justify-center">
            <Button
              onClick={downloadQRCode}
              disabled={!qrCodeUrl}
              className="w-full max-w-xs"
              size="default"
            >
              <Download className="h-4 w-4 mr-2" />
              Download QR Code
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}