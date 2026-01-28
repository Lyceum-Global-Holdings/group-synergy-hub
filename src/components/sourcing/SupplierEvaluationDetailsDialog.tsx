import { useState } from "react";
import { format } from "date-fns";
import { Calendar, FileText, TrendingUp, Plus, Edit, Trash2, ClipboardList, History, MessageSquare } from "lucide-react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SupplierEvaluation, SupplierEvaluationEntry } from "@/types/supplierEvaluation";
import { useSupplierEvaluationEntries, useCreateSupplierEvaluationEntry } from "@/hooks/useSupplierEvaluations";
import { ColumnDef } from "@tanstack/react-table";
import { BulkEvaluationEntryForm } from "./BulkEvaluationEntryForm";

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
  const [showBulkEntry, setShowBulkEntry] = useState(false);
  const { data: entries = [], isLoading } = useSupplierEvaluationEntries(evaluation.id);
  const createEntryMutation = useCreateSupplierEvaluationEntry();

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
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-6 overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">Supplier Evaluation Details</DialogTitle>
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

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">
              <TrendingUp className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="deliveries">
              <ClipboardList className="mr-2 h-4 w-4" />
              Deliveries ({entries.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="mr-2 h-4 w-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="notes">
              <MessageSquare className="mr-2 h-4 w-4" />
              Notes
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Header Info */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Supplier Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="font-semibold">{evaluation.supplier?.name}</div>
                  <div className="text-sm text-muted-foreground">{evaluation.supplier?.supplier_code}</div>
                  <div className="text-sm">{evaluation.product_name}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Evaluation Period
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">
                      {format(new Date(evaluation.evaluation_period_start), "MMM dd")} -{" "}
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
                  <div className="w-full bg-secondary rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${
                        evaluation.performance_rate >= 85
                          ? "bg-green-500"
                          : evaluation.performance_rate >= 70
                          ? "bg-blue-500"
                          : evaluation.performance_rate >= 55
                          ? "bg-yellow-500"
                          : "bg-red-500"
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
          </TabsContent>

          {/* Deliveries Tab */}
          <TabsContent value="deliveries" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {showBulkEntry ? "Add Delivery Records" : "Evaluation Entries"}
                  </CardTitle>
                  {!showBulkEntry && (
                    <Button size="sm" onClick={() => setShowBulkEntry(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Deliveries
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {showBulkEntry ? (
                  <BulkEvaluationEntryForm
                    onSubmit={(bulkEntries) => {
                      Promise.all(
                        bulkEntries.map((entry) =>
                          createEntryMutation.mutateAsync({
                            ...entry,
                            evaluation_id: evaluation.id,
                            warehouse_item_id: evaluation.warehouse_item_id,
                          })
                        )
                      ).then(() => {
                        setShowBulkEntry(false);
                      });
                    }}
                    onCancel={() => setShowBulkEntry(false)}
                  />
                ) : (
                  <DataTable columns={columns} data={entries} isLoading={isLoading} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Evaluation History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    <div className="flex-1">
                      <p className="font-medium">Evaluation Created</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(evaluation.created_at), "MMM dd, yyyy 'at' HH:mm")}
                      </p>
                    </div>
                  </div>
                  {evaluation.status !== "draft" && (
                    <div className="flex items-start gap-4 p-4 border rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                      <div className="flex-1">
                        <p className="font-medium">Status Updated</p>
                        <p className="text-sm text-muted-foreground">
                          Changed to {evaluation.status}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Evaluation Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No notes available for this evaluation.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}