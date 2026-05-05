import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, AlertCircle, FileText } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import {
  SRN_FORMAT,
  checkSrnExists,
  useGenerateSrnNumber,
} from '@/hooks/useSrnNumber';

interface SrnNumberFieldProps {
  value: string;
  onChange: (value: string) => void;
  excludeId?: string;
  /** Auto-generate an SRN when the field becomes visible and is empty. */
  autoGenerateOnMount?: boolean;
  disabled?: boolean;
  /** When true (default), shows the descriptive helper text. */
  showHelperText?: boolean;
}

/**
 * Stores Requisition Note (SRN) number field.
 *
 * - Auto-generates a number in the format SRN-YYYY-NNNNNN per company.
 * - Allows manual override (e.g. for back-dated paper requisitions).
 * - Validates format and checks uniqueness against the database on blur.
 */
export function SrnNumberField({
  value,
  onChange,
  excludeId,
  autoGenerateOnMount = true,
  disabled,
  showHelperText = true,
}: SrnNumberFieldProps) {
  const { selectedCompany } = useCompany();
  const generate = useGenerateSrnNumber();
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Auto-generate the first time the dialog opens with an empty SRN.
  useEffect(() => {
    if (
      autoGenerateOnMount &&
      !value &&
      selectedCompany?.id &&
      !generate.isPending
    ) {
      generate.mutateAsync(selectedCompany.id).then((srn) => {
        onChange(srn);
        setMode('auto');
      }).catch(() => {/* surfaced via toast elsewhere if needed */});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany?.id]);

  const handleRegenerate = async () => {
    if (!selectedCompany?.id) return;
    const srn = await generate.mutateAsync(selectedCompany.id);
    onChange(srn);
    setMode('auto');
    setError(null);
  };

  const handleBlur = async () => {
    setError(null);
    if (!value) return;
    if (!SRN_FORMAT.test(value)) {
      setError('Format must be SRN-YYYY-NNNNNN');
      return;
    }
    if (!selectedCompany?.id) return;
    try {
      setChecking(true);
      const exists = await checkSrnExists(selectedCompany.id, value, excludeId);
      if (exists) setError('This SRN number already exists for this company');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor="srn_number" className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          SRN Number
          <span className="text-xs font-normal text-muted-foreground">
            (Stores Requisition Note)
          </span>
        </Label>
        <Badge variant={mode === 'auto' ? 'secondary' : 'outline'} className="text-[10px]">
          {mode === 'auto' ? 'Auto' : 'Manual'}
        </Badge>
      </div>
      <div className="flex gap-2">
        <Input
          id="srn_number"
          value={value}
          onChange={(e) => {
            onChange(e.target.value.toUpperCase());
            setMode('manual');
          }}
          onBlur={handleBlur}
          placeholder="SRN-YYYY-NNNNNN"
          disabled={disabled || generate.isPending}
          aria-invalid={!!error}
          className={error ? 'border-destructive' : ''}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleRegenerate}
          disabled={disabled || generate.isPending || !selectedCompany?.id}
          title="Regenerate SRN number"
        >
          <RefreshCw className={`h-4 w-4 ${generate.isPending ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
      {!error && showHelperText && (
        <p className="text-xs text-muted-foreground">
          {checking
            ? 'Checking availability…'
            : 'Auto-generated. Click the refresh icon to regenerate, or type to enter your own number.'}
        </p>
      )}
    </div>
  );
}
