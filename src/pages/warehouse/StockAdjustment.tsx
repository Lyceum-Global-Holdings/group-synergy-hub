import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, FileUp, TrendingUp, TrendingDown, AlertCircle, Users } from 'lucide-react';
import { useAdjustmentAnalytics } from '@/hooks/useAdjustmentAnalytics';
import { useStockAdjustments } from '@/hooks/useStockAdjustments';
import { StockAdjustmentDialog } from '@/components/warehouse/StockAdjustmentDialog';
import { BulkAdjustmentDialog } from '@/components/warehouse/BulkAdjustmentDialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function StockAdjustment() {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showSingleDialog, setShowSingleDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [selectedAdjustment, setSelectedAdjustment] = useState<any>(null);

  const { analytics, isLoading: isLoadingAnalytics } = useAdjustmentAnalytics();
  const { adjustments, batches, isLoading: isLoadingAdjustments } = useStockAdjustments();

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: 'secondary',
      pending_approval: 'outline',
      approved: 'default',
      rejected: 'destructive',
      completed: 'default',
    };
    return <Badge variant={variants[status] || 'default'}>{status.replace('_', ' ')}</Badge>;
  };

  const getAdjustmentTypeBadge = (type: string) => {
    return <Badge variant="outline">{type.replace('_', ' ')}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Stock Adjustments & Analytics</h1>
          <p className="text-muted-foreground">Comprehensive inventory adjustment management and insights</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulkDialog(true)}>
            <FileUp className="mr-2 h-4 w-4" />
            Bulk Adjustment
          </Button>
          <Button onClick={() => setShowSingleDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Adjustment
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {!isLoadingAnalytics && analytics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Adjustments This Month</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.adjustmentsThisMonth}</div>
              <p className="text-xs text-muted-foreground">
                {analytics.totalAdjustments} total all time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value Impact</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${analytics.totalValueImpact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {analytics.totalValueImpact >= 0 ? '+' : ''}{analytics.totalValueImpact.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Net value change</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.pendingApprovals}</div>
              <p className="text-xs text-muted-foreground">Awaiting review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High-Risk Items</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.highRiskItems}</div>
              <p className="text-xs text-muted-foreground">Frequent adjustments</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview Dashboard</TabsTrigger>
          <TabsTrigger value="adjustments">All Adjustments</TabsTrigger>
          <TabsTrigger value="batches">Adjustment Batches</TabsTrigger>
          <TabsTrigger value="approvals">Approval Queue</TabsTrigger>
        </TabsList>

        {/* Overview Dashboard Tab */}
        <TabsContent value="overview" className="space-y-4">
          {!isLoadingAnalytics && analytics && (
            <>
              {/* Charts Row 1 */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Adjustment Trends</CardTitle>
                    <CardDescription>Last 6 months</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={analytics.trendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="increases" stroke="hsl(var(--chart-1))" name="Increases" />
                        <Line type="monotone" dataKey="decreases" stroke="hsl(var(--chart-2))" name="Decreases" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Adjustment Reasons</CardTitle>
                    <CardDescription>Top 5 reasons</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={analytics.reasonBreakdown.slice(0, 5)}
                          dataKey="count"
                          nameKey="reason"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label
                        >
                          {analytics.reasonBreakdown.slice(0, 5).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Top Adjusted Items */}
              <Card>
                <CardHeader>
                  <CardTitle>Top 10 Most Adjusted Items</CardTitle>
                  <CardDescription>Items requiring frequent adjustments</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.topAdjustedItems} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={150} />
                      <Tooltip />
                      <Bar dataKey="adjustmentCount" fill="hsl(var(--chart-1))" name="Adjustments" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* All Adjustments Tab */}
        <TabsContent value="adjustments">
          <Card>
            <CardHeader>
              <CardTitle>All Adjustments</CardTitle>
              <CardDescription>Complete history of stock adjustments</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity Change</TableHead>
                    <TableHead>Value Impact</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments.map((adjustment) => (
                    <TableRow key={adjustment.id}>
                      <TableCell>{format(new Date(adjustment.created_at), 'MMM dd, yyyy HH:mm')}</TableCell>
                      <TableCell className="font-medium">{adjustment.item_id}</TableCell>
                      <TableCell>{getAdjustmentTypeBadge(adjustment.transaction_type)}</TableCell>
                      <TableCell>
                        <span className={adjustment.quantity_change >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {adjustment.quantity_change >= 0 ? '+' : ''}{adjustment.quantity_change}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={adjustment.total_value >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {adjustment.total_value >= 0 ? '+' : ''}{adjustment.total_value?.toFixed(2) || '0.00'}
                        </span>
                      </TableCell>
                      <TableCell>{adjustment.batch_id ? 'Batch' : 'Single'}</TableCell>
                      <TableCell className="max-w-xs truncate">{adjustment.adjustment_reason || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Batches Tab */}
        <TabsContent value="batches">
          <Card>
            <CardHeader>
              <CardTitle>Adjustment Batches</CardTitle>
              <CardDescription>Grouped stock adjustments</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Value Impact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">{batch.batch_number}</TableCell>
                      <TableCell>{format(new Date(batch.adjustment_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{getAdjustmentTypeBadge(batch.adjustment_type)}</TableCell>
                      <TableCell>{batch.total_items}</TableCell>
                      <TableCell>
                        <span className={batch.total_value_impact >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {batch.total_value_impact >= 0 ? '+' : ''}{batch.total_value_impact.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(batch.status)}</TableCell>
                      <TableCell>{batch.submitted_by || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approval Queue Tab */}
        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle>Approval Queue</CardTitle>
              <CardDescription>Adjustments awaiting approval</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Value Impact</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.filter(b => b.status === 'pending_approval').map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">{batch.batch_number}</TableCell>
                      <TableCell>{format(new Date(batch.adjustment_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{batch.total_items}</TableCell>
                      <TableCell>
                        <span className={batch.total_value_impact >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {batch.total_value_impact >= 0 ? '+' : ''}{batch.total_value_impact.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>{batch.submitted_by || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">Approve</Button>
                          <Button size="sm" variant="outline">Reject</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {batches.filter(b => b.status === 'pending_approval').length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No pending approvals
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {showSingleDialog && (
        <StockAdjustmentDialog
          open={showSingleDialog}
          onOpenChange={setShowSingleDialog}
          itemId={selectedItemId || ''}
          itemName="Item"
          currentStock={0}
        />
      )}

      {showBulkDialog && (
        <BulkAdjustmentDialog
          open={showBulkDialog}
          onOpenChange={setShowBulkDialog}
        />
      )}
    </div>
  );
}
