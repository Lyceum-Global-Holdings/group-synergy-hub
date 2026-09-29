import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useGLSettings } from "@/hooks/useGLSettings";
import { PostingAccountsCard } from "@/components/finance/PostingAccountsCard";
import { Loader2 } from "lucide-react";
import { CURRENCY_CONFIG } from "@/lib/utils";

export function GLSettingsTab() {
  const { glSettings, isLoading, updateGLSettings, isUpdating } = useGLSettings();
  
  const [baseCurrency, setBaseCurrency] = useState("LKR");
  const [decimalPlaces, setDecimalPlaces] = useState("2");
  const [jeNumberFormat, setJeNumberFormat] = useState("JE-YYYYMMDD-###");
  const [requireApproval, setRequireApproval] = useState(false);
  const [approvalThreshold, setApprovalThreshold] = useState("10000");
  const [allowClosedPeriods, setAllowClosedPeriods] = useState(false);

  useEffect(() => {
    if (glSettings) {
      setBaseCurrency(glSettings.base_currency);
      setDecimalPlaces(glSettings.decimal_places.toString());
      setJeNumberFormat(glSettings.je_number_format || "JE-YYYYMMDD-###");
      setRequireApproval(glSettings.require_je_approval);
      setApprovalThreshold(glSettings.approval_threshold_amount?.toString() || "10000");
      setAllowClosedPeriods(glSettings.allow_posting_to_closed_periods);
    }
  }, [glSettings]);

  const handleSave = () => {
    const currencyConfig = CURRENCY_CONFIG[baseCurrency];
    updateGLSettings({
      base_currency: baseCurrency,
      currency_symbol: currencyConfig?.symbol || 'Rs.',
      decimal_places: parseInt(decimalPlaces),
      je_number_format: jeNumberFormat,
      require_je_approval: requireApproval,
      approval_threshold_amount: parseFloat(approvalThreshold),
      allow_posting_to_closed_periods: allowClosedPeriods,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">General Ledger Settings</h2>
        <p className="text-muted-foreground mt-1">
          Configure general ledger preferences and defaults
        </p>
      </div>

      <Card className="p-6 space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">General Settings</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="base_currency">Base Currency</Label>
              <Select value={baseCurrency} onValueChange={setBaseCurrency}>
                <SelectTrigger id="base_currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(CURRENCY_CONFIG).map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name} ({currency.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="decimal_places">Decimal Places</Label>
              <Select value={decimalPlaces} onValueChange={setDecimalPlaces}>
                <SelectTrigger id="decimal_places">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="je_number_format">Journal Entry Number Format</Label>
            <Input
              id="je_number_format"
              value={jeNumberFormat}
              onChange={(e) => setJeNumberFormat(e.target.value)}
              placeholder="e.g., JE-YYYYMMDD-###"
            />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-lg font-semibold">Approval Settings</h3>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Require Journal Entry Approval</Label>
              <p className="text-sm text-muted-foreground">
                All journal entries must be approved before posting
              </p>
            </div>
            <Switch 
              checked={requireApproval}
              onCheckedChange={setRequireApproval}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="approval_threshold">Approval Threshold Amount</Label>
            <Input
              id="approval_threshold"
              type="number"
              value={approvalThreshold}
              onChange={(e) => setApprovalThreshold(e.target.value)}
              placeholder="Amount"
            />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-lg font-semibold">Period Settings</h3>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Allow Posting to Closed Periods</Label>
              <p className="text-sm text-muted-foreground">
                Administrators can post to closed periods
              </p>
            </div>
            <Switch 
              checked={allowClosedPeriods}
              onCheckedChange={setAllowClosedPeriods}
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={isUpdating}>
            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </div>
      </Card>

      <PostingAccountsCard />
    </div>
  );
}
