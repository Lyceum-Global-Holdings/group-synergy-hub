import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUp, Check, RefreshCw, Download, AlertCircle, Link2 } from "lucide-react";
import { useBankAccounts } from "@/hooks/finance/useBankAccounts";
import { useBankTransactions } from "@/hooks/finance/useBankTransactions";
import { useGLSettings } from "@/hooks/useGLSettings";
import { format } from "date-fns";
import { BankStatementImport } from "@/components/finance/bank/BankStatementImport";
import { ReconciliationWorkspace } from "@/components/finance/bank/ReconciliationWorkspace";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function BankReconciliation() {
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("transactions");
  
  const { bankAccounts } = useBankAccounts();
  const { transactions } = useBankTransactions(selectedAccount);
  const { currencySymbol } = useGLSettings();
  const queryClient = useQueryClient();

  const unreconciledTransactions = transactions?.filter(t => !t.is_reconciled) || [];
  const reconciledTransactions = transactions?.filter(t => t.is_reconciled) || [];

  const totalUnreconciled = unreconciledTransactions.reduce((sum, t) => 
    sum + (t.credit_amount || 0) - (t.debit_amount || 0), 0
  );

  const handleToggleTransaction = (id: string) => {
    setSelectedTransactions(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const reconcileMutation = useMutation({
    mutationFn: async (transactionIds: string[]) => {
      const { error } = await supabase
        .from('bank_transactions')
        .update({ 
          is_reconciled: true, 
          reconciled_date: new Date().toISOString() 
        })
        .in('id', transactionIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      setSelectedTransactions([]);
      toast.success('Transactions reconciled successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to reconcile: ${error.message}`);
    },
  });

  const handleReconcileSelected = () => {
    if (selectedTransactions.length > 0) {
      reconcileMutation.mutate(selectedTransactions);
    }
  };

  const formatCurrency = (amount: number) => {
    return `${currencySymbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bank Reconciliation</h1>
          <p className="text-muted-foreground">
            Match bank statements with book transactions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
            <FileUp className="h-4 w-4 mr-2" />
            Import Statement
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Account Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Bank Account</CardTitle>
          <CardDescription>Choose an account to reconcile</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select bank account" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts?.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.account_name} - {account.account_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAccount && (
              <Button variant="outline" onClick={() => {
                setSelectedTransactions([]);
                queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
              }}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedAccount && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Unreconciled Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{unreconciledTransactions.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Unreconciled Amount
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${totalUnreconciled < 0 ? 'text-destructive' : 'text-green-600'}`}>
                  {formatCurrency(Math.abs(totalUnreconciled))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Selected for Reconciliation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{selectedTransactions.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs for different views */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="transactions">Book Transactions</TabsTrigger>
              <TabsTrigger value="matching">
                <Link2 className="h-4 w-4 mr-2" />
                Statement Matching
              </TabsTrigger>
            </TabsList>

            <TabsContent value="transactions" className="space-y-4">
              {/* Unreconciled Transactions */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Unreconciled Transactions</CardTitle>
                      <CardDescription>Select transactions to reconcile</CardDescription>
                    </div>
                    {selectedTransactions.length > 0 && (
                      <Button onClick={handleReconcileSelected} disabled={reconcileMutation.isPending}>
                        <Check className="h-4 w-4 mr-2" />
                        {reconcileMutation.isPending 
                          ? "Reconciling..." 
                          : `Reconcile Selected (${selectedTransactions.length})`
                        }
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {unreconciledTransactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>All transactions are reconciled</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unreconciledTransactions.map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedTransactions.includes(transaction.id)}
                                onCheckedChange={() => handleToggleTransaction(transaction.id)}
                              />
                            </TableCell>
                            <TableCell>
                              {format(new Date(transaction.transaction_date), "dd MMM yyyy")}
                            </TableCell>
                            <TableCell>{transaction.reference_number || "-"}</TableCell>
                            <TableCell>{transaction.description}</TableCell>
                            <TableCell className="text-right">
                              {transaction.debit_amount ? formatCurrency(transaction.debit_amount) : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {transaction.credit_amount ? formatCurrency(transaction.credit_amount) : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Recently Reconciled */}
              {reconciledTransactions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Recently Reconciled</CardTitle>
                    <CardDescription>Last 10 reconciled transactions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Reconciled</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reconciledTransactions.slice(0, 10).map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell>
                              {format(new Date(transaction.transaction_date), "dd MMM yyyy")}
                            </TableCell>
                            <TableCell>{transaction.reference_number || "-"}</TableCell>
                            <TableCell>{transaction.description}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency((transaction.credit_amount || 0) - (transaction.debit_amount || 0))}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                <Check className="h-3 w-3 mr-1" />
                                {transaction.reconciled_date 
                                  ? format(new Date(transaction.reconciled_date), "dd MMM")
                                  : "Reconciled"
                                }
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="matching">
              <ReconciliationWorkspace bankAccountId={selectedAccount} />
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Import Dialog */}
      <BankStatementImport
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        bankAccountId={selectedAccount}
        onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['bank-statement-lines'] });
          setActiveTab('matching');
        }}
      />
    </div>
  );
}
