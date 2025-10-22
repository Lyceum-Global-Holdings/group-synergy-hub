import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useStockTransactions } from '@/hooks/useStockTransactions';
import { useFinishedGoodsMovements } from '@/hooks/useFinishedGoodsMovements';
import { ValuationFilters } from '@/types/inventoryValuation';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface MovementAnalysisTabProps {
  filters: ValuationFilters;
}

export function MovementAnalysisTab({ filters }: MovementAnalysisTabProps) {
  const { transactions, isLoading: loadingTransactions } = useStockTransactions();
  const { movements, isLoading: loadingMovements } = useFinishedGoodsMovements();

  const isLoading = loadingTransactions || loadingMovements;

  const receiptsValue = transactions
    .filter(t => ['goods_receipt', 'material_return', 'adjustment'].includes(t.transaction_type) && (t.total_value || 0) > 0)
    .reduce((sum, t) => sum + (t.total_value || 0), 0);

  const issuesValue = transactions
    .filter(t => ['material_issue'].includes(t.transaction_type))
    .reduce((sum, t) => sum + Math.abs(t.total_value || 0), 0);

  const fgReceiptsValue = movements
    .filter(m => m.movement_type === 'production_receipt')
    .reduce((sum, m) => sum + (m.total_value || 0), 0);

  const fgIssuesValue = movements
    .filter(m => m.movement_type === 'sales_issue')
    .reduce((sum, m) => sum + Math.abs(m.total_value || 0), 0);

  const totalReceipts = receiptsValue + fgReceiptsValue;
  const totalIssues = issuesValue + fgIssuesValue;

  const allMovements = [
    ...transactions.map(t => ({
      date: t.created_at,
      type: t.transaction_type,
      reference: t.reference_type || 'N/A',
      value: t.total_value || 0,
      isReceipt: ['goods_receipt', 'material_return', 'adjustment'].includes(t.transaction_type) && (t.total_value || 0) > 0,
    })),
    ...movements.map(m => ({
      date: m.created_at,
      type: m.movement_type,
      reference: m.reference_type || 'N/A',
      value: m.total_value || 0,
      isReceipt: m.movement_type === 'production_receipt',
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Receipts</p>
                <p className="text-2xl font-bold text-green-600">LKR {totalReceipts.toFixed(2)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Issues</p>
                <p className="text-2xl font-bold text-red-600">LKR {totalIssues.toFixed(2)}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Net Change</p>
                <p className={`text-2xl font-bold ${totalReceipts - totalIssues >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  LKR {(totalReceipts - totalIssues).toFixed(2)}
                </p>
              </div>
              {totalReceipts - totalIssues >= 0 ? (
                <TrendingUp className="h-8 w-8 text-green-600" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-600" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Movements */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Stock Movements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left text-sm font-medium">Date</th>
                  <th className="p-3 text-left text-sm font-medium">Type</th>
                  <th className="p-3 text-left text-sm font-medium">Reference</th>
                  <th className="p-3 text-left text-sm font-medium">Direction</th>
                  <th className="p-3 text-right text-sm font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {allMovements.map((movement, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="p-3 text-sm">{format(new Date(movement.date), 'yyyy-MM-dd HH:mm')}</td>
                    <td className="p-3 text-sm">
                      <Badge variant="outline">{movement.type.replace('_', ' ')}</Badge>
                    </td>
                    <td className="p-3 text-sm">{movement.reference}</td>
                    <td className="p-3 text-sm">
                      {movement.isReceipt ? (
                        <Badge className="bg-green-600">Receipt</Badge>
                      ) : (
                        <Badge className="bg-red-600">Issue</Badge>
                      )}
                    </td>
                    <td className={`p-3 text-sm text-right font-medium ${movement.isReceipt ? 'text-green-600' : 'text-red-600'}`}>
                      {movement.isReceipt ? '+' : '-'}LKR {Math.abs(movement.value).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
