import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  useCycleCount, 
  useCycleCountItems, 
  useStartCycleCount, 
  useCompleteCycleCount,
  useUpdateCycleCountItem,
  usePostCycleCountAdjustments 
} from "@/hooks/useCycleCount";
import type { VarianceReason } from "@/types/cycleCount";
import { AlertCircle, Play, CheckCircle, X } from "lucide-react";
import { format } from "date-fns";

interface CycleCountDetailsDialogProps {
  countId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CycleCountDetailsDialog({ countId, open, onOpenChange }: CycleCountDetailsDialogProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [physicalQty, setPhysicalQty] = useState("");
  const [varianceReason, setVarianceReason] = useState<VarianceReason | "">("");
  const [investigationNotes, setInvestigationNotes] = useState("");
  const [selectedVarianceItems, setSelectedVarianceItems] = useState<string[]>([]);

  const { data: cycleCount } = useCycleCount(countId);
  const { data: items = [] } = useCycleCountItems(countId);
  const startCount = useStartCycleCount();
  const completeCount = useCompleteCycleCount();
  const updateItem = useUpdateCycleCountItem();
  const postAdjustments = usePostCycleCountAdjustments();

  const handleRecordCount = async (itemId: string) => {
    if (!physicalQty) return;

    await updateItem.mutateAsync({
      id: itemId,
      countId,
      data: {
        physical_quantity: parseFloat(physicalQty),
        variance_reason: (varianceReason || undefined) as VarianceReason | undefined,
        investigation_notes: investigationNotes || undefined,
      }
    });

    // Reset form
    setSelectedItemId(null);
    setPhysicalQty("");
    setVarianceReason("");
    setInvestigationNotes("");
  };

  const handlePostAdjustments = async () => {
    const varianceItems = items.filter(item => 
      Math.abs(item.variance_quantity || 0) > 0 && 
      (selectedVarianceItems.length === 0 || selectedVarianceItems.includes(item.id))
    );

    if (varianceItems.length === 0) return;

    await postAdjustments.mutateAsync({
      countId,
      itemIds: varianceItems.map(item => item.id),
    });

    setSelectedVarianceItems([]);
  };

  if (!cycleCount) return null;

  const varianceItems = items.filter(item => Math.abs(item.variance_quantity || 0) > 0);
  const progress = cycleCount.total_items_to_count > 0 
    ? (cycleCount.items_counted / cycleCount.total_items_to_count * 100).toFixed(0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Cycle Count: {cycleCount.count_number}
            <Badge variant={cycleCount.status === 'completed' ? 'secondary' : 'default'}>
              {cycleCount.status.replace('_', ' ')}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            View and manage cycle count details
          </DialogDescription>
        </DialogHeader>

        {/* Actions */}
        <div className="flex gap-2">
          {cycleCount.status === 'draft' && (
            <Button onClick={() => startCount.mutate(countId)}>
              <Play className="mr-2 h-4 w-4" />
              Start Count
            </Button>
          )}
          {cycleCount.status === 'in_progress' && (
            <>
              <Button onClick={() => completeCount.mutate(countId)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete Count
              </Button>
              {varianceItems.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={handlePostAdjustments}
                  disabled={postAdjustments.isPending}
                >
                  Post Adjustments ({varianceItems.length})
                </Button>
              )}
            </>
          )}
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="items">Items ({items.length})</TabsTrigger>
            <TabsTrigger value="variances">
              Variances ({varianceItems.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Count Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Count Date:</span>
                    <span className="font-medium">
                      {format(new Date(cycleCount.count_date), "MMM dd, yyyy")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Count Type:</span>
                    <span className="font-medium capitalize">
                      {cycleCount.count_type.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Progress:</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Count Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Items:</span>
                    <span className="font-medium">{cycleCount.total_items_to_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items Counted:</span>
                    <span className="font-medium">{cycleCount.items_counted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Variances:</span>
                    <span className="font-medium text-destructive">
                      {cycleCount.items_with_variance}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Variance Value:</span>
                    <span className="font-medium">
                      ${cycleCount.total_variance_value?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="items">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead className="text-right">System Qty</TableHead>
                    <TableHead className="text-right">Physical Qty</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.warehouse_items?.item_code}
                      </TableCell>
                      <TableCell>{item.warehouse_items?.item_name}</TableCell>
                      <TableCell className="text-right">{item.system_quantity}</TableCell>
                      <TableCell className="text-right">
                        {selectedItemId === item.id ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={physicalQty}
                            onChange={(e) => setPhysicalQty(e.target.value)}
                            className="w-24"
                            autoFocus
                          />
                        ) : (
                          item.physical_quantity || '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.variance_quantity !== null && item.variance_quantity !== 0 ? (
                          <span className="text-destructive font-medium">
                            {item.variance_quantity > 0 ? '+' : ''}
                            {item.variance_quantity}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'counted' ? 'secondary' : 'outline'}>
                          {item.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {selectedItemId === item.id ? (
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              onClick={() => handleRecordCount(item.id)}
                              disabled={!physicalQty}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedItemId(null);
                                setPhysicalQty("");
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedItemId(item.id);
                              setPhysicalQty(item.physical_quantity?.toString() || "");
                            }}
                            disabled={cycleCount.status !== 'in_progress'}
                          >
                            Count
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {selectedItemId && (
              <div className="mt-4 p-4 border rounded-lg space-y-4">
                <h4 className="font-medium">Variance Investigation</h4>
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="varianceReason">Variance Reason</Label>
                    <Select 
                      value={varianceReason} 
                      onValueChange={(value) => setVarianceReason(value as VarianceReason | "")}
                    >
                      <SelectTrigger id="varianceReason">
                        <SelectValue placeholder="Select reason" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="damaged">Damaged</SelectItem>
                        <SelectItem value="stolen">Stolen</SelectItem>
                        <SelectItem value="misplaced">Misplaced</SelectItem>
                        <SelectItem value="system_error">System Error</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="investigationNotes">Investigation Notes</Label>
                    <Textarea
                      id="investigationNotes"
                      value={investigationNotes}
                      onChange={(e) => setInvestigationNotes(e.target.value)}
                      placeholder="Provide details about the variance..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="variances">
            {varianceItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No variances found. All counts match system quantities.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">System Qty</TableHead>
                      <TableHead className="text-right">Physical Qty</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead className="text-right">Variance %</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {varianceItems.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {item.warehouse_items?.item_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.warehouse_items?.item_code}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.system_quantity}</TableCell>
                        <TableCell className="text-right">{item.physical_quantity}</TableCell>
                        <TableCell className="text-right">
                          <span className="text-destructive font-medium">
                            {item.variance_quantity > 0 ? '+' : ''}
                            {item.variance_quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-destructive font-medium">
                            {item.variance_percentage?.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          {item.variance_reason ? (
                            <Badge variant="outline" className="capitalize">
                              {item.variance_reason.replace('_', ' ')}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
