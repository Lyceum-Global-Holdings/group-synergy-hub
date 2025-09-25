import { useState } from "react";
import { format } from "date-fns";
import { Calendar, FileText, TrendingUp, Plus, Edit, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/ui/data-table";
import { SupplierEvaluation, SupplierEvaluationEntry } from "@/types/supplierEvaluation";
import { useSupplierEvaluationEntries } from "@/hooks/useSupplierEvaluations";
import { ColumnDef } from "@tanstack/react-table";

const statusColors = {
  draft: "bg-yellow-100 text-yellow-800 border-yellow-200",
  completed: "bg-green-100 text-green-800 border-green-200", 
  archived: "bg-gray-100 text-gray-800 border-gray-200",
};

interface SupplierEvaluationDetailsDialogProps {
  evaluation: SupplierEvaluation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupplierEvaluationDetailsDialog({
  evaluation,
  open,
  onOpenChange,
}: SupplierEvaluationDetailsDialogProps) {
  const { data: entries = [], isLoading } = useSupplierEvaluationEntries(evaluation.id);

  const columns: ColumnDef<SupplierEvaluationEntry>[] = [
    {
      accessorKey: "receipt_date",
      header: "Receipt Date",
      cell: ({ row }) => format(new Date(row.getValue("receipt_date")), "MMM dd, yyyy"),
    },
    {
      accessorKey: "po_delivery_date", 
      header: "PO Delivery Date",
      cell: ({ row }) => format(new Date(row.getValue("po_delivery_date")), "MMM dd, yyyy"),
    },
    {
      accessorKey: "po_number",
      header: "PO Number",
    },
    {
      header: "Product Quality",
      cell: ({ row }) => {
        const entry = row.original;
        if (entry.passed_first_time) return <Badge variant="outline" className="bg-green-100 text-green-800">Passed First Time (50)</Badge>;
        if (entry.passed_after_rework) return <Badge variant="outline" className="bg-blue-100 text-blue-800">Passed After Re-work (30)</Badge>;
        if (entry.failed_but_accepted) return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Failed but Accepted (20)</Badge>;
        if (entry.failed_returned) return <Badge variant="outline" className="bg-red-100 text-red-800">Failed & Returned (0)</Badge>;
        return <Badge variant="outline">Not Set</Badge>;
      },
    },
    {
      header: "Punctuality",
      cell: ({ row }) => {
        const entry = row.original;
        if (entry.within_due_date) return <Badge variant="outline" className="bg-green-100 text-green-800">Within Due Date (50)</Badge>;
        if (entry.five_days_late) return <Badge variant="outline" className="bg-blue-100 text-blue-800">5 Days Late (30)</Badge>;
        if (entry.within_14_days) return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Within 14 Days (20)</Badge>;
        if (entry.over_14_days_late) return <Badge variant="outline" className="bg-red-100 text-red-800">Over 14 Days Late (0)</Badge>;
        return <Badge variant="outline">Not Set</Badge>;
      },
    },
    {
      accessorKey: "total_score",
      header: "Total Score",
      cell: ({ row }) => (
        <div className="font-medium text-center">
          {row.getValue("total_score")}/100
        </div>
      ),
    },
  ];

  const performanceColor = evaluation.performance_rate >= 80 ? 'text-green-600' : 
    evaluation.performance_rate >= 60 ? 'text-yellow-600' : 'text-red-600';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">Supplier Scorecard</DialogTitle>
              <DialogDescription className="mt-1">
                {evaluation.evaluation_number} • {evaluation.supplier?.name}
              </DialogDescription>
            </div>
            <Badge 
              variant="outline" 
              className={statusColors[evaluation.status as keyof typeof statusColors] || statusColors.draft}
            >
              {evaluation.status.charAt(0).toUpperCase() + evaluation.status.slice(1)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Supplier Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="font-semibold">{evaluation.supplier?.name}</div>
                <div className="text-sm text-muted-foreground">{evaluation.supplier?.supplier_code}</div>
                <div className="text-sm">{evaluation.product_name}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Evaluation Period</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">
                    {format(new Date(evaluation.evaluation_period_start), "MMM dd")} - {" "}
                    {format(new Date(evaluation.evaluation_period_end), "MMM dd, yyyy")}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Performance Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{evaluation.total_deliveries}</div>
                  <div className="text-sm text-muted-foreground">Total Deliveries</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{evaluation.total_points_achieved}</div>
                  <div className="text-sm text-muted-foreground">Points Achieved</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{evaluation.total_possible_points}</div>
                  <div className="text-sm text-muted-foreground">Possible Points</div>
                </div>
                <div>
                  <div className={`text-2xl font-bold ${performanceColor}`}>
                    {evaluation.performance_rate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Performance Rate</div>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Performance Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Performance Rate</span>
                  <span className={performanceColor}>{evaluation.performance_rate.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full ${
                      evaluation.performance_rate >= 80 ? 'bg-green-500' : 
                      evaluation.performance_rate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(evaluation.performance_rate, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Evaluation Entries */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Evaluation Entries
                </CardTitle>
                <Button size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Entry
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                data={entries}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}