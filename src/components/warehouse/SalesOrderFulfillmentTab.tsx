import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Package, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SalesOrderFulfillmentTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Sales Order Fulfillment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sales Order Fulfillment Coming Soon</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              This feature will allow you to manage pick, pack, and dispatch operations for finished goods sales orders.
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span>Sales order integration</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span>Pick list generation</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span>Packing and dispatch tracking</span>
              </div>
            </div>
            <Button variant="outline" className="mt-6" disabled>
              Configure Sales Integration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}