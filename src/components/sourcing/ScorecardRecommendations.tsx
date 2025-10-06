import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SupplierEvaluation } from "@/types/supplierEvaluation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, TrendingDown, Award, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ScorecardRecommendationsProps {
  evaluations: SupplierEvaluation[];
}

export const ScorecardRecommendations = ({ evaluations }: ScorecardRecommendationsProps) => {
  const recommendations: Array<{
    type: 'warning' | 'success' | 'info';
    icon: React.ReactNode;
    title: string;
    description: string;
  }> = [];

  // Low performance suppliers
  const lowPerformance = evaluations.filter(e => e.performance_rate < 55 && e.status === 'completed');
  if (lowPerformance.length > 0) {
    recommendations.push({
      type: 'warning',
      icon: <AlertTriangle className="h-4 w-4" />,
      title: `${lowPerformance.length} Supplier${lowPerformance.length > 1 ? 's' : ''} with Poor Performance`,
      description: lowPerformance.map(e => e.supplier?.name).join(', ') + ' - Consider review or alternative suppliers.',
    });
  }

  // High performers
  const highPerformance = evaluations.filter(e => e.performance_rate >= 85 && e.status === 'completed');
  if (highPerformance.length > 0) {
    recommendations.push({
      type: 'success',
      icon: <Award className="h-4 w-4" />,
      title: `${highPerformance.length} Excellent Performer${highPerformance.length > 1 ? 's' : ''}`,
      description: highPerformance.map(e => e.supplier?.name).join(', ') + ' - Consider expanding partnership.',
    });
  }

  // Draft evaluations pending
  const draftEvaluations = evaluations.filter(e => e.status === 'draft');
  if (draftEvaluations.length > 0) {
    recommendations.push({
      type: 'info',
      icon: <Info className="h-4 w-4" />,
      title: `${draftEvaluations.length} Draft Evaluation${draftEvaluations.length > 1 ? 's' : ''} Pending`,
      description: 'Complete pending evaluations to get full performance insights.',
    });
  }

  // Suppliers with few deliveries
  const lowDeliveryCount = evaluations.filter(e => e.total_deliveries < 5 && e.status === 'completed');
  if (lowDeliveryCount.length > 0) {
    recommendations.push({
      type: 'info',
      icon: <Info className="h-4 w-4" />,
      title: `${lowDeliveryCount.length} Supplier${lowDeliveryCount.length > 1 ? 's' : ''} with Limited Data`,
      description: 'More deliveries needed for reliable performance assessment: ' + lowDeliveryCount.map(e => e.supplier?.name).join(', '),
    });
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommendations & Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.map((rec, index) => (
          <Alert 
            key={index}
            variant={rec.type === 'warning' ? 'destructive' : 'default'}
            className={
              rec.type === 'success' ? 'border-green-200 bg-green-50' :
              rec.type === 'info' ? 'border-blue-200 bg-blue-50' : ''
            }
          >
            <div className="flex items-start gap-3">
              <div className={
                rec.type === 'warning' ? 'text-red-600' :
                rec.type === 'success' ? 'text-green-600' :
                'text-blue-600'
              }>
                {rec.icon}
              </div>
              <div className="flex-1">
                <div className="font-semibold mb-1">{rec.title}</div>
                <AlertDescription className="text-sm">
                  {rec.description}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        ))}
      </CardContent>
    </Card>
  );
};