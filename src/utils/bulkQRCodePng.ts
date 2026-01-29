import QRCode from "qrcode";
import JSZip from "jszip";

export interface AssetForQR {
  id: string;
  name: string;
  asset_id?: string | null;
}

const LABEL_WIDTH = 600; // 2 inches at 300 DPI
const LABEL_HEIGHT = 300; // 1 inch at 300 DPI
const QR_SIZE = 280;
const PADDING = 10;

// Hardcoded base URL for public asset access
const BASE_URL = "https://group-synergy-hub.lovable.app";

function splitAssetId(assetId: string): { categoryPath: string; idNumber: string } {
  const parts = assetId.split("/");
  if (parts.length <= 1) {
    return { categoryPath: "", idNumber: assetId };
  }
  const idNumber = parts[parts.length - 1];
  const categoryPath = parts.slice(0, -1).join("/");
  return { categoryPath, idNumber };
}

async function generateSinglePngLabel(asset: AssetForQR): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = LABEL_WIDTH;
  canvas.height = LABEL_HEIGHT;
  const ctx = canvas.getContext("2d")!;

  // White background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, LABEL_WIDTH, LABEL_HEIGHT);

  // Light gray border
  ctx.strokeStyle = "#E5E7EB";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, LABEL_WIDTH - 2, LABEL_HEIGHT - 2);

  // Generate QR code
  const qrUrl = `${BASE_URL}/asset/${asset.id}`;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: QR_SIZE,
    margin: 0,
    errorCorrectionLevel: "M",
  });

  // Draw QR code on left side
  const qrImage = new Image();
  await new Promise<void>((resolve) => {
    qrImage.onload = () => resolve();
    qrImage.src = qrDataUrl;
  });
  ctx.drawImage(qrImage, PADDING, PADDING, QR_SIZE, QR_SIZE);

  // Draw text on right side
  const textX = PADDING + QR_SIZE + 20;
  const textMaxWidth = LABEL_WIDTH - textX - PADDING;

  ctx.fillStyle = "#000000";
  ctx.textAlign = "left";

  if (asset.asset_id) {
    const { categoryPath, idNumber } = splitAssetId(asset.asset_id);

    // Category path (smaller font)
    if (categoryPath) {
      ctx.font = "bold 28px Arial";
      ctx.fillText(categoryPath, textX, 80, textMaxWidth);
    }

    // ID number (larger font)
    ctx.font = "bold 48px Arial";
    ctx.fillText(idNumber, textX, 140, textMaxWidth);

    // Asset name (smaller font)
    ctx.font = "20px Arial";
    ctx.fillStyle = "#6B7280";
    const truncatedName = asset.name.length > 25 ? asset.name.substring(0, 22) + "..." : asset.name;
    ctx.fillText(truncatedName, textX, 180, textMaxWidth);
  } else {
    // No asset ID - just show name
    ctx.font = "bold 32px Arial";
    const truncatedName = asset.name.length > 20 ? asset.name.substring(0, 17) + "..." : asset.name;
    ctx.fillText(truncatedName, textX, 120, textMaxWidth);
  }

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob!);
    }, "image/png");
  });
}

export async function generateBulkQRCodePngZip(assets: AssetForQR[]): Promise<Blob> {
  const zip = new JSZip();

  for (const asset of assets) {
    const pngBlob = await generateSinglePngLabel(asset);
    const filename = asset.asset_id
      ? `qr-${asset.asset_id.replace(/\//g, "_")}.png`
      : `qr-${asset.id.substring(0, 8)}.png`;
    zip.file(filename, pngBlob);
  }

  return zip.generateAsync({ type: "blob" });
}

export function downloadBulkQRCodePngZip(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().split("T")[0];
  link.href = url;
  link.download = `asset-qr-codes-${date}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
