import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function GLSettingsTab() {
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
              <Select defaultValue="LKR">
                <SelectTrigger id="base_currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LKR">LKR - Sri Lankan Rupee</SelectItem>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="decimal_places">Decimal Places</Label>
              <Select defaultValue="2">
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
              defaultValue="JE-YYYYMMDD-###"
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
            <Switch />
          </div>

          <div className="space-y-2">
            <Label htmlFor="approval_threshold">Approval Threshold Amount</Label>
            <Input
              id="approval_threshold"
              type="number"
              defaultValue="10000"
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
            <Switch />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button>Save Settings</Button>
        </div>
      </Card>
    </div>
  );
}
