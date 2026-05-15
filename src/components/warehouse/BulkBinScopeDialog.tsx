import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useCompanies } from '@/hooks/useCompanies';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { buildLocationOptions, locationTypeLabel } from '@/lib/warehouse/locationHierarchy';
import { useBulkBinScope } from '@/hooks/warehouse/useBulkBinScope';
import { WarehouseBin } from '@/types/itemBin';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bins: WarehouseBin[];
}

export function BulkBinScopeDialog({ open, onOpenChange, bins }: Props) {
  const { companies = [] } = useCompanies();
  const { data: locations = [] } = useWarehouseLocations();
  const { mutateAsync, isPending } = useBulkBinScope();

  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [mode, setMode] = useState<'clone' | 'replace'>('clone');
  const [global, setGlobal] = useState(false);

  const locationOptions = useMemo(() => buildLocationOptions(locations, { activeOnly: true }), [locations]);

  const reset = () => {
    setCompanyIds([]);
    setLocationIds([]);
    setMode('clone');
    setGlobal(false);
  };

  const totalNew = bins.length * companyIds.length * locationIds.length;
  const canSubmit = bins.length > 0 && companyIds.length > 0 && locationIds.length > 0 && !isPending;

  const handleSubmit = async () => {
    await mutateAsync({
      binIds: bins.map((b) => b.id),
      companyIds,
      locationIds,
      mode,
      global: global || companyIds.length > 1,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Change bin scope ({bins.length} bin{bins.length === 1 ? '' : 's'})</DialogTitle>
          <DialogDescription>
            Replicate the selected bins across multiple companies and warehouse locations / sub-locations.
            Each (bin code · company · location) tuple becomes one storage bin row, following SAP EWM / GS1
            storage-bin semantics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Source bins</Label>
            <div className="flex flex-wrap gap-1 mt-2">
              {bins.map((b) => (
                <Badge key={b.id} variant="secondary">{b.bin_code}</Badge>
              ))}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Target companies</Label>
              <ScrollArea className="h-48 mt-2 border rounded-md p-2">
                <div className="space-y-2">
                  {companies.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`c-${c.id}`}
                        checked={companyIds.includes(c.id)}
                        onCheckedChange={(v) =>
                          setCompanyIds((prev) =>
                            v ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                          )
                        }
                      />
                      <Label htmlFor={`c-${c.id}`} className="text-sm font-normal cursor-pointer">
                        {c.name}
                      </Label>
                    </div>
                  ))}
                  {companies.length === 0 && (
                    <p className="text-xs text-muted-foreground">No companies available.</p>
                  )}
                </div>
              </ScrollArea>
            </div>

            <div>
              <Label className="text-sm font-medium">Target locations</Label>
              <ScrollArea className="h-48 mt-2 border rounded-md p-2">
                <div className="space-y-1">
                  {locationOptions.map((opt) => (
                    <div
                      key={opt.location.id}
                      className="flex items-center gap-2"
                      style={{ paddingLeft: `${opt.depth * 16}px` }}
                    >
                      <Checkbox
                        id={`l-${opt.location.id}`}
                        checked={locationIds.includes(opt.location.id)}
                        onCheckedChange={(v) =>
                          setLocationIds((prev) =>
                            v ? [...prev, opt.location.id] : prev.filter((id) => id !== opt.location.id),
                          )
                        }
                      />
                      <Label
                        htmlFor={`l-${opt.location.id}`}
                        className="text-sm font-normal cursor-pointer flex items-center gap-2"
                      >
                        <span>{opt.location.name}</span>
                        <Badge variant="outline" className="text-[10px] py-0">
                          {locationTypeLabel(opt.location.type)}
                        </Badge>
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-sm font-medium">Mode</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'clone' | 'replace')}>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="clone" id="m-clone" className="mt-1" />
                <Label htmlFor="m-clone" className="font-normal cursor-pointer">
                  <span className="font-medium">Clone</span> — add bins for missing (company, location) tuples; keep all existing rows.
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="replace" id="m-replace" className="mt-1" />
                <Label htmlFor="m-replace" className="font-normal cursor-pointer">
                  <span className="font-medium">Replace</span> — also remove the same bin codes from scopes outside the selected set (rows with stock are skipped).
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="m-global"
              checked={global || companyIds.length > 1}
              disabled={companyIds.length > 1}
              onCheckedChange={(v) => setGlobal(!!v)}
            />
            <Label htmlFor="m-global" className="text-sm font-normal cursor-pointer">
              Mark as global template (auto-enabled when targeting more than one company)
            </Label>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Up to <strong>{totalNew}</strong> bin row{totalNew === 1 ? '' : 's'} will be evaluated. Existing
              (bin · company · location) rows are skipped automatically.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isPending ? 'Applying…' : 'Apply scope change'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
