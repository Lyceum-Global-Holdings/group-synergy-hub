import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, FileSpreadsheet, BarChart3, TrendingUp, Download } from "lucide-react";
import { BudgetList } from "@/components/finance/budgeting/BudgetList";
import { BudgetEntryGrid } from "@/components/finance/budgeting/BudgetEntryGrid";
import { BudgetVarianceReport } from "@/components/finance/budgeting/BudgetVarianceReport";
import { CreateBudgetDialog } from "@/components/finance/budgeting/CreateBudgetDialog";

export default function Budgeting() {
  const [activeTab, setActiveTab] = useState("budgets");
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);

  const handleEditBudget = (budgetId: string) => {
    setSelectedBudgetId(budgetId);
    setActiveTab("entry");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Budget Management</h1>
          <p className="text-muted-foreground">
            Create, manage, and analyze budgets with variance tracking
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowBudgetDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Budget
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="budgets" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Budgets
          </TabsTrigger>
          <TabsTrigger value="entry" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Budget Entry
          </TabsTrigger>
          <TabsTrigger value="variance" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Variance Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="budgets">
          <BudgetList />
        </TabsContent>

        <TabsContent value="entry">
          <BudgetEntryGrid />
        </TabsContent>

        <TabsContent value="variance">
          <BudgetVarianceReport />
        </TabsContent>
      </Tabs>

      <CreateBudgetDialog 
        open={showBudgetDialog} 
        onOpenChange={setShowBudgetDialog} 
      />
    </div>
  );
}
