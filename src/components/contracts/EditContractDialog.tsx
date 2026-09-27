import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useContractMutations } from "@/hooks/useContractMutations";
import { ContractRenewalFields } from "./ContractRenewalFields";
import { checkRenewal, renewalFormSchema, renewalPayload } from "./contractRenewalForm";
import { policyFields, renewalPolicyOf } from "@/lib/contractRenewal";
import { Contract } from "@/types/contracts";

const formSchema = z.object({
  contract_title: z.string().min(1, "Contract title is required"),
  contract_type: z.string().min(1, "Contract type is required"),
  contract_category: z.string().optional(),
  effective_date: z.string().min(1, "Effective date is required"),
  expiry_date: z.string().optional(),
  contract_value: z.string().optional(),
  currency: z.string().default("LKR"),
  counterparty_name: z.string().optional(),
  counterparty_email: z.string().email().optional().or(z.literal("")),
  payment_terms: z.string().optional(),
  contract_terms: z.string().optional(),
  notes: z.string().optional(),
  ...renewalFormSchema,
}).superRefine(checkRenewal);

type FormData = z.infer<typeof formSchema>;

interface EditContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Contract | null;
}

export const EditContractDialog = ({
  open,
  onOpenChange,
  contract,
}: EditContractDialogProps) => {
  const { updateContract } = useContractMutations();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currency: "LKR",
      renewal_policy: "none",
      renewal_notice_days: "30",
    },
  });

  useEffect(() => {
    if (contract && open) {
      form.reset({
        contract_title: contract.contract_title,
        contract_type: contract.contract_type,
        contract_category: contract.contract_category || "",
        effective_date: contract.effective_date,
        expiry_date: contract.expiry_date || "",
        contract_value: contract.contract_value?.toString() || "",
        currency: contract.currency,
        counterparty_name: contract.counterparty_name || "",
        counterparty_email: contract.counterparty_email || "",
        payment_terms: contract.payment_terms || "",
        contract_terms: contract.contract_terms || "",
        notes: contract.notes || "",
        renewal_policy: renewalPolicyOf(contract),
        renewal_term_months: contract.renewal_term_months?.toString() ?? "",
        max_renewal_count: contract.max_renewal_count?.toString() ?? "",
        renewal_notice_days: contract.renewal_notice_days?.toString() ?? "30",
      });
    }
  }, [contract, open, form]);

  const onSubmit = async (data: FormData) => {
    if (!contract) return;
    
    setIsSubmitting(true);
    try {
      await updateContract.mutateAsync({
        id: contract.id,
        data: {
          contract_title: data.contract_title,
          contract_type: data.contract_type as any,
          contract_category: data.contract_category,
          effective_date: data.effective_date,
          expiry_date: data.expiry_date || null,
          contract_value: data.contract_value ? parseFloat(data.contract_value) : undefined,
          currency: data.currency,
          counterparty_name: data.counterparty_name,
          counterparty_email: data.counterparty_email || undefined,
          payment_terms: data.payment_terms,
          contract_terms: data.contract_terms,
          notes: data.notes,
          ...policyFields(data.renewal_policy),
          ...renewalPayload(data),
        },
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Contract</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contract_title"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Contract Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Annual Supply Agreement" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contract_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="supplier_contract">Supplier Contract</SelectItem>
                        <SelectItem value="customer_contract">Customer Contract</SelectItem>
                        <SelectItem value="service_agreement">Service Agreement</SelectItem>
                        <SelectItem value="employment_contract">Employment Contract</SelectItem>
                        <SelectItem value="nda">NDA</SelectItem>
                        <SelectItem value="lease_agreement">Lease Agreement</SelectItem>
                        <SelectItem value="partnership_agreement">Partnership Agreement</SelectItem>
                        <SelectItem value="framework_agreement">Framework Agreement</SelectItem>
                        <SelectItem value="software_license">Software License</SelectItem>
                        <SelectItem value="consulting_agreement">Consulting Agreement</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contract_category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Procurement, HR, Legal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="effective_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiry_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contract_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Value</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
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

              <ContractRenewalFields
                control={form.control}
                effectiveDate={form.watch("effective_date")}
                expiryDate={form.watch("expiry_date")}
              />

              <FormField
                control={form.control}
                name="counterparty_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Counterparty Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Company or person name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="counterparty_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Counterparty Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payment_terms"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Payment Terms</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Net 30 days" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contract_terms"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Contract Terms</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Main terms and conditions..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Internal notes..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Contract"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
