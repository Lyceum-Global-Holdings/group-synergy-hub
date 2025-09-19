import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { QrCode, Download, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';

interface AssetQRCodeProps {
  assetId: string;
  assetName: string;
}

export default function AssetQRCode({ assetId, assetName }: AssetQRCodeProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const publicUrl = `${window.location.origin}/asset/${assetId}`;

  const generateQRCode = async () => {
    if (!publicUrl || !assetId) {
      toast.error('Invalid asset information');
      return;
    }

    setIsLoading(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error('Canvas element not found');
      }

      // Clear any existing content
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      await QRCode.toCanvas(canvas, publicUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      setQrCodeUrl(dataUrl);
      
      console.log('QR code generated successfully for:', publicUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error(`Failed to generate QR code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadQRCode = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a');
      link.download = `asset-qr-${assetName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
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
      if (open && !qrCodeUrl) {
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
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Scan this QR code to view asset details without login
            </p>
            <div className="flex justify-center">
              {isLoading ? (
                <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-lg border">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="text-sm text-muted-foreground">Generating QR code...</p>
                  </div>
                </div>
              ) : qrCodeUrl ? (
                <div className="border rounded-lg p-2 bg-background">
                  <canvas
                    ref={canvasRef}
                    className="rounded"
                    style={{ maxWidth: '256px', maxHeight: '256px' }}
                  />
                </div>
              ) : (
                <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-lg border">
                  <p className="text-sm text-muted-foreground">Click to generate QR code</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm font-medium">Public URL:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-muted rounded text-xs truncate">
                {publicUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={copyUrl}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex gap-2 justify-center">
            <Button
              onClick={downloadQRCode}
              disabled={!qrCodeUrl}
              className="flex-1"
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