import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Settings } from 'lucide-react';
import { useValuationMethods } from '@/hooks/useValuationMethods';
import { useState } from 'react';
import { CreateValuationMethodDialog } from './CreateValuationMethodDialog';
import { format } from 'date-fns';

export function ValuationMethodsManager() {
  const { methods, isLoading } = useValuationMethods();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const methodDescriptions = {
    fifo: 'First In, First Out - Oldest costs are used first',
    lifo: 'Last In, First Out - Newest costs are used first',
    weighted_average: 'Average cost of all units in stock',
    standard_cost: 'Pre-determined standard cost rates',
    actual_cost: 'Specific identification of actual costs',
  };

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
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Valuation Methods Configuration
              </CardTitle>
              <CardDescription>
                Configure valuation methods for different item types and categories
              </CardDescription>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Method
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Method Descriptions */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(methodDescriptions).map(([method, description]) => (
              <Card key={method}>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2 capitalize">{method.replace('_', ' ')}</h4>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Current Methods */}
          <div>
            <h3 className="text-lg font-medium mb-4">Active Valuation Methods</h3>
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left text-sm font-medium">Item Type</th>
                    <th className="p-3 text-left text-sm font-medium">Specific Item</th>
                    <th className="p-3 text-left text-sm font-medium">Method</th>
                    <th className="p-3 text-left text-sm font-medium">Default</th>
                    <th className="p-3 text-left text-sm font-medium">Effective From</th>
                  </tr>
                </thead>
                <tbody>
                  {methods.map((method) => (
                    <tr key={method.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 text-sm">
                        <Badge variant="outline">{method.item_type.replace('_', ' ')}</Badge>
                      </td>
                      <td className="p-3 text-sm">{method.item_id ? 'Specific Item' : 'All Items'}</td>
                      <td className="p-3 text-sm">
                        <Badge>{method.valuation_method.replace('_', ' ')}</Badge>
                      </td>
                      <td className="p-3 text-sm">
                        {method.is_default && <Badge variant="secondary">Default</Badge>}
                      </td>
                      <td className="p-3 text-sm">{format(new Date(method.effective_from), 'yyyy-MM-dd')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {methods.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No valuation methods configured. Add your first method to get started.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <CreateValuationMethodDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </>
  );
}
