import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ValuationReportsTab() {
  const reports = [
    {
      name: 'Inventory Valuation Summary',
      description: 'Executive summary of inventory valuation',
      type: 'summary',
    },
    {
      name: 'Detailed Item Valuation',
      description: 'Line-by-line item valuation report',
      type: 'detailed',
    },
    {
      name: 'Aging Analysis Report',
      description: 'Inventory aging breakdown by category',
      type: 'aging',
    },
    {
      name: 'Dead Stock Report',
      description: 'Items with no movement for 365+ days',
      type: 'aging',
    },
    {
      name: 'Movement Analysis',
      description: 'Stock receipts and issues with value impact',
      type: 'movement',
    },
    {
      name: 'Valuation Method Comparison',
      description: 'Compare different valuation methods',
      type: 'comparison',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Valuation Reports
        </CardTitle>
        <CardDescription>
          Pre-built reports for inventory valuation analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {reports.map((report) => (
            <Card key={report.name}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium mb-1">{report.name}</h4>
                    <p className="text-sm text-muted-foreground">{report.description}</p>
                  </div>
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
