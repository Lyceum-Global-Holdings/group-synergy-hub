import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QTY_MIN, QTY_STEP } from "@/lib/quantityInput";
import { avgPerPiece } from "@/lib/dualQuantity";

interface DualQuantityInputProps {
  baseValue: string;
  secondaryValue: string;
  onBaseChange: (v: string) => void;
  onSecondaryChange: (v: string) => void;
  baseUom?: string | null;
  secondaryUom?: string | null;
  baseLabel?: string;
  secondaryLabel?: string;
  required?: boolean;
  disabled?: boolean;
  /** Hide the avg-per-piece helper line. */
  hideAvg?: boolean;
}

/**
 * Side-by-side base + secondary quantity inputs. Use whenever an item
 * has `track_secondary_quantity = true`. The component is purely
 * presentational; persistence stays in the calling form.
 */
export function DualQuantityInput({
  baseValue,
  secondaryValue,
  onBaseChange,
  onSecondaryChange,
  baseUom,
  secondaryUom,
  baseLabel = "Quantity",
  secondaryLabel = "Pieces",
  required,
  disabled,
  hideAvg,
}: DualQuantityInputProps) {
  const avg = avgPerPiece(baseValue, secondaryValue);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">
            {baseLabel}
            {baseUom ? ` (${baseUom})` : ""}
            {required ? " *" : ""}
          </Label>
          <Input
            type="number"
            inputMode="decimal"
            step={QTY_STEP}
            min={QTY_MIN}
            value={baseValue}
            onChange={(e) => onBaseChange(e.target.value)}
            required={required}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">
            {secondaryLabel}
            {secondaryUom ? ` (${secondaryUom})` : ""}
          </Label>
          <Input
            type="number"
            inputMode="decimal"
            step={QTY_STEP}
            min={QTY_MIN}
            value={secondaryValue}
            onChange={(e) => onSecondaryChange(e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
      {!hideAvg && avg !== null && (
        <p className="text-xs text-muted-foreground">
          Avg {avg.toFixed(3)} {baseUom ?? ""} per {secondaryUom ?? "piece"}
        </p>
      )}
    </div>
  );
}
