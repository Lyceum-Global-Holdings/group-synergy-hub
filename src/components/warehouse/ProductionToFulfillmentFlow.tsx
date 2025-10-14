import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Factory, CheckCircle, Package, Truck, ArrowRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

export function ProductionToFulfillmentFlow() {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();

  // Fetch workflow metrics
  const { data: metrics } = useQuery({
    queryKey: ['workflow-metrics', selectedCompany?.id],
    queryFn: async () => {
      // Pending production receipts
      const { data: pendingProduction, error: prodError } = await supabase
        .from('finished_goods_batches')
        .select('id')
        .eq('company_id', selectedCompany?.id)
        .eq('approval_status', 'pending');

      if (prodError) throw prodError;

      // Recent approved production (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: recentProduction, error: recentError } = await supabase
        .from('finished_goods_batches')
        .select('id, finished_good_id, quantity')
        .eq('company_id', selectedCompany?.id)
        .eq('approval_status', 'approved')
        .gte('approved_date', sevenDaysAgo.toISOString());

      if (recentError) throw recentError;

      // Sales orders awaiting fulfillment
      const { data: pendingOrders, error: ordersError } = await supabase
        .from('sales_orders')
        .select('id, sales_order_items!inner(quantity_ordered, quantity_picked)')
        .eq('company_id', selectedCompany?.id)
        .in('status', ['confirmed', 'picking']);

      if (ordersError) throw ordersError;

      // Calculate orders that can be fulfilled with recent production
      const matchableOrders = pendingOrders?.filter(order => {
        const items = order.sales_order_items || [];
        return items.some((item: any) => {
          const needed = item.quantity_ordered - (item.quantity_picked || 0);
          return needed > 0;
        });
      });

      return {
        pendingProduction: pendingProduction?.length || 0,
        recentProduction: recentProduction?.length || 0,
        recentQuantity: recentProduction?.reduce((sum, batch) => sum + (batch.quantity || 0), 0) || 0,
        pendingOrders: matchableOrders?.length || 0
      };
    },
    enabled: !!selectedCompany?.id
  });

  const workflowSteps = [
    {
      icon: Factory,
      title: 'Production',
      status: metrics?.recentProduction || 0,
      label: `${metrics?.recentProduction || 0} approved (7d)`,
      action: () => navigate('/tuh-modules/finished-goods', { state: { tab: 'production' } }),
      actionLabel: 'View Production',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      icon: CheckCircle,
      title: 'Quality Check',
      status: metrics?.pendingProduction || 0,
      label: `${metrics?.pendingProduction || 0} pending approval`,
      action: () => navigate('/tuh-modules/finished-goods', { state: { tab: 'production' } }),
      actionLabel: 'Review Batches',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      icon: Package,
      title: 'Available Stock',
      status: metrics?.recentQuantity || 0,
      label: `${metrics?.recentQuantity || 0} units ready`,
      action: () => navigate('/tuh-modules/finished-goods', { state: { tab: 'products' } }),
      actionLabel: 'View Inventory',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      icon: Truck,
      title: 'Fulfillment',
      status: metrics?.pendingOrders || 0,
      label: `${metrics?.pendingOrders || 0} orders waiting`,
      action: () => navigate('/warehouse/pick-pack'),
      actionLabel: 'Start Fulfillment',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRight className="h-5 w-5" />
          Production to Fulfillment Workflow
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {workflowSteps.map((step, index) => {
            const Icon = step.icon;
            const hasAlert = 
              (step.title === 'Quality Check' && step.status > 0) ||
              (step.title === 'Fulfillment' && step.status > 3);

            return (
              <div key={step.title} className="relative">
                <Card className={`${step.bgColor} border-none`}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center space-y-3">
                      <div className="relative">
                        <Icon className={`h-8 w-8 ${step.color}`} />
                        {hasAlert && (
                          <AlertCircle className="h-4 w-4 text-red-600 absolute -top-1 -right-1" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{step.title}</h3>
                        <p className="text-2xl font-bold mt-1">{step.status}</p>
                        <p className="text-xs text-muted-foreground mt-1">{step.label}</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={step.action}
                        className="w-full"
                      >
                        {step.actionLabel}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                {index < workflowSteps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-2 transform -translate-y-1/2 z-10">
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-3">Quick Actions</h4>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/tuh-modules/finished-goods', { state: { tab: 'production' } })}
            >
              <Factory className="h-4 w-4 mr-2" />
              Create Production Receipt
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/warehouse/pick-pack')}
            >
              <Package className="h-4 w-4 mr-2" />
              Create Sales Order
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/warehouse/pick-pack', { state: { tab: 'pick-lists' } })}
            >
              <Truck className="h-4 w-4 mr-2" />
              Create Pick List
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
