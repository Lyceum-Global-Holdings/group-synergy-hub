import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProductionOrders, useProductionSectors, useSeedDefaultSectors } from "@/hooks/useProduction";
import { Button } from "@/components/ui/button";
import { Factory, Package, CheckCircle2, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

interface Props {
  onViewOrder: (id: string) => void;
}

export default function ProductionDashboard({ onViewOrder }: Props) {
  const { data: sectors, isLoading: sectorsLoading } = useProductionSectors();
  const { data: orders, isLoading: ordersLoading } = useProductionOrders();
  const seedMutation = useSeedDefaultSectors();

  if (sectorsLoading || ordersLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  // If no sectors, show setup
  if (!sectors || sectors.length === 0) {
    return (
      <Card className="mt-6">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <Factory className="h-16 w-16 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No Production Sectors Configured</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Set up default sectors (Apparel, Food & Beverage, Manufacturing) with pre-configured stages to get started.
          </p>
          <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
            {seedMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Factory className="mr-2 h-4 w-4" />}
            Initialize Default Sectors
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalOrders = orders?.length || 0;
  const planned = orders?.filter((o) => o.status === "planned").length || 0;
  const inProgress = orders?.filter((o) => o.status === "in_progress").length || 0;
  const completed = orders?.filter((o) => o.status === "completed").length || 0;

  const statusData = [
    { name: "Planned", value: planned },
    { name: "In Progress", value: inProgress },
    { name: "Completed", value: completed },
  ].filter((d) => d.value > 0);

  const sectorData = sectors.map((s) => ({
    name: s.name,
    orders: orders?.filter((o) => o.sector_id === s.id).length || 0,
  }));

  // Efficiency across non-cancelled orders: good output (final stage) vs target.
  const active = (orders || []).filter((o) => o.status !== "cancelled");
  const finalOutputOf = (o: any) => {
    const st = ((o.production_order_stages || []) as any[]).slice().sort((a, b) => a.sequence_order - b.sequence_order);
    return st.length ? Number(st[st.length - 1].output_qty || 0) : 0;
  };
  const totalTarget = active.reduce((s, o) => s + Number(o.target_qty || 0), 0);
  const totalGoodOutput = active.reduce((s, o) => s + finalOutputOf(o), 0);
  const totalWastage = active.reduce((s, o) =>
    s + ((o.production_order_stages || []) as any[]).reduce((w, st) => w + Number(st.wastage_qty || 0), 0), 0);
  const overallYield = totalTarget > 0 ? Math.round((totalGoodOutput / totalTarget) * 100) : 0;

  // Recent WIP orders
  const wipOrders = orders?.filter((o) => o.status === "in_progress").slice(0, 5) || [];

  return (
    <div className="space-y-6 mt-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">{totalOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Planned</p>
                <p className="text-2xl font-bold">{planned}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">In Progress (WIP)</p>
                <p className="text-2xl font-bold">{inProgress}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Efficiency KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Good Output</p>
          <p className="text-2xl font-bold">{totalGoodOutput.toLocaleString()}<span className="text-sm font-normal text-muted-foreground"> / {totalTarget.toLocaleString()}</span></p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Overall Yield</p>
          <p className={`text-2xl font-bold ${overallYield >= 90 ? "text-green-600" : overallYield > 0 ? "text-amber-600" : ""}`}>{overallYield}%</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Total Wastage</p>
          <p className={`text-2xl font-bold ${totalWastage > 0 ? "text-destructive" : ""}`}>{totalWastage.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Target (active)</p>
          <p className="text-2xl font-bold">{totalTarget.toLocaleString()}</p>
        </CardContent></Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Orders by Sector</CardTitle></CardHeader>
          <CardContent>
            {sectorData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={sectorData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No orders yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Status Distribution</CardTitle></CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No orders yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* WIP Orders */}
      {wipOrders.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Active WIP Orders</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {wipOrders.map((o) => {
                const stages = (o as any).production_order_stages || [];
                const completedStages = stages.filter((s: any) => s.status === "completed").length;
                const progress = stages.length > 0 ? Math.round((completedStages / stages.length) * 100) : 0;
                return (
                  <div
                    key={o.id}
                    className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => onViewOrder(o.id)}
                  >
                    <div>
                      <p className="font-medium">{o.order_number} — {o.product_name}</p>
                      <p className="text-xs text-muted-foreground">{(o as any).production_sectors?.name} · Qty: {o.target_qty}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs font-medium">{progress}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
