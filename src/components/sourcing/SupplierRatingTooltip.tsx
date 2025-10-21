import React from 'react';
import { Star, TrendingUp, Award, Calendar } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface SupplierRatingTooltipProps {
  rating: number;
  performanceRate: number;
  grade: string;
  totalEvaluations: number;
  lastEvaluationDate?: string;
  children: React.ReactNode;
}

export const SupplierRatingTooltip: React.FC<SupplierRatingTooltipProps> = ({
  rating,
  performanceRate,
  grade,
  totalEvaluations,
  lastEvaluationDate,
  children,
}) => {
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-green-100 text-green-800 border-green-200';
      case 'B': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'C': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'D': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent side="right" className="w-80 p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Performance Rating</h4>
              <Badge className={getGradeColor(grade)}>
                Grade {grade}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span>Rating</span>
                </div>
                <span className="font-semibold">{rating.toFixed(2)} / 5.0</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <span>Performance</span>
                </div>
                <span className="font-semibold">{performanceRate.toFixed(1)}%</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-purple-500" />
                  <span>Evaluations</span>
                </div>
                <span className="font-semibold">{totalEvaluations}</span>
              </div>

              {lastEvaluationDate && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span>Last Evaluated</span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {format(new Date(lastEvaluationDate), 'MMM d, yyyy')}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t text-xs text-muted-foreground">
              <p className="font-mono">
                Formula: Rating = (Performance Rate / 100) × 5
              </p>
              <p className="mt-1">
                {rating.toFixed(2)} = ({performanceRate.toFixed(1)} / 100) × 5
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
