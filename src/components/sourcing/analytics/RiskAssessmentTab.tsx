import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SupplierAnalytics } from "@/lib/supplierAnalytics";
import { AlertTriangle, TrendingDown, Target, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface RiskAssessmentTabProps {
  analytics: SupplierAnalytics[];
}

interface RiskItem {
  supplier: SupplierAnalytics;
  riskType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  icon: React.ReactNode;
}

export const RiskAssessmentTab = ({ analytics }: RiskAssessmentTabProps) => {
  const risks: RiskItem[] = [];

  // Identify risks
  analytics.forEach(supplier => {
    // Declining trend risk
    if (supplier.trendDirection === 'declining') {
      risks.push({
        supplier,
        riskType: 'Performance Decline',
        severity: supplier.improvementRate < -15 ? 'critical' : supplier.improvementRate < -10 ? 'high' : 'medium',
        description: `Performance declining by ${Math.abs(supplier.improvementRate).toFixed(1)}%`,
        icon: <TrendingDown className="h-4 w-4" />
      });
    }

    // Low performance risk
    if (supplier.avgPerformanceRate < 55) {
      risks.push({
        supplier,
        riskType: 'Low Performance',
        severity: supplier.avgPerformanceRate < 40 ? 'critical' : 'high',
        description: `Consistently poor performance at ${supplier.avgPerformanceRate.toFixed(1)}%`,
        icon: <AlertTriangle className="h-4 w-4" />
      });
    }

    // Inconsistency risk
    if (supplier.consistencyScore < 50 && supplier.totalDeliveries >= 10) {
      risks.push({
        supplier,
        riskType: 'Inconsistent Quality',
        severity: supplier.consistencyScore < 30 ? 'high' : 'medium',
        description: `High variation in performance (consistency: ${supplier.consistencyScore.toFixed(1)})`,
        icon: <Target className="h-4 w-4" />
      });
    }

    // Low reliability risk
    if (supplier.reliabilityIndex < 50) {
      risks.push({
        supplier,
        riskType: 'Low Reliability',
        severity: supplier.reliabilityIndex < 30 ? 'high' : 'medium',
        description: `Reliability index at ${supplier.reliabilityIndex.toFixed(1)}`,
        icon: <Shield className="h-4 w-4" />
      });
    }
  });

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const getRiskColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const riskCounts = {
    critical: risks.filter(r => r.severity === 'critical').length,
    high: risks.filter(r => r.severity === 'high').length,
    medium: risks.filter(r => r.severity === 'medium').length,
    low: risks.filter(r => r.severity === 'low').length,
  };

  return (
    <div className="space-y-6">
      {/* Risk Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Critical Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{riskCounts.critical}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">High Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{riskCounts.high}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Medium Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{riskCounts.medium}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Low Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{riskCounts.low}</div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Details */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Analysis</CardTitle>
          <CardDescription>Identified supplier risks requiring attention</CardDescription>
        </CardHeader>
        <CardContent>
          {risks.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Risk Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Performance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {risks.map((risk, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Badge variant="outline" className={getRiskColor(risk.severity)}>
                          {risk.icon}
                          <span className="ml-1 capitalize">{risk.severity}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{risk.supplier.supplierName}</div>
                          <div className="text-xs text-muted-foreground">{risk.supplier.supplierCode}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{risk.riskType}</TableCell>
                      <TableCell className="text-muted-foreground">{risk.description}</TableCell>
                      <TableCell className="text-right">
                        {risk.supplier.avgPerformanceRate.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No significant risks detected</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};