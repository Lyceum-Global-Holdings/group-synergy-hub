import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Copy, Check } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { buildBinQRPayload } from '@/utils/binQRPayload';
import type { BinAllocationWithDetails } from '@/types/warehouseReservation';

interface Props {
  allocation: BinAllocationWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BinAllocationQRDialog({ allocation, open, onOpenChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const payload = allocation
    ? buildBinQRPayload({
        allocationId: allocation.id,
        itemCode: allocation.warehouse_item?.item_code,
        binCode: allocation.warehouse_bin?.bin_code,
        locationCode: allocation.warehouse_bin?.warehouse_location?.location_code,
      })
    : '';

  useEffect(() => {
    if (!open || !allocation) return;
    QRCode.toDataURL(payload, { width: 320, margin: 2, errorCorrectionLevel: 'M' })
      .then(setDataUrl)
      .catch(() => toast.error('Failed to generate QR code'));
  }, [open, allocation, payload]);

  const handleDownload = async () => {
    if (!allocation) return;
    try {
      // Compose a 2"x1" landscape label @ 300dpi (600x300 px): QR on left, text on right.
      const W = 600, H = 300, PAD = 12, QR_SIZE = 276;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      const qrPng = await QRCode.toDataURL(payload, {
        width: QR_SIZE,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('qr load failed'));
        img.src = qrPng;
      });
      ctx.drawImage(img, PAD, PAD, QR_SIZE, QR_SIZE);

      const textX = PAD + QR_SIZE + 16;
      const itemCode = allocation.warehouse_item?.item_code ?? '—';
      const itemName = allocation.warehouse_item?.name ?? '';
      const binName =
        allocation.warehouse_bin?.name ||
        allocation.warehouse_bin?.bin_code ||
        '—';

      ctx.fillStyle = '#000000';
      ctx.textBaseline = 'top';

      ctx.font = 'bold 28px "Courier New", monospace';
      ctx.fillText(truncateForCanvas(ctx, itemCode, W - textX - PAD), textX, 96);

      ctx.font = '20px Helvetica, Arial, sans-serif';
      ctx.fillText(truncateForCanvas(ctx, itemName, W - textX - PAD), textX, 138);

      ctx.font = '20px Helvetica, Arial, sans-serif';
      ctx.fillText(
        truncateForCanvas(ctx, `Bin: ${binName}`, W - textX - PAD),
        textX,
        178,
      );

      const labelUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = labelUrl;
      link.download = `bin-qr-${allocation.warehouse_item?.item_code || allocation.id}-${
        allocation.warehouse_bin?.bin_code || ''
      }.png`;
      link.click();
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate QR label');
    }
  };

  function truncateForCanvas(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxWidth) {
      s = s.slice(0, -1);
    }
    return s + '…';
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bin Allocation QR Code</DialogTitle>
          <DialogDescription>
            ISO/IEC 18004 QR · GS1 Digital Link payload. Scan with any camera app.
          </DialogDescription>
        </DialogHeader>

        {allocation && (
          <div className="space-y-4">
            <div className="flex justify-center bg-white rounded-md p-4 border">
              {dataUrl ? (
                <img src={dataUrl} alt="QR code" className="w-64 h-64" />
              ) : (
                <div className="w-64 h-64 animate-pulse bg-muted" />
              )}
            </div>

            <div className="text-sm space-y-1">
              <div><span className="text-muted-foreground">Item:</span> {allocation.warehouse_item?.item_code} — {allocation.warehouse_item?.name}</div>
              <div><span className="text-muted-foreground">Bin:</span> {allocation.warehouse_bin?.bin_code} ({allocation.warehouse_bin?.name})</div>
              <div><span className="text-muted-foreground">Location:</span> {allocation.warehouse_bin?.warehouse_location?.name ?? '—'}</div>
              <div><span className="text-muted-foreground">Qty:</span> {allocation.allocated_quantity}</div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleDownload} className="flex-1">
                <Download className="h-4 w-4 mr-2" /> Download PNG
              </Button>
              <Button onClick={handleCopy} variant="outline">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
