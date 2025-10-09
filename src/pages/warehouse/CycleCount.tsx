import { useState } from "react";
import { Plus, Search, ClipboardList, AlertCircle, TrendingUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCycleCounts } from "@/hooks/useCycleCount";
import CreateCycleCountDialog from "@/components/warehouse/CreateCycleCountDialog";
import CycleCountDetailsDialog from "@/components/warehouse/CycleCountDetailsDialog";
import { format } from "date-fns";

export default function CycleCount() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");
  const [selectedCountId, setSelectedCountId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: cycleCounts = [], isLoading } = useCycleCounts();

  const filteredCounts = cycleCounts.filter(count => {
    const matchesSearch = count.count_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = selectedTab === "all" || count.status === selectedTab;
    return matchesSearch && matchesTab;
  });

  // Calculate KPIs
  const activeCounts = cycleCounts.filter(c => c.status === 'in_progress').length;
  const totalVarianceItems = cycleCounts.reduce((sum, c) => sum + (c.items_with_variance || 0), 0);
  const totalItemsCounted = cycleCounts.reduce((sum, c) => sum + (c.items_counted || 0), 0);
  const totalItemsToCount = cycleCounts.reduce((sum, c) => sum + (c.total_items_to_count || 0), 0);
  const accuracyRate = totalItemsToCount > 0 
    ? ((totalItemsToCount - totalVarianceItems) / totalItemsToCount * 100).toFixed(1) 
    : 0;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      draft: { variant: "outline", label: "Draft" },
      in_progress: { variant: "default", label: "In Progress" },
      completed: { variant: "secondary", label: "Completed" },
      cancelled: { variant: "destructive", label: "Cancelled" },
    };
    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cycle Count</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Regular physical inventory counting for accuracy verification
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Cycle Count
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Counts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCounts}</div>
            <p className="text-xs text-muted-foreground">Currently in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Items Counted</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItemsCounted}</div>
            <p className="text-xs text-muted-foreground">
              of {totalItemsToCount} total items
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Variance Items</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVarianceItems}</div>
            <p className="text-xs text-muted-foreground">Items with discrepancies</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accuracy Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accuracyRate}%</div>
            <p className="text-xs text-muted-foreground">Overall inventory accuracy</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Cycle Count Sessions</CardTitle>
          <CardDescription>View and manage all cycle counting activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by count number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
              <TabsTrigger value="in_progress">In Progress</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Count Number</TableHead>
                      <TableHead>Count Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Counted</TableHead>
                      <TableHead className="text-right">Variances</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          Loading cycle counts...
                        </TableCell>
                      </TableRow>
                    ) : filteredCounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          No cycle counts found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCounts.map((count) => (
                        <TableRow 
                          key={count.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedCountId(count.id)}
                        >
                          <TableCell className="font-medium">{count.count_number}</TableCell>
                          <TableCell>{format(new Date(count.count_date), "MMM dd, yyyy")}</TableCell>
                          <TableCell className="capitalize">{count.count_type.replace('_', ' ')}</TableCell>
                          <TableCell>{getStatusBadge(count.status)}</TableCell>
                          <TableCell className="text-right">{count.total_items_to_count}</TableCell>
                          <TableCell className="text-right">{count.items_counted}</TableCell>
                          <TableCell className="text-right">
                            {count.items_with_variance > 0 ? (
                              <span className="text-destructive font-medium">
                                {count.items_with_variance}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCountId(count.id);
                              }}
                            >
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateCycleCountDialog 
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {selectedCountId && (
        <CycleCountDetailsDialog
          countId={selectedCountId}
          open={!!selectedCountId}
          onOpenChange={(open) => !open && setSelectedCountId(null)}
        />
      )}
    </div>
  );
}
