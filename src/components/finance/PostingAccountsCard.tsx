import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** The accounts automatic journals post to (see post_supplier_invoice and friends). */
export const POSTING_ACCOUNTS = [
  { key: "ap_control_account_id", label: "Accounts payable (control)", hint: "Supplier invoices are credited here; payments debit it.", type: "liability" },
  { key: "ar_control_account_id", label: "Accounts receivable (control)", hint: "Customer invoices are debited here; receipts credit it.", type: "asset" },
  { key: "purchases_account_id", label: "Purchases", hint: "Supplier invoice lines without their own account.", type: "expense" },
  { key: "sales_account_id", label: "Sales", hint: "Customer invoices without their own account.", type: "revenue" },
  { key: "input_tax_account_id", label: "Input tax (VAT recoverable)", hint: "Tax on supplier invoices.", type: "asset" },
  { key: "output_tax_account_id", label: "Output tax (VAT payable)", hint: "Tax on customer invoices.", type: "liability" },
  { key: "cash_account_id", label: "Cash / bank fallback", hint: "For bank accounts not linked to a GL account.", type: "asset", optional: true },
  { key: "inventory_account_id", label: "Inventory", hint: "Stock received is debited here; issues and losses credit it.", type: "asset", group: "stock" },
  { key: "grni_account_id", label: "Goods received not invoiced", hint: "Credited on receipt; cleared when the PO's supplier invoice is posted.", type: "liability", group: "stock" },
  { key: "material_consumption_account_id", label: "Materials consumed", hint: "Material issues are charged here; returns credit it.", type: "expense", group: "stock" },
  { key: "production_wip_account_id", label: "Production WIP", hint: "Production stage issues (else materials consumed).", type: "asset", group: "stock", optional: true },
  { key: "stock_adjustment_account_id", label: "Stock adjustments", hint: "Stock found, lost, scrapped or corrected.", type: "expense", group: "stock" },
  { key: "customer_deposit_account_id", label: "Customer deposits", hint: "Rental deposits held until settled.", type: "liability", group: "rental" },
  { key: "rental_income_account_id", label: "Rental income", hint: "Rental invoices (else sales).", type: "revenue", group: "rental", optional: true },
  { key: "retained_earnings_account_id", label: "Retained earnings", hint: "Closing a year moves its profit or loss here.", type: "equity", group: "year" },
] as const;

type PostingKey = (typeof POSTING_ACCOUNTS)[number]["key"];
type PostingAccount = (typeof POSTING_ACCOUNTS)[number] & { optional?: boolean; group?: string };
const GROUPS: { id: string | undefined; title: string }[] = [
  { id: undefined, title: "Invoices, payments and receipts" },
  { id: "stock", title: "Stock (from the posting start date)" },
  { id: "rental", title: "Rentals" },
  { id: "year", title: "Year end" },
];
const NONE = "none";

interface Account { id: string; account_code: string; account_name: string; account_type: string }

export function PostingAccountsCard() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const qc = useQueryClient();
  const [values, setValues] = useState<Partial<Record<PostingKey, string | null>>>({});
  const [startDate, setStartDate] = useState<string>("");

  const { data: accounts = [] } = useQuery({
    queryKey: ["posting-accounts-coa", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name, account_type, is_header, is_active")
        .eq("company_id", companyId!)
        .order("account_code");
      if (error) throw error;
      return (data ?? []).filter((a) => !a.is_header && a.is_active !== false) as Account[];
    },
    enabled: !!companyId,
  });

  const { data: current } = useQuery({
    queryKey: ["gl-settings-posting", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("gl_settings").select("*").eq("company_id", companyId!).maybeSingle();
      if (error) throw error;
      return (data ?? {}) as Partial<Record<PostingKey, string | null>> & { stock_posting_start_date?: string | null };
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    if (current) {
      setValues(Object.fromEntries(POSTING_ACCOUNTS.map((p) => [p.key, current[p.key] ?? null])));
      setStartDate(current.stock_posting_start_date ?? "");
    }
  }, [current]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("gl_settings")
        .update({ ...values, stock_posting_start_date: startDate || null } as never).eq("company_id", companyId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gl-settings-posting", companyId] });
      qc.invalidateQueries({ queryKey: ["gl-settings", companyId] });
      toast.success("Posting accounts saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const missing = (POSTING_ACCOUNTS as readonly PostingAccount[]).filter((p) => !p.optional && !p.group && !values[p.key]).length;
  const stockReady = !!values.inventory_account_id && !!startDate;

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Posting accounts</h3>
        <p className="text-sm text-muted-foreground">
          Posting invoices and recording payments and receipts write their journals to these accounts.
          {missing > 0 && ` ${missing} still to set; posting asks for the ones it needs.`}
        </p>
      </div>
      {GROUPS.map((g) => (
        <div key={g.title} className="space-y-2">
          <h4 className="text-sm font-medium">{g.title}</h4>
          {g.id === "stock" && (
            <div className="max-w-xs space-y-1">
              <Label htmlFor="stock-start">Post stock movements from</Label>
              <Input id="stock-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                {stockReady ? "Movements from this date post to the ledger every hour." : "Stock posts once the inventory account and this date are set."}
                {" "}Movements before it are left to the opening balances.
              </p>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {(POSTING_ACCOUNTS as readonly PostingAccount[]).filter((p) => p.group === g.id).map((p) => {
              const options = [...accounts].sort((a, b) => Number(b.account_type === p.type) - Number(a.account_type === p.type));
              return (
                <div key={p.key} className="space-y-1">
                  <Label>{p.label}{p.optional ? " (optional)" : ""}</Label>
                  <Select value={values[p.key] ?? NONE} onValueChange={(v) => setValues({ ...values, [p.key]: v === NONE ? null : v })}>
                    <SelectTrigger aria-label={p.label}><SelectValue placeholder="Not set" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not set</SelectItem>
                      {options.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.account_code} · {a.account_name} ({a.account_type})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{p.hint}</p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending || !companyId}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save posting accounts
        </Button>
      </div>
    </Card>
  );
}
