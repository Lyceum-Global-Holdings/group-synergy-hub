import { useState } from "react";
import { Plus, Search, Calendar, TrendingUp, FileText, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { useSupplierEvaluations } from "@/hooks/useSupplierEvaluations";
import { CreateSupplierEvaluationDialog } from "@/components/sourcing/CreateSupplierEvaluationDialog";
import { SupplierEvaluationDetailsDialog } from "@/components/sourcing/SupplierEvaluationDetailsDialog";
import { SupplierEvaluation } from "@/types/supplierEvaluation";
import { ColumnDef } from "@tanstack/react-table";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

const statusColors = {
  draft: "bg-yellow-100 text-yellow-800 border-yellow-200",
  completed: "bg-green-100 text-green-800 border-green-200", 
  archived: "bg-gray-100 text-gray-800 border-gray-200",
};

export default function SupplierScorecard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<SupplierEvaluation | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

  const { data: evaluations = [], isLoading } = useSupplierEvaluations();

  const filteredEvaluations = evaluations.filter((evaluation) =>
    evaluation.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    evaluation.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    evaluation.evaluation_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewDetails = (evaluation: SupplierEvaluation) => {
    setSelectedEvaluation(evaluation);
    setIsDetailsDialogOpen(true);
  };

  const columns: ColumnDef<SupplierEvaluation>[] = [
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
          {format(new Date(row.original.evaluation_period_start), "MMM dd")} - {" "}
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
            <div className={`w-16 h-2 rounded-full bg-gray-200`}>
              <div 
                className={`h-full rounded-full ${
                  rate >= 80 ? 'bg-green-500' : 
                  rate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
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
  ];

  // Calculate summary statistics
  const totalEvaluations = evaluations.length;
  const completedEvaluations = evaluations.filter(e => e.status === 'completed').length;
  const averagePerformance = evaluations.length > 0 
    ? evaluations.reduce((sum, e) => sum + e.performance_rate, 0) / evaluations.length 
    : 0;
  const totalDeliveries = evaluations.reduce((sum, e) => sum + e.total_deliveries, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Supplier Scorecard</h1>
          <p className="text-muted-foreground">
            Evaluate and track supplier performance metrics
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Evaluation
        </Button>
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
              {completedEvaluations} completed
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
            <p className="text-xs text-muted-foreground">
              Across all suppliers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDeliveries}</div>
            <p className="text-xs text-muted-foreground">
              Evaluated deliveries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Suppliers</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(evaluations.map(e => e.supplier_id)).size}
            </div>
            <p className="text-xs text-muted-foreground">
              Under evaluation
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Supplier Evaluations</CardTitle>
          <CardDescription>
            Track and manage supplier performance evaluations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by supplier, product, or evaluation number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <DataTable
            columns={columns}
            data={filteredEvaluations}
            isLoading={isLoading}
          />
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
    </div>
  );
}