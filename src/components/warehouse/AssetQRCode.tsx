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

  const publicUrl = `${window.location.origin}/asset/${assetId}`;

  const generateQRCode = async () => {
    if (!publicUrl || !assetId) {
      toast.error('Invalid asset information');
      return;
    }

    setIsLoading(true);
    setIsGenerated(false);
    
    try {
      // Generate QR code as data URL first (no canvas dependency)
      const dataUrl = await QRCode.toDataURL(publicUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
      
      setQrCodeUrl(dataUrl);
      setIsGenerated(true);
      
      // Also update canvas for consistency (if available)
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.width = 256;
            canvas.height = 256;
            ctx.drawImage(img, 0, 0);
          };
          img.src = dataUrl;
        }
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
      const fileName = assetIdentifier 
        ? `asset-qr-${assetIdentifier.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`
        : `asset-qr-${assetName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
      link.download = fileName;
      link.href = qrCodeUrl;
      link.click();
      toast.success('QR code downloaded');
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
      <DialogContent className="sm:max-w-md">
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
              <div className="w-full max-w-64 aspect-square flex items-center justify-center bg-muted rounded-lg border">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="text-sm text-muted-foreground">Generating QR code...</p>
                  </div>
                ) : isGenerated && qrCodeUrl ? (
                  <div className="p-3 bg-background rounded-lg border space-y-3">
                    <img 
                      src={qrCodeUrl} 
                      alt={`QR Code for ${assetName}`}
                      className="w-full h-auto max-w-56 rounded"
                    />
                    {assetIdentifier && (
                      <div className="text-center py-2 px-3 bg-muted/50 rounded-md border">
                        <span className="text-sm font-mono font-semibold tracking-wide">
                          {assetIdentifier}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground px-4">Click to generate QR code</p>
                )}
                {/* Hidden canvas for download functionality */}
                <canvas
                  ref={canvasRef}
                  className="hidden"
                  width={256}
                  height={256}
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