import { SupplierEvaluation } from "@/types/supplierEvaluation";

export interface SupplierAnalytics {
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  totalEvaluations: number;
  totalDeliveries: number;
  avgPerformanceRate: number;
  avgQualityScore: number;
  avgPunctualityScore: number;
  consistencyScore: number;
  improvementRate: number;
  reliabilityIndex: number;
  performanceGrade: 'A' | 'B' | 'C' | 'D';
  trendDirection: 'improving' | 'declining' | 'stable';
}

export interface PerformanceTrend {
  month: string;
  performance: number;
  quality: number;
  punctuality: number;
}

export const calculateSupplierAnalytics = (
  evaluations: SupplierEvaluation[]
): SupplierAnalytics | null => {
  if (!evaluations.length) return null;

  const supplier = evaluations[0].supplier;
  if (!supplier) return null;

  const totalDeliveries = evaluations.reduce((sum, e) => sum + (e.total_deliveries || 0), 0);
  const avgPerformanceRate = evaluations.reduce((sum, e) => sum + (e.performance_rate || 0), 0) / evaluations.length;

  // Calculate quality and punctuality averages
  let totalQuality = 0;
  let totalPunctuality = 0;
  let entryCount = 0;

  evaluations.forEach(evaluation => {
    evaluation.entries?.forEach(entry => {
      totalQuality += entry.quality_score || 0;
      totalPunctuality += entry.punctuality_score || 0;
      entryCount++;
    });
  });

  const avgQualityScore = entryCount > 0 ? totalQuality / entryCount : 0;
  const avgPunctualityScore = entryCount > 0 ? totalPunctuality / entryCount : 0;

  // Calculate consistency (standard deviation)
  const performanceRates = evaluations.map(e => e.performance_rate || 0);
  const mean = avgPerformanceRate;
  const variance = performanceRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / performanceRates.length;
  const stdDev = Math.sqrt(variance);
  const consistencyScore = Math.max(0, Math.min(100, 100 - (stdDev * 2)));

  // Calculate improvement rate (recent 3 months vs previous 3 months)
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  const recentEvals = evaluations.filter(e => new Date(e.evaluation_period_start) >= threeMonthsAgo);
  const previousEvals = evaluations.filter(e => {
    const date = new Date(e.evaluation_period_start);
    return date >= sixMonthsAgo && date < threeMonthsAgo;
  });

  const recentAvg = recentEvals.length > 0
    ? recentEvals.reduce((sum, e) => sum + (e.performance_rate || 0), 0) / recentEvals.length
    : 0;
  const previousAvg = previousEvals.length > 0
    ? previousEvals.reduce((sum, e) => sum + (e.performance_rate || 0), 0) / previousEvals.length
    : 0;

  const improvementRate = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;

  // Calculate reliability index (composite score)
  const deliveryScore = Math.min(100, totalDeliveries * 10);
  const reliabilityIndex = (avgPerformanceRate * 0.4) + (consistencyScore * 0.3) + (deliveryScore * 0.3);

  // Determine performance grade
  const performanceGrade: 'A' | 'B' | 'C' | 'D' =
    avgPerformanceRate >= 85 ? 'A' :
    avgPerformanceRate >= 70 ? 'B' :
    avgPerformanceRate >= 55 ? 'C' : 'D';

  // Determine trend direction
  const trendDirection: 'improving' | 'declining' | 'stable' =
    improvementRate > 5 ? 'improving' :
    improvementRate < -5 ? 'declining' : 'stable';

  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    supplierCode: supplier.supplier_code,
    totalEvaluations: evaluations.length,
    totalDeliveries,
    avgPerformanceRate: Number(avgPerformanceRate.toFixed(2)),
    avgQualityScore: Number(avgQualityScore.toFixed(2)),
    avgPunctualityScore: Number(avgPunctualityScore.toFixed(2)),
    consistencyScore: Number(consistencyScore.toFixed(2)),
    improvementRate: Number(improvementRate.toFixed(2)),
    reliabilityIndex: Number(reliabilityIndex.toFixed(2)),
    performanceGrade,
    trendDirection,
  };
};

export const calculatePerformanceTrends = (
  evaluations: SupplierEvaluation[]
): PerformanceTrend[] => {
  const monthlyData = new Map<string, { performance: number[], quality: number[], punctuality: number[] }>();

  evaluations.forEach(evaluation => {
    const date = new Date(evaluation.evaluation_period_start);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { performance: [], quality: [], punctuality: [] });
    }

    const data = monthlyData.get(monthKey)!;
    data.performance.push(evaluation.performance_rate || 0);

    evaluation.entries?.forEach(entry => {
      data.quality.push(entry.quality_score || 0);
      data.punctuality.push(entry.punctuality_score || 0);
    });
  });

  const trends: PerformanceTrend[] = [];
  const sortedMonths = Array.from(monthlyData.keys()).sort();

  sortedMonths.forEach(monthKey => {
    const data = monthlyData.get(monthKey)!;
    const avgPerformance = data.performance.reduce((a, b) => a + b, 0) / data.performance.length;
    const avgQuality = data.quality.length > 0 ? data.quality.reduce((a, b) => a + b, 0) / data.quality.length : 0;
    const avgPunctuality = data.punctuality.length > 0 ? data.punctuality.reduce((a, b) => a + b, 0) / data.punctuality.length : 0;

    trends.push({
      month: monthKey,
      performance: Number(avgPerformance.toFixed(2)),
      quality: Number(avgQuality.toFixed(2)),
      punctuality: Number(avgPunctuality.toFixed(2)),
    });
  });

  return trends;
};

export const getGradeColor = (grade: string): string => {
  switch (grade) {
    case 'A': return 'text-green-600 bg-green-50 border-green-200';
    case 'B': return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'C': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'D': return 'text-red-600 bg-red-50 border-red-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

export const getTrendIcon = (trend: string): string => {
  switch (trend) {
    case 'improving': return '↗️';
    case 'declining': return '↘️';
    default: return '→';
  }
};

export const getTrendColor = (trend: string): string => {
  switch (trend) {
    case 'improving': return 'text-green-600';
    case 'declining': return 'text-red-600';
    default: return 'text-gray-600';
  }
};