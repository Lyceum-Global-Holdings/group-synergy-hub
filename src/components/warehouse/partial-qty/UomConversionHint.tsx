import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

interface Props {
  selectedUom: string | null | undefined;
  baseUom: string | null | undefined;
  secondaryUom?: string | null;
  trackSecondary?: boolean;
}

/**
 * Echoes the relationship between the selected size UOM and the parent
 * item's base UOM. Mirrors SAP MM / Oracle Inventory dialog convention
 * where the alternate UOM is always shown next to the entered one.
 *
 * Conversion factors are NOT shown — per dual-quantity-tracking memory,
 * conversions are captured per-receipt (variable per cut), not fixed.
 */
export function UomConversionHint({ selectedUom, baseUom, secondaryUom, trackSecondary }: Props) {
  const sel = (selectedUom ?? "").trim();
  const base = (baseUom ?? "").trim();
  const sec = (secondaryUom ?? "").trim();

  if (!sel || !base) return null;

  if (sel === base) {
    return (
      <p className="text-xs text-success flex items-center gap-1 mt-1">
        <CheckCircle2 className="h-3 w-3" />
        Matches base UOM (1 {sel} = 1 {base}) — used for valuation &amp; FIFO
      </p>
    );
  }

  if (trackSecondary && sec && sel === sec) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
        <Info className="h-3 w-3" />
        Per-receipt conversion to base UOM ({base}). Captured per GRN — varies by cut.
      </p>
    );
  }

  return (
    <p className="text-xs text-warning flex items-center gap-1 mt-1">
      <AlertTriangle className="h-3 w-3" />
      Not the item's base ({base}){sec ? ` or tracked secondary (${sec})` : ""}. Confirm this is correct.
    </p>
  );
}
