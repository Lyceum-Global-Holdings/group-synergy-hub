import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const bankAccountSchema = z.object({
  bank_name: z.string().min(1, "Bank name is required").max(100, "Bank name is too long"),
  account_name: z.string().min(1, "Account name is required").max(100, "Account name is too long"),
  account_number: z.string().min(1, "Account number is required").max(50, "Account number is too long"),
  branch_name: z.string().max(100, "Branch name is too long").optional(),
  swift_code: z.string().max(20, "SWIFT code is too long").optional(),
  currency: z.string().min(1, "Currency is required"),
  opening_balance: z.number().min(0, "Opening balance cannot be negative"),
});

type BankAccountFormValues = z.infer<typeof bankAccountSchema>;

interface CreateBankAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateBankAccountDialog({ open, onOpenChange }: CreateBankAccountDialogProps) {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const form = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      bank_name: '',
      account_name: '',
      account_number: '',
      branch_name: '',
      swift_code: '',
      currency: 'LKR',
      opening_balance: 0,
    },
  });

  const createAccount = useMutation({
    mutationFn: async (values: BankAccountFormValues) => {
      const { error } = await supabase.from("bank_accounts").insert({
        bank_name: values.bank_name,
        account_name: values.account_name,
        account_number: values.account_number,
        branch_name: values.branch_name || null,
        swift_code: values.swift_code || null,
        currency: values.currency,
        opening_balance: values.opening_balance,
        company_id: selectedCompany?.id,
        current_balance: values.opening_balance,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      toast.success("Bank account created successfully");
      form.reset();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to create bank account: " + error.message);
    },
  });

  const onSubmit = (values: BankAccountFormValues) => {
    createAccount.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Bank Account</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="bank_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Commercial Bank" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="branch_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Main Branch" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="account_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Operating Account" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="account_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Number</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter account number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="LKR">LKR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="opening_balance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening Balance</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="swift_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SWIFT Code (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., CABORXXX" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createAccount.isPending}>
                {createAccount.isPending ? "Creating..." : "Add Account"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
