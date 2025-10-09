import { useState } from "react";
import { Plus, Search, FileText, TrendingUp, Calendar, BarChart3, Eye, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { useSupplierEvaluations, useDeleteSupplierEvaluation } from "@/hooks/useSupplierEvaluations";
import { CreateSupplierEvaluationDialog } from "@/components/sourcing/CreateSupplierEvaluationDialog";
import { SupplierEvaluationDetailsDialog } from "@/components/sourcing/SupplierEvaluationDetailsDialog";
import { SupplierEvaluation as SupplierEvaluationType } from "@/types/supplierEvaluation";
import { ColumnDef } from "@tanstack/react-table";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusColors = {
  draft: "bg-yellow-100 text-yellow-800 border-yellow-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  archived: "bg-gray-100 text-gray-800 border-gray-200",
};

const SupplierEvaluation = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [performanceFilter, setPerformanceFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<SupplierEvaluationType | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [deleteEvaluationId, setDeleteEvaluationId] = useState<string | null>(null);

  const { data: evaluations = [], isLoading } = useSupplierEvaluations();
  const deleteEvaluationMutation = useDeleteSupplierEvaluation();

  const filteredEvaluations = evaluations.filter((evaluation) => {
    const matchesSearch = 
      evaluation.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evaluation.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evaluation.evaluation_number.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || evaluation.status === statusFilter;

    let matchesPerformance = true;
    if (performanceFilter === "excellent") matchesPerformance = evaluation.performance_rate >= 85;
    else if (performanceFilter === "good") matchesPerformance = evaluation.performance_rate >= 70 && evaluation.performance_rate < 85;
    else if (performanceFilter === "fair") matchesPerformance = evaluation.performance_rate >= 55 && evaluation.performance_rate < 70;
    else if (performanceFilter === "poor") matchesPerformance = evaluation.performance_rate < 55;

    return matchesSearch && matchesStatus && matchesPerformance;
  });

  const handleViewDetails = (evaluation: SupplierEvaluationType) => {
    setSelectedEvaluation(evaluation);
    setIsDetailsDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeleteEvaluationId(id);
  };

  const handleDeleteConfirm = async () => {
    if (deleteEvaluationId) {
      try {
        await deleteEvaluationMutation.mutateAsync(deleteEvaluationId);
        toast({
          title: "Success",
          description: "Evaluation deleted successfully",
        });
        setDeleteEvaluationId(null);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete evaluation",
          variant: "destructive",
        });
      }
    }
  };

  const columns: ColumnDef<SupplierEvaluationType>[] = [
    {
      accessorKey: "evaluation_number",
      header: "Evaluation No.",
      cell: ({ row }) => (
        <Button
          variant="link"
          className="h-auto p-0 font-medium text-primary"
          onClick={() => handleViewDetails(row.original)}
        >
          {row.getValue("evaluation_number")}
        </Button>
      ),
    },
    {
      accessorKey: "supplier.name",
      header: "Supplier",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.supplier?.name}</div>
          <div className="text-sm text-muted-foreground">{row.original.supplier?.supplier_code}</div>
        </div>
      ),
    },
    {
      accessorKey: "product_name",
      header: "Product",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.product_name}</div>
          {row.original.warehouse_item && (
            <div className="text-sm text-muted-foreground">
              {row.original.warehouse_item.item_code}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "evaluation_period_start",
      header: "Evaluation Period",
      cell: ({ row }) => (
        <div className="text-sm">
          {format(new Date(row.original.evaluation_period_start), "MMM dd")} -{" "}
          {format(new Date(row.original.evaluation_period_end), "MMM dd, yyyy")}
        </div>
      ),
    },
    {
      accessorKey: "total_deliveries",
      header: "Deliveries",
      cell: ({ row }) => (
        <div className="text-center font-medium">
          {row.getValue("total_deliveries")}
        </div>
      ),
    },
    {
      accessorKey: "performance_rate",
      header: "Performance Rate",
      cell: ({ row }) => {
        const rate = row.getValue("performance_rate") as number;
        return (
          <div className="flex items-center gap-2">
            <div className="text-right font-medium">{rate.toFixed(1)}%</div>
            <div className="w-16 h-2 rounded-full bg-secondary">
              <div
                className={`h-full rounded-full ${
                  rate >= 85 ? "bg-green-500" :
                  rate >= 70 ? "bg-blue-500" :
                  rate >= 55 ? "bg-yellow-500" : "bg-red-500"
                }`}
                style={{ width: `${Math.min(rate, 100)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as keyof typeof statusColors;
        return (
          <Badge variant="outline" className={statusColors[status]}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewDetails(row.original)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteClick(row.original.id)}
            disabled={row.original.status === "completed"}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const totalEvaluations = evaluations.length;
  const averagePerformance =
    evaluations.length > 0
      ? evaluations.reduce((sum, e) => sum + e.performance_rate, 0) / evaluations.length
      : 0;
  const totalDeliveries = evaluations.reduce((sum, e) => sum + e.total_deliveries, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Supplier Evaluation</h1>
          <p className="text-muted-foreground">
            Manage and track supplier performance evaluations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/sourcing/supplier-scorecard")}>
            <BarChart3 className="mr-2 h-4 w-4" />
            View Analytics
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Evaluation
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Evaluations</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEvaluations}</div>
            <p className="text-xs text-muted-foreground">
              {evaluations.filter((e) => e.status === "completed").length} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averagePerformance.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Across all suppliers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDeliveries}</div>
            <p className="text-xs text-muted-foreground">Evaluated deliveries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Suppliers</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(evaluations.map((e) => e.supplier_id)).size}
            </div>
            <p className="text-xs text-muted-foreground">Under evaluation</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Table */}
      <Card>
        <CardHeader>
          <CardTitle>Supplier Evaluations</CardTitle>
          <CardDescription>View and manage all supplier evaluations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Search by supplier, product, or evaluation number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={performanceFilter} onValueChange={setPerformanceFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by performance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Performance</SelectItem>
                <SelectItem value="excellent">Excellent (≥85%)</SelectItem>
                <SelectItem value="good">Good (70-85%)</SelectItem>
                <SelectItem value="fair">Fair (55-70%)</SelectItem>
                <SelectItem value="poor">Poor (&lt;55%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DataTable columns={columns} data={filteredEvaluations} isLoading={isLoading} />
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateSupplierEvaluationDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      {selectedEvaluation && (
        <SupplierEvaluationDetailsDialog
          evaluation={selectedEvaluation}
          open={isDetailsDialogOpen}
          onOpenChange={setIsDetailsDialogOpen}
        />
      )}

      <AlertDialog open={!!deleteEvaluationId} onOpenChange={() => setDeleteEvaluationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the evaluation and all its entries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SupplierEvaluation;