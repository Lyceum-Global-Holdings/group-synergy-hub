import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useStockMovementAnalytics } from '@/hooks/useStockMovementAnalytics';
import { useWarehouseItems } from '@/hooks/useWarehouseItems';
import { Loader2, TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export function StockMovementChart() {
  const [selectedItemId, setSelectedItemId] = useState<string>('all');
  const { items } = useWarehouseItems();
  const { data: movements = [], isLoading } = useStockMovementAnalytics(
    selectedItemId === 'all' ? undefined : selectedItemId
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          Stock Movement Trends (30 Days)
        </CardTitle>
        <Select value={selectedItemId} onValueChange={setSelectedItemId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All Items" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Items</SelectItem>
            {items.filter(i => i.status === 'active').map(item => (
              <SelectItem key={item.id} value={item.id}>
                {item.item_code} - {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[280px]">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={movements} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorReceipt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorIssue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorTransfer" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorAdjustment" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => format(parseISO(v), 'dd MMM')}
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
              />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip
                labelFormatter={(v) => format(parseISO(v as string), 'dd MMM yyyy')}
                contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="goods_receipt"
                name="Goods Receipt"
                stroke="hsl(142, 76%, 36%)"
                fill="url(#colorReceipt)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="material_issue"
                name="Material Issue"
                stroke="hsl(0, 84%, 60%)"
                fill="url(#colorIssue)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="transfer"
                name="Transfer"
                stroke="hsl(217, 91%, 60%)"
                fill="url(#colorTransfer)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="adjustment"
                name="Adjustment"
                stroke="hsl(45, 93%, 47%)"
                fill="url(#colorAdjustment)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
