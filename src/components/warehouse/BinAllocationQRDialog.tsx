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
      // 2"x1" landscape label @ 300dpi (600x300 px): QR on left, text on right.
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
      const textMaxW = W - textX - PAD;
      const itemCode = allocation.warehouse_item?.item_code ?? '—';
      const itemName = allocation.warehouse_item?.name ?? '';
      const binName =
        allocation.warehouse_bin?.name ||
        allocation.warehouse_bin?.bin_code ||
        '—';

      ctx.fillStyle = '#000000';
      ctx.textBaseline = 'top';

      type Block = { text: string; font: string; size: number; maxLines: number };
      const blocks: Block[] = [
        { text: itemCode, font: 'bold {SIZE}px "Courier New", monospace', size: 40, maxLines: 2 },
        { text: itemName, font: '{SIZE}px Helvetica, Arial, sans-serif', size: 28, maxLines: 2 },
        { text: binName,  font: 'bold {SIZE}px Helvetica, Arial, sans-serif', size: 22, maxLines: 1 },
      ];

      // Compute total height and shift to vertically center within the text column.
      const lineHeights = blocks.map(b => Math.round(b.size * 1.15));
      const blockGap = 8;
      const wrapped = blocks.map((b, i) => {
        ctx.font = b.font.replace('{SIZE}', String(b.size));
        return wrapLines(ctx, b.text, textMaxW, b.maxLines);
      });
      const totalH =
        wrapped.reduce((sum, lines, i) => sum + lines.length * lineHeights[i], 0) +
        blockGap * (blocks.length - 1);
      let y = Math.max(PAD, Math.round((H - totalH) / 2));

      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        ctx.font = b.font.replace('{SIZE}', String(b.size));
        for (const line of wrapped[i]) {
          ctx.fillText(line, textX, y);
          y += lineHeights[i];
        }
        y += blockGap;
      }

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

  function wrapLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxLines: number,
  ): string[] {
    if (!text) return [''];
    const words = text.split(/(\s+)/); // keep whitespace tokens
    const lines: string[] = [];
    let current = '';
    for (const w of words) {
      const candidate = current + w;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        if (current.trim()) lines.push(current.trimEnd());
        // word itself longer than line — hard-break by chars
        if (ctx.measureText(w).width > maxWidth) {
          let chunk = '';
          for (const ch of w) {
            if (ctx.measureText(chunk + ch).width <= maxWidth) chunk += ch;
            else { lines.push(chunk); chunk = ch; }
            if (lines.length >= maxLines) break;
          }
          current = chunk;
        } else {
          current = w.trimStart();
        }
        if (lines.length >= maxLines) break;
      }
    }
    if (current.trim() && lines.length < maxLines) lines.push(current.trimEnd());
    if (lines.length > maxLines) lines.length = maxLines;
    // Ellipsise last line if there's overflow text
    const joined = lines.join(' ').replace(/\s+/g, ' ').trim();
    const orig = text.replace(/\s+/g, ' ').trim();
    if (joined.length < orig.length && lines.length > 0) {
      const i = lines.length - 1;
      let last = lines[i];
      while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[i] = last + '…';
    }
    return lines;
  }

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
