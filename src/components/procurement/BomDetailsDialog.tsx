import React from 'react';
import { format } from 'date-fns';
import { FileText, Calendar, User, Package, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBomItems } from '@/hooks/useBillOfMaterials';
import type { BillOfMaterials } from '@/types/bom';

interface BomDetailsDialogProps {
  bom: BillOfMaterials | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (bom: BillOfMaterials) => void;
}

const statusColors = {
  active: "bg-success text-success-foreground",
  inactive: "bg-destructive text-destructive-foreground", 
  draft: "bg-warning text-warning-foreground",
};

const statusLabels = {
  active: "Active",
  inactive: "Inactive",
  draft: "Draft",
};

export function BomDetailsDialog({ bom, open, onOpenChange, onEdit }: BomDetailsDialogProps) {
  const { items, isLoading: itemsLoading } = useBomItems(bom?.id || '');

  if (!bom) return null;

  const getStatusBadge = (status: string) => (
    <Badge className={statusColors[status as keyof typeof statusColors]}>
      {statusLabels[status as keyof typeof statusLabels]}
    </Badge>
  );

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'LKR',
    }).format(amount);
  };

  const totalCost = items.reduce((sum, item) => sum + (item.total_cost || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {bom.bom_number}
              </DialogTitle>
              <DialogDescription>{bom.product_name}</DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(bom.status)}
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(bom)}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="items">Items ({items?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">BOM Number</Label>
                      <p className="font-medium">{bom.bom_number}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Version</Label>
                      <p>{bom.version || 'N/A'}</p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Product Name</Label>
                    <p className="font-medium">{bom.product_name}</p>
                  </div>

                  {bom.style_no && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Style Number</Label>
                      <p>{bom.style_no}</p>
                    </div>
                  )}

                  {bom.description && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                      <p className="text-sm">{bom.description}</p>
                    </div>
                  )}

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                    <div className="mt-1">{getStatusBadge(bom.status)}</div>
                  </div>
                </CardContent>
              </Card>

              {/* BOM Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">BOM Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Created Date</Label>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(bom.created_at), 'MMM dd, yyyy')}</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Last Updated</Label>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(bom.updated_at), 'MMM dd, yyyy HH:mm')}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Total Items</Label>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <span className="font-medium">{items?.length || 0}</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Total Cost</Label>
                    <p className="text-lg font-bold text-primary">{formatCurrency(totalCost)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="items" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  BOM Items ({items?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {itemsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading items...
                  </div>
                ) : items && items.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Code</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Consumption</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Unit Cost</TableHead>
                        <TableHead>Total Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {item.item_code ? (
                              <Badge variant="outline" className="text-xs">
                                {item.item_code}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{item.item_name}</TableCell>
                          <TableCell>
                            {item.category ? (
                              <Badge variant="secondary" className="text-xs">
                                {item.category}
                              </Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{item.consumption || '-'}</TableCell>
                          <TableCell>{item.unit_of_measure}</TableCell>
                          <TableCell>{formatCurrency(item.unit_cost)}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(item.total_cost)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={7} className="text-right font-medium">
                          Total:
                        </TableCell>
                        <TableCell className="font-bold">
                          {formatCurrency(totalCost)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No items found for this BOM.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}