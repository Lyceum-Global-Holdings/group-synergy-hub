import { useState } from "react";
import { Plus, Search, DollarSign, TrendingUp, TrendingDown, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjectBudgetItems, useCreateProjectBudgetItem, useUpdateProjectBudgetItem, useDeleteProjectBudgetItem } from "@/hooks/construction/useProjectBudgets";
import { BUDGET_CATEGORIES, ProjectBudgetItem } from "@/types/construction";
import { BudgetItemDialog, DeleteConfirmDialog } from "@/components/construction/dialogs";

export default function ProjectBudgeting() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProjectBudgetItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<ProjectBudgetItem | null>(null);

  const { data: budgetItems, isLoading } = useProjectBudgetItems();
  const createMutation = useCreateProjectBudgetItem();
  const updateMutation = useUpdateProjectBudgetItem();
  const deleteMutation = useDeleteProjectBudgetItem();

  const filteredBudgetItems = budgetItems?.filter((item) => {
    const matchesSearch =
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.budget_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalPlanned = budgetItems?.reduce((sum, item) => sum + (item.planned_amount || 0), 0) || 0;
  const totalCommitted = budgetItems?.reduce((sum, item) => sum + (item.committed_amount || 0), 0) || 0;
  const totalActual = budgetItems?.reduce((sum, item) => sum + (item.actual_amount || 0), 0) || 0;
  const totalVariance = totalPlanned - totalActual;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getVarianceBadge = (planned: number, actual: number) => {
    const variance = planned - actual;
    const percentVariance = planned > 0 ? (variance / planned) * 100 : 0;
    
    if (variance >= 0) {
      return (
        <Badge className="bg-green-100 text-green-800">
          <TrendingDown className="h-3 w-3 mr-1" />
          {formatCurrency(variance)} ({percentVariance.toFixed(1)}%)
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-100 text-red-800">
        <TrendingUp className="h-3 w-3 mr-1" />
        {formatCurrency(Math.abs(variance))} ({Math.abs(percentVariance).toFixed(1)}%)
      </Badge>
    );
  };

  const utilizationPercent = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;

  const handleCreate = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const handleEdit = (item: ProjectBudgetItem) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deletingItem) {
      await deleteMutation.mutateAsync(deletingItem.id);
      setDeletingItem(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Project Budgeting</h1>
          <p className="text-muted-foreground">
            Track and manage project budgets, costs, and variances
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Budget Item
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Planned</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPlanned)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Committed</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCommitted)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actual Spent</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalActual)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Variance</CardTitle>
            {totalVariance >= 0 ? (
              <TrendingDown className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingUp className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalVariance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(totalVariance)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Budget Utilization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Overall Budget Usage</span>
            <span className="font-medium">{utilizationPercent.toFixed(1)}%</span>
          </div>
          <Progress value={utilizationPercent} className="h-3" />
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Planned: {formatCurrency(totalPlanned)}</span>
            <span>•</span>
            <span>Actual: {formatCurrency(totalActual)}</span>
            <span>•</span>
            <span>Remaining: {formatCurrency(totalPlanned - totalActual)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search budget items..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {BUDGET_CATEGORIES.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Planned</TableHead>
                  <TableHead className="text-right">Committed</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead>Variance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBudgetItems?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No budget items found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBudgetItems?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.budget_code}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.project?.project_name || "-"}</TableCell>
                      <TableCell className="capitalize">{item.category}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.planned_amount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.committed_amount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.actual_amount)}</TableCell>
                      <TableCell>
                        {getVarianceBadge(item.planned_amount, item.actual_amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(item as ProjectBudgetItem)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingItem(item as ProjectBudgetItem)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <BudgetItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        budgetItem={editingItem}
      />

      <DeleteConfirmDialog
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        onConfirm={handleDelete}
        title="Delete Budget Item"
        description={`Are you sure you want to delete budget item "${deletingItem?.budget_code}"? This action cannot be undone.`}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
