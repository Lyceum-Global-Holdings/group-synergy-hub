import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, Link2, AlertCircle, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useGLSettings } from "@/hooks/useGLSettings";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  bankAccountId: string;
  importId?: string;
}

interface StatementLine {
  id: string;
  line_number: number;
  transaction_date: string;
  description: string;
  reference: string | null;
  debit_amount: number | null;
  credit_amount: number | null;
  match_status: string | null;
  match_confidence: number | null;
  matched_transaction_id: string | null;
}

interface BookTransaction {
  id: string;
  transaction_date: string;
  description: string | null;
  reference_number: string | null;
  debit_amount: number | null;
  credit_amount: number | null;
  is_reconciled: boolean | null;
}

export function ReconciliationWorkspace({ bankAccountId, importId }: Props) {
  const { selectedCompany } = useCompany();
  const { currencySymbol } = useGLSettings();
  const queryClient = useQueryClient();
  
  const [selectedStatementLine, setSelectedStatementLine] = useState<string | null>(null);
  const [selectedBookTransaction, setSelectedBookTransaction] = useState<string | null>(null);

  // Fetch unmatched statement lines
  const { data: statementLines, isLoading: linesLoading } = useQuery({
    queryKey: ['bank-statement-lines', importId, 'unmatched'],
    queryFn: async () => {
      let query = supabase
        .from('bank_statement_lines')
        .select('*')
        .eq('match_status', 'unmatched')
        .order('transaction_date', { ascending: true });
      
      if (importId) {
        query = query.eq('import_id', importId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as StatementLine[];
    },
    enabled: !!bankAccountId,
  });

  // Fetch unreconciled book transactions
  const { data: bookTransactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['bank-transactions', bankAccountId, 'unreconciled'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('bank_account_id', bankAccountId)
        .eq('is_reconciled', false)
        .order('transaction_date', { ascending: true });
      
      if (error) throw error;
      return data as BookTransaction[];
    },
    enabled: !!bankAccountId,
  });

  // Match mutation
  const matchMutation = useMutation({
    mutationFn: async ({ statementLineId, bookTransactionId }: { statementLineId: string; bookTransactionId: string }) => {
      // Update statement line
      const { error: lineError } = await supabase
        .from('bank_statement_lines')
        .update({
          match_status: 'matched',
          matched_transaction_id: bookTransactionId,
          matched_at: new Date().toISOString(),
        })
        .eq('id', statementLineId);
      
      if (lineError) throw lineError;

      // Update book transaction
      const { error: txError } = await supabase
        .from('bank_transactions')
        .update({
          is_reconciled: true,
          reconciled_date: new Date().toISOString(),
        })
        .eq('id', bookTransactionId);
      
      if (txError) throw txError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-statement-lines'] });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      setSelectedStatementLine(null);
      setSelectedBookTransaction(null);
      toast.success('Transactions matched successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to match: ${error.message}`);
    },
  });

  // Auto-match suggestion logic
  const suggestions = useMemo(() => {
    if (!statementLines || !bookTransactions) return [];
    
    return statementLines.map(line => {
      const lineAmount = (line.credit_amount || 0) - (line.debit_amount || 0);
      
      // Find potential matches
      const matches = bookTransactions.filter(tx => {
        const txAmount = (tx.credit_amount || 0) - (tx.debit_amount || 0);
        const amountMatch = Math.abs(lineAmount - txAmount) < 0.01;
        const dateMatch = Math.abs(new Date(line.transaction_date).getTime() - new Date(tx.transaction_date).getTime()) < 7 * 24 * 60 * 60 * 1000;
        return amountMatch && dateMatch;
      });

      if (matches.length === 1) {
        const match = matches[0];
        let confidence = 50;
        
        // Exact amount match
        const txAmount = (match.credit_amount || 0) - (match.debit_amount || 0);
        if (Math.abs(lineAmount - txAmount) < 0.001) confidence += 20;
        
        // Same date
        if (line.transaction_date === match.transaction_date) confidence += 20;
        
        // Reference match
        if (line.reference && match.reference_number && 
            line.reference.toLowerCase().includes(match.reference_number.toLowerCase())) {
          confidence += 10;
        }
        
        return { lineId: line.id, matchId: match.id, confidence };
      }
      
      return null;
    }).filter(Boolean);
  }, [statementLines, bookTransactions]);

  const handleMatch = () => {
    if (selectedStatementLine && selectedBookTransaction) {
      matchMutation.mutate({
        statementLineId: selectedStatementLine,
        bookTransactionId: selectedBookTransaction,
      });
    }
  };

  const handleAcceptSuggestion = (lineId: string, matchId: string) => {
    matchMutation.mutate({
      statementLineId: lineId,
      bookTransactionId: matchId,
    });
  };

  const formatCurrency = (amount: number) => {
    return `${currencySymbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) return <Badge className="bg-green-100 text-green-800">High</Badge>;
    if (confidence >= 60) return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
    return <Badge className="bg-orange-100 text-orange-800">Low</Badge>;
  };

  const isLoading = linesLoading || transactionsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Match Suggestions */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Match Suggestions</CardTitle>
            <CardDescription>Review and accept suggested matches</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {suggestions.slice(0, 5).map((suggestion: any) => {
                const line = statementLines?.find(l => l.id === suggestion.lineId);
                const tx = bookTransactions?.find(t => t.id === suggestion.matchId);
                if (!line || !tx) return null;
                
                return (
                  <div key={suggestion.lineId} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    <div className="flex-1 grid grid-cols-3 gap-4 items-center">
                      <div>
                        <p className="font-medium text-sm">{line.description}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(line.transaction_date), 'dd MMM yyyy')}</p>
                      </div>
                      <div className="text-center">
                        <Link2 className="h-4 w-4 mx-auto text-muted-foreground" />
                        {getConfidenceBadge(suggestion.confidence)}
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(tx.transaction_date), 'dd MMM yyyy')}</p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      className="ml-4"
                      onClick={() => handleAcceptSuggestion(suggestion.lineId, suggestion.matchId)}
                      disabled={matchMutation.isPending}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Accept
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Side-by-side matching */}
      <div className="grid grid-cols-2 gap-4">
        {/* Bank Statement Lines */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Bank Statement</CardTitle>
            <CardDescription>{statementLines?.length || 0} unmatched items</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statementLines?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        No unmatched statement lines
                      </TableCell>
                    </TableRow>
                  ) : (
                    statementLines?.map((line) => {
                      const amount = (line.credit_amount || 0) - (line.debit_amount || 0);
                      return (
                        <TableRow 
                          key={line.id}
                          className={cn(
                            "cursor-pointer",
                            selectedStatementLine === line.id && "bg-primary/10"
                          )}
                          onClick={() => setSelectedStatementLine(line.id)}
                        >
                          <TableCell>
                            <Checkbox 
                              checked={selectedStatementLine === line.id}
                              onCheckedChange={() => setSelectedStatementLine(
                                selectedStatementLine === line.id ? null : line.id
                              )}
                            />
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(line.transaction_date), 'dd MMM')}
                          </TableCell>
                          <TableCell className="text-sm max-w-[150px] truncate">
                            {line.description}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right text-sm font-medium",
                            amount >= 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {formatCurrency(Math.abs(amount))}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Book Transactions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Book Transactions</CardTitle>
            <CardDescription>{bookTransactions?.length || 0} unreconciled items</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookTransactions?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        No unreconciled transactions
                      </TableCell>
                    </TableRow>
                  ) : (
                    bookTransactions?.map((tx) => {
                      const amount = (tx.credit_amount || 0) - (tx.debit_amount || 0);
                      return (
                        <TableRow 
                          key={tx.id}
                          className={cn(
                            "cursor-pointer",
                            selectedBookTransaction === tx.id && "bg-primary/10"
                          )}
                          onClick={() => setSelectedBookTransaction(tx.id)}
                        >
                          <TableCell>
                            <Checkbox 
                              checked={selectedBookTransaction === tx.id}
                              onCheckedChange={() => setSelectedBookTransaction(
                                selectedBookTransaction === tx.id ? null : tx.id
                              )}
                            />
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(tx.transaction_date), 'dd MMM')}
                          </TableCell>
                          <TableCell className="text-sm max-w-[150px] truncate">
                            {tx.description || tx.reference_number || '-'}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right text-sm font-medium",
                            amount >= 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {formatCurrency(Math.abs(amount))}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Match Action */}
      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handleMatch}
          disabled={!selectedStatementLine || !selectedBookTransaction || matchMutation.isPending}
        >
          <Link2 className="h-4 w-4 mr-2" />
          {matchMutation.isPending ? "Matching..." : "Match Selected Items"}
        </Button>
      </div>
    </div>
  );
}
