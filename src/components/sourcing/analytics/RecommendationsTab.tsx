import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Recommendation, getPriorityColor, getRecommendationIcon } from "@/lib/supplierRecommendations";
import { CheckCircle, Circle } from "lucide-react";
import { useState } from "react";

interface RecommendationsTabProps {
  recommendations: Recommendation[];
}

export const RecommendationsTab = ({ recommendations }: RecommendationsTabProps) => {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const handleDismiss = (index: number) => {
    setDismissed(new Set([...dismissed, index]));
  };

  const activeRecommendations = recommendations.filter((_, i) => !dismissed.has(i));

  const countByType = {
    cost_savings: recommendations.filter(r => r.type === 'cost_savings').length,
    quality_improvement: recommendations.filter(r => r.type === 'quality_improvement').length,
    risk_mitigation: recommendations.filter(r => r.type === 'risk_mitigation').length,
    diversification: recommendations.filter(r => r.type === 'diversification').length,
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">💰 Cost Savings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{countByType.cost_savings}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">📈 Quality</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{countByType.quality_improvement}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">⚠️ Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{countByType.risk_mitigation}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">🔄 Diversification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{countByType.diversification}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations List */}
      <Card>
        <CardHeader>
          <CardTitle>AI-Powered Recommendations</CardTitle>
          <CardDescription>
            Smart suggestions based on supplier performance, trends, and risk analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeRecommendations.length > 0 ? (
            <div className="space-y-4">
              {activeRecommendations.map((rec, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-2xl">{getRecommendationIcon(rec.type)}</span>
                      <div className="flex-1 space-y-1">
                        <h4 className="font-semibold">{rec.title}</h4>
                        <p className="text-sm text-muted-foreground">{rec.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className={getPriorityColor(rec.priority)}>
                            {rec.priority.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {rec.supplierName}
                          </span>
                          {rec.riskLevel && (
                            <Badge variant="outline" className="text-xs">
                              Risk: {rec.riskLevel}
                            </Badge>
                          )}
                          {rec.potentialSavings && (
                            <Badge variant="outline" className="text-xs bg-green-50">
                              Save: ${rec.potentialSavings.toFixed(2)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDismiss(index)}
                      >
                        <Circle className="h-4 w-4 mr-1" />
                        Dismiss
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Take Action
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {dismissed.size > 0 ? (
                <p>All recommendations have been reviewed</p>
              ) : (
                <p>No recommendations available at this time</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};