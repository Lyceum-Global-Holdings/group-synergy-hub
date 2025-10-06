import { SupplierAnalytics } from "./supplierAnalytics";
import { SupplierEvaluation } from "@/types/supplierEvaluation";

export interface Recommendation {
  type: 'cost_savings' | 'quality_improvement' | 'risk_mitigation' | 'diversification';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  potentialSavings?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  supplierId: string;
  supplierName: string;
}

export const generateRecommendations = (
  analytics: SupplierAnalytics[],
  evaluations: SupplierEvaluation[]
): Recommendation[] => {
  const recommendations: Recommendation[] = [];

  analytics.forEach(supplier => {
    // Declining Performance Warning
    if (supplier.trendDirection === 'declining' && supplier.improvementRate < -10) {
      recommendations.push({
        type: 'risk_mitigation',
        title: `Address declining performance of ${supplier.supplierName}`,
        description: `Performance has declined by ${Math.abs(supplier.improvementRate).toFixed(1)}%. Consider discussing quality issues or seeking alternatives.`,
        priority: 'high',
        riskLevel: 'high',
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
      });
    }

    // Low Performance Grade
    if (supplier.performanceGrade === 'D' && supplier.totalDeliveries >= 5) {
      recommendations.push({
        type: 'quality_improvement',
        title: `Replace or improve ${supplier.supplierName}`,
        description: `Consistently poor performance (${supplier.avgPerformanceRate.toFixed(1)}%). Recommend finding alternative suppliers or implementing improvement plan.`,
        priority: 'critical',
        riskLevel: 'high',
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
      });
    }

    // Excellent Performance - Expand Usage
    if (supplier.performanceGrade === 'A' && supplier.reliabilityIndex > 85) {
      recommendations.push({
        type: 'cost_savings',
        title: `Expand partnership with ${supplier.supplierName}`,
        description: `Excellent performance (${supplier.avgPerformanceRate.toFixed(1)}%) and reliability. Consider consolidating more items with this supplier for better pricing.`,
        priority: 'medium',
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
      });
    }

    // Inconsistent Performance
    if (supplier.consistencyScore < 60 && supplier.totalDeliveries >= 10) {
      recommendations.push({
        type: 'quality_improvement',
        title: `Improve consistency with ${supplier.supplierName}`,
        description: `High performance variation detected. Schedule quality review meeting to establish consistent standards.`,
        priority: 'medium',
        riskLevel: 'medium',
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
      });
    }

    // Low Delivery Count
    if (supplier.totalDeliveries < 5 && supplier.avgPerformanceRate > 70) {
      recommendations.push({
        type: 'diversification',
        title: `Test more orders with ${supplier.supplierName}`,
        description: `Limited data (${supplier.totalDeliveries} deliveries) but promising performance. Consider trial orders to validate consistency.`,
        priority: 'low',
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
      });
    }
  });

  // Single Source Risk Analysis
  const itemSupplierMap = new Map<string, Set<string>>();
  evaluations.forEach(evaluation => {
    if (evaluation.warehouse_item_id) {
      if (!itemSupplierMap.has(evaluation.warehouse_item_id)) {
        itemSupplierMap.set(evaluation.warehouse_item_id, new Set());
      }
      itemSupplierMap.get(evaluation.warehouse_item_id)!.add(evaluation.supplier_id);
    }
  });

  itemSupplierMap.forEach((suppliers, itemId) => {
    if (suppliers.size === 1) {
      const supplierId = Array.from(suppliers)[0];
      const supplier = analytics.find(a => a.supplierId === supplierId);
      if (supplier) {
        recommendations.push({
          type: 'risk_mitigation',
          title: `Single source risk for items from ${supplier.supplierName}`,
          description: `Multiple items depend on single supplier. Consider developing alternative sources to reduce supply chain risk.`,
          priority: 'medium',
          riskLevel: 'medium',
          supplierId: supplier.supplierId,
          supplierName: supplier.supplierName,
        });
      }
    }
  });

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
};

export const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'critical': return 'text-red-600 bg-red-50 border-red-200';
    case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

export const getRecommendationIcon = (type: string): string => {
  switch (type) {
    case 'cost_savings': return '💰';
    case 'quality_improvement': return '📈';
    case 'risk_mitigation': return '⚠️';
    case 'diversification': return '🔄';
    default: return '💡';
  }
};