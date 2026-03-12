import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Package, TrendingUp, AlertTriangle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDailySummary } from "@/hooks/useProduction";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function DailyProductionSummary() {
  const [date, setDate] = useState<Date>(new Date());
  const dateStr = format(date, "yyyy-MM-dd");
  const { data: entries, isLoading } = useDailySummary(dateStr);

  const totals = (entries || []).reduce(
    (acc, e) => ({
      input: acc.input + (e.input_qty || 0),
      output: acc.output + (e.output_qty || 0),
      wastage: acc.wastage + (e.wastage_qty || 0),
    }),
    { input: 0, output: 0, wastage: 0 }
  );

  // Group by order
  const orderMap = new Map<string, { orderNumber: string; productName: string; entries: typeof entries }>();
  (entries || []).forEach((e: any) => {
    const order = e.stage?.order;
    if (!order) return;
    const key = order.id;
    if (!orderMap.has(key)) {
      orderMap.set(key, { orderNumber: order.order_number, productName: order.product_name, entries: [] });
    }
    orderMap.get(key)!.entries!.push(e);
  });

  // Chart data: aggregate output by stage name
  const stageAgg = new Map<string, number>();
  (entries || []).forEach((e: any) => {
    const name = e.stage?.stage_name || "Unknown";
    stageAgg.set(name, (stageAgg.get(name) || 0) + (e.output_qty || 0));
  });
  const chartData = Array.from(stageAgg.entries()).map(([name, output]) => ({ name, output }));

  return (
    <div className="space-y-6">
      {/* Date Picker */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Date:</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(date, "PPP")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Input</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{totals.input}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Output</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{totals.output}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Wastage</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{totals.wastage}</p></CardContent>
        </Card>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (entries || []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Inbox className="h-10 w-10 mb-2" />
            <p>No production entries for {format(date, "PPP")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Table grouped by order */}
          {Array.from(orderMap.entries()).map(([orderId, group]) => (
            <Card key={orderId}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{group.orderNumber} — {group.productName}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stage</TableHead>
                      <TableHead className="text-right">Input</TableHead>
                      <TableHead className="text-right">Output</TableHead>
                      <TableHead className="text-right">Wastage</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(group.entries || []).map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.stage?.stage_name}</TableCell>
                        <TableCell className="text-right">{e.input_qty}</TableCell>
                        <TableCell className="text-right">{e.output_qty}</TableCell>
                        <TableCell className="text-right">{e.wastage_qty}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{e.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}

          {/* Bar Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Output by Stage</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
                    <YAxis className="text-xs fill-muted-foreground" />
                    <Tooltip />
                    <Bar dataKey="output" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
