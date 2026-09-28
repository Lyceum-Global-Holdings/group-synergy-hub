import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { usePaymentAllocation, OutstandingInvoice, PaymentAllocation } from "@/hooks/finance/usePaymentAllocation";
import { useGLSettings } from "@/hooks/useGLSettings";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  paymentId: string;
  paymentAmount: number;
  onAllocationComplete?: () => void;
}

export function PaymentAllocationDialog({ 
  open, 
  onOpenChange, 
  supplierId, 
  paymentId, 
  paymentAmount,
  onAllocationComplete 
}: Props) {
  const { currencySymbol } = useGLSettings();
  const { useOutstandingSupplierInvoices, allocateSupplierPayment } = usePaymentAllocation();
  const { data: invoices, isLoading } = useOutstandingSupplierInvoices(supplierId);
  
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());

  // Reset allocations when dialog opens
  useEffect(() => {
    if (open) {
      setAllocations({});
      setSelectedInvoices(new Set());
    }
  }, [open]);

  const totalAllocated = useMemo(() => {
    return Object.values(allocations).reduce((sum, amt) => sum + (amt || 0), 0);
  }, [allocations]);

  const remainingAmount = paymentAmount - totalAllocated;

  const handleToggleInvoice = (invoiceId: string, invoice: OutstandingInvoice) => {
    const newSelected = new Set(selectedInvoices);
    const newAllocations = { ...allocations };
    
    if (selectedInvoices.has(invoiceId)) {
      newSelected.delete(invoiceId);
      delete newAllocations[invoiceId];
    } else {
      newSelected.add(invoiceId);
      // Auto-allocate the minimum of outstanding and remaining amount
      const autoAmount = Math.min(invoice.outstanding, remainingAmount);
      newAllocations[invoiceId] = autoAmount;
    }
    
    setSelectedInvoices(newSelected);
    setAllocations(newAllocations);
  };

  const handleAllocationChange = (invoiceId: string, value: string, maxAmount: number) => {
    const amount = parseFloat(value) || 0;
    setAllocations(prev => ({
      ...prev,
      [invoiceId]: Math.min(amount, maxAmount),
    }));
  };

  const handleAutoAllocate = () => {
    let remaining = paymentAmount;
    const newAllocations: Record<string, number> = {};
    const newSelected = new Set<string>();
    
    // Allocate in order of due date (oldest first)
    for (const invoice of invoices || []) {
      if (remaining <= 0) break;
      if (invoice.payment_blocked) continue; // can't be paid until its three-way match is accepted
      
      const allocation = Math.min(invoice.outstanding, remaining);
      newAllocations[invoice.id] = allocation;
      newSelected.add(invoice.id);
      remaining -= allocation;
    }
    
    setAllocations(newAllocations);
    setSelectedInvoices(newSelected);
  };

  const handleSubmit = () => {
    const allocationList: PaymentAllocation[] = Array.from(selectedInvoices)
      .filter(id => allocations[id] > 0)
      .map(id => ({
        invoice_id: id,
        allocated_amount: allocations[id],
      }));

    if (allocationList.length === 0) {
      return;
    }

    allocateSupplierPayment.mutate(
      { paymentId, allocations: allocationList },
      {
        onSuccess: () => {
          onOpenChange(false);
          onAllocationComplete?.();
        },
      }
    );
  };

  const formatCurrency = (amount: number) => {
    return `${currencySymbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  };

  const isOverdue = (dueDate: string) => new Date(dueDate) < new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Allocate Payment to Invoices</DialogTitle>
          <DialogDescription>
            Select invoices to allocate this payment of {formatCurrency(paymentAmount)}
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Payment Amount</p>
            <p className="text-lg font-semibold">{formatCurrency(paymentAmount)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Allocated</p>
            <p className="text-lg font-semibold text-green-600">{formatCurrency(totalAllocated)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Remaining</p>
            <p className={`text-lg font-semibold ${remainingAmount < 0 ? 'text-destructive' : ''}`}>
              {formatCurrency(remainingAmount)}
            </p>
          </div>
        </div>

        {/* Auto-allocate button */}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleAutoAllocate}>
            Auto-Allocate (Oldest First)
          </Button>
        </div>

        {/* Invoice list */}
        <div className="flex-1 overflow-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Allocate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading invoices...
                  </TableCell>
                </TableRow>
              ) : invoices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No outstanding invoices found
                  </TableCell>
                </TableRow>
              ) : (
                invoices?.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Checkbox
                        aria-label={`Pay ${invoice.invoice_number}`}
                        checked={selectedInvoices.has(invoice.id)}
                        disabled={!!invoice.payment_blocked}
                        onCheckedChange={() => handleToggleInvoice(invoice.id, invoice)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {invoice.invoice_number}
                      {invoice.payment_blocked && (
                        <Badge variant="outline" className="ml-2 text-xs">{invoice.payment_blocked}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(invoice.invoice_date), 'dd MMM yyyy')}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {format(new Date(invoice.due_date), 'dd MMM yyyy')}
                        {isOverdue(invoice.due_date) && (
                          <Badge variant="destructive" className="text-xs">Overdue</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(invoice.outstanding)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={invoice.outstanding}
                        value={allocations[invoice.id] || ''}
                        onChange={(e) => handleAllocationChange(invoice.id, e.target.value, invoice.outstanding)}
                        disabled={!selectedInvoices.has(invoice.id)}
                        className="w-28 text-right"
                        placeholder="0.00"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={totalAllocated <= 0 || allocateSupplierPayment.isPending}
          >
            {allocateSupplierPayment.isPending ? "Allocating..." : `Allocate ${formatCurrency(totalAllocated)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
