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

  const handleDownload = () => {
    if (!dataUrl || !allocation) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `bin-qr-${allocation.warehouse_item?.item_code || allocation.id}-${
      allocation.warehouse_bin?.bin_code || ''
    }.png`;
    link.click();
  };

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
