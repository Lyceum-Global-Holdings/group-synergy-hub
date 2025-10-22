import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Plus } from 'lucide-react';
import { useInventorySnapshots } from '@/hooks/useInventorySnapshots';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { CreateSnapshotDialog } from './CreateSnapshotDialog';

export function SnapshotManager() {
  const { snapshots, isLoading } = useInventorySnapshots();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Inventory Snapshots
            </CardTitle>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Snapshot
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left text-sm font-medium">Date</th>
                  <th className="p-3 text-left text-sm font-medium">Type</th>
                  <th className="p-3 text-right text-sm font-medium">Total Value</th>
                  <th className="p-3 text-right text-sm font-medium">Raw Materials</th>
                  <th className="p-3 text-right text-sm font-medium">Finished Goods</th>
                  <th className="p-3 text-right text-sm font-medium">Assets</th>
                  <th className="p-3 text-center text-sm font-medium">Items</th>
                  <th className="p-3 text-left text-sm font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot) => (
                  <tr key={snapshot.id} className="border-b hover:bg-muted/50">
                    <td className="p-3 text-sm font-medium">
                      {format(new Date(snapshot.snapshot_date), 'yyyy-MM-dd')}
                    </td>
                    <td className="p-3 text-sm">
                      <Badge variant="outline">{snapshot.snapshot_type.replace('_', ' ')}</Badge>
                    </td>
                    <td className="p-3 text-sm text-right font-bold">
                      LKR {snapshot.total_inventory_value.toFixed(2)}
                    </td>
                    <td className="p-3 text-sm text-right">
                      LKR {snapshot.raw_materials_value.toFixed(2)}
                    </td>
                    <td className="p-3 text-sm text-right">
                      LKR {snapshot.finished_goods_value.toFixed(2)}
                    </td>
                    <td className="p-3 text-sm text-right">
                      LKR {snapshot.assets_value.toFixed(2)}
                    </td>
                    <td className="p-3 text-sm text-center">{snapshot.item_count}</td>
                    <td className="p-3 text-sm">
                      {format(new Date(snapshot.created_at), 'yyyy-MM-dd HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {snapshots.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No snapshots created yet. Create your first snapshot to track inventory value over time.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <CreateSnapshotDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </>
  );
}
