import { useState } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { CalendarIcon, Plus, Trash2, Check } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useJournalEntries } from "@/hooks/useJournalEntries";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { JournalEntryLine, JournalType } from "@/types/generalLedger";
import { toast } from "sonner";

interface CreateJournalEntryWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface JEFormData {
  journal_date: Date;
  journal_type: JournalType;
  reference_type?: string;
  reference_number?: string;
  description: string;
}

export function CreateJournalEntryWizard({ open, onOpenChange }: CreateJournalEntryWizardProps) {
  const [step, setStep] = useState(1);
  const [headerData, setHeaderData] = useState<JEFormData | null>(null);
  const [lines, setLines] = useState<JournalEntryLine[]>([
    { line_number: 1, account_id: "", description: "", debit_amount: 0, credit_amount: 0, currency: "LKR", exchange_rate: 1 }
  ]);
  const [accountSearchOpen, setAccountSearchOpen] = useState<number | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<JEFormData>({
    defaultValues: {
      journal_date: new Date(),
      journal_type: "manual",
      description: ""
    }
  });

  const { accounts } = useChartOfAccounts();
  const { createJournalEntry, postJournalEntry } = useJournalEntries();
  const journalDate = watch("journal_date");

  const activeAccounts = accounts?.filter(a => !a.is_header && a.is_active) || [];

  const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit_amount || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit_amount || 0), 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;

  const handleStep1Submit = (data: JEFormData) => {
    setHeaderData(data);
    setStep(2);
  };

  const addLine = () => {
    setLines([...lines, {
      line_number: lines.length + 1,
      account_id: "",
      description: "",
      debit_amount: 0,
      credit_amount: 0,
      currency: "LKR",
      exchange_rate: 1
    }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index).map((line, i) => ({ ...line, line_number: i + 1 })));
    }
  };

  const updateLine = (index: number, field: keyof JournalEntryLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const handleFinalSubmit = async (postImmediately: boolean) => {
    if (!headerData) return;

    const validLines = lines.filter(line => line.account_id && (line.debit_amount > 0 || line.credit_amount > 0));

    if (validLines.length === 0) {
      toast.error("Please add at least one valid journal entry line");
      return;
    }

    if (!isBalanced) {
      toast.error("Journal entry is not balanced. Debits must equal Credits.");
      return;
    }

    let created: { id: string } | undefined;
    try {
      created = await createJournalEntry.mutateAsync({
        journal_date: format(headerData.journal_date, "yyyy-MM-dd"),
        journal_type: headerData.journal_type,
        reference_type: headerData.reference_type,
        reference_number: headerData.reference_number,
        description: headerData.description,
        lines: validLines
      });

    } catch (error) {
      toast.error("Failed to create journal entry");
      return;
    }
    // "Create & Post" posts the new entry; if posting is refused (e.g. no posting
    // rights) it stays as a draft and the hook reports why.
    if (postImmediately && created?.id) {
      try {
        await postJournalEntry.mutateAsync(created.id);
      } catch {
        toast.warning("Saved as a draft; it couldn't be posted");
      }
    } else {
      toast.success("Journal entry created as draft");
    }
    onOpenChange(false);
    resetWizard();
  };

  const resetWizard = () => {
    setStep(1);
    setHeaderData(null);
    setLines([{ line_number: 1, account_id: "", description: "", debit_amount: 0, credit_amount: 0, currency: "LKR", exchange_rate: 1 }]);
  };

  const getAccountName = (accountId: string) => {
    const account = activeAccounts.find(a => a.id === accountId);
    return account ? `${account.account_code} - ${account.account_name}` : "";
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetWizard();
    }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Journal Entry - Step {step} of 3</DialogTitle>
        </DialogHeader>

        {/* Step 1: Header Information */}
        {step === 1 && (
          <form onSubmit={handleSubmit(handleStep1Submit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Journal Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !journalDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {journalDate ? format(journalDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={journalDate} onSelect={(date) => date && setValue("journal_date", date)} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Journal Type *</Label>
                <Select defaultValue="manual" onValueChange={(value) => setValue("journal_type", value as JournalType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="system_generated">System Generated</SelectItem>
                    <SelectItem value="opening_balance">Opening Balance</SelectItem>
                    <SelectItem value="closing">Closing</SelectItem>
                    <SelectItem value="adjusting">Adjusting</SelectItem>
                    <SelectItem value="reversing">Reversing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Reference Type</Label>
                <Input {...register("reference_type")} placeholder="e.g., Invoice, PO" />
              </div>

              <div className="space-y-2">
                <Label>Reference Number</Label>
                <Input {...register("reference_number")} placeholder="e.g., INV-001" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea {...register("description", { required: true })} placeholder="Enter journal entry description" rows={3} />
              {errors.description && <span className="text-sm text-destructive">Description is required</span>}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit">Next</Button>
            </div>
          </form>
        )}

        {/* Step 2: Add Lines */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-4 py-2 grid grid-cols-12 gap-2 text-sm font-medium">
                <div className="col-span-4">Account</div>
                <div className="col-span-3">Description</div>
                <div className="col-span-2">Debit</div>
                <div className="col-span-2">Credit</div>
                <div className="col-span-1"></div>
              </div>

              {lines.map((line, index) => (
                <div key={index} className="px-4 py-3 grid grid-cols-12 gap-2 items-start border-t">
                  <div className="col-span-4">
                    <Popover open={accountSearchOpen === index} onOpenChange={(open) => setAccountSearchOpen(open ? index : null)}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          {line.account_id ? getAccountName(line.account_id) : "Select account..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search account..." />
                          <CommandEmpty>No account found.</CommandEmpty>
                          <CommandGroup className="max-h-[300px] overflow-auto">
                            {activeAccounts.map((account) => (
                              <CommandItem key={account.id} value={`${account.account_code} ${account.account_name}`} onSelect={() => {
                                updateLine(index, "account_id", account.id);
                                setAccountSearchOpen(null);
                              }}>
                                <Check className={cn("mr-2 h-4 w-4", line.account_id === account.id ? "opacity-100" : "opacity-0")} />
                                {account.account_code} - {account.account_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="col-span-3">
                    <Input value={line.description || ""} onChange={(e) => updateLine(index, "description", e.target.value)} placeholder="Line description" />
                  </div>

                  <div className="col-span-2">
                    <Input type="number" step="0.01" value={line.debit_amount || ""} onChange={(e) => {
                      updateLine(index, "debit_amount", parseFloat(e.target.value) || 0);
                      if (parseFloat(e.target.value) > 0) updateLine(index, "credit_amount", 0);
                    }} placeholder="0.00" />
                  </div>

                  <div className="col-span-2">
                    <Input type="number" step="0.01" value={line.credit_amount || ""} onChange={(e) => {
                      updateLine(index, "credit_amount", parseFloat(e.target.value) || 0);
                      if (parseFloat(e.target.value) > 0) updateLine(index, "debit_amount", 0);
                    }} placeholder="0.00" />
                  </div>

                  <div className="col-span-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(index)} disabled={lines.length === 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" onClick={addLine} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Add Line
            </Button>

            <div className="bg-muted p-4 rounded-lg">
              <div className="flex justify-between text-sm mb-2">
                <span>Total Debit:</span>
                <span className="font-semibold">{totalDebit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span>Total Credit:</span>
                <span className="font-semibold">{totalCredit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-2 border-t">
                <span>Difference:</span>
                <span className={cn(isBalanced ? "text-green-600" : "text-destructive")}>
                  {Math.abs(totalDebit - totalCredit).toFixed(2)}
                </span>
              </div>
              {!isBalanced && totalDebit + totalCredit > 0 && (
                <p className="text-xs text-destructive mt-2">⚠️ Entry is not balanced. Debits must equal Credits.</p>
              )}
            </div>

            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button type="button" onClick={() => setStep(3)} disabled={!isBalanced}>Review</Button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Submit */}
        {step === 3 && headerData && (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 space-y-2">
              <h3 className="font-semibold">Header Information</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Date:</span> {format(headerData.journal_date, "PPP")}</div>
                <div><span className="text-muted-foreground">Type:</span> {headerData.journal_type}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Description:</span> {headerData.description}</div>
                {headerData.reference_type && <div><span className="text-muted-foreground">Ref Type:</span> {headerData.reference_type}</div>}
                {headerData.reference_number && <div><span className="text-muted-foreground">Ref Number:</span> {headerData.reference_number}</div>}
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Account</th>
                    <th className="text-left p-2">Description</th>
                    <th className="text-right p-2">Debit</th>
                    <th className="text-right p-2">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.filter(line => line.account_id).map((line, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-2">{getAccountName(line.account_id)}</td>
                      <td className="p-2">{line.description}</td>
                      <td className="text-right p-2">{line.debit_amount > 0 ? line.debit_amount.toFixed(2) : "-"}</td>
                      <td className="text-right p-2">{line.credit_amount > 0 ? line.credit_amount.toFixed(2) : "-"}</td>
                    </tr>
                  ))}
                  <tr className="border-t font-bold bg-muted">
                    <td colSpan={2} className="p-2">Total</td>
                    <td className="text-right p-2">{totalDebit.toFixed(2)}</td>
                    <td className="text-right p-2">{totalCredit.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => handleFinalSubmit(false)} disabled={createJournalEntry.isPending}>
                  Save as Draft
                </Button>
                <Button type="button" onClick={() => handleFinalSubmit(true)} disabled={createJournalEntry.isPending}>
                  Post Entry
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
