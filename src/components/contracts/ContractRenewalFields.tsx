import type { Control } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RENEWAL_POLICIES, contractTermMonths, type RenewalPolicy } from "@/lib/contractRenewal";

export function ContractRenewalFields({
  control,
  effectiveDate,
  expiryDate,
}: {
  control: Control<any>;
  effectiveDate?: string;
  expiryDate?: string;
}) {
  const policy = useWatch({ control, name: "renewal_policy" }) as RenewalPolicy;
  const hint = RENEWAL_POLICIES.find((p) => p.value === policy)?.hint;
  const currentTerm = effectiveDate && expiryDate && expiryDate >= effectiveDate ? contractTermMonths(effectiveDate, expiryDate) : null;

  return (
    <div className="col-span-2 space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-semibold">Expiry and renewal</h3>
        <p className="text-xs text-muted-foreground">Checked every night. Owners are emailed before the expiry date.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name="renewal_policy"
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>When it expires</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger aria-label="When it expires">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {RENEWAL_POLICIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hint && <FormDescription>{hint}</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />
        {policy === "auto" && (
          <>
            <FormField
              control={control}
              name="renewal_term_months"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Renew for (months)</FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" placeholder={currentTerm ? `Same as now: ${currentTerm}` : "Same as the current term"} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="max_renewal_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Renew at most (times)</FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" placeholder="No limit" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
        <FormField
          control={control}
          name="renewal_notice_days"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Remind the owner (days before)</FormLabel>
              <FormControl>
                <Input inputMode="numeric" placeholder="30" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
