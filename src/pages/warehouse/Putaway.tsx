import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, Package, ArrowRightLeft } from 'lucide-react';
import { usePutawayRecords } from '@/hooks/usePutaway';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { CreatePutawayDialog } from '@/components/warehouse/CreatePutawayDialog';
import { PutawayDetailsDialog } from '@/components/warehouse/PutawayDetailsDialog';

export default function Putaway() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedPutawayId, setSelectedPutawayId] = useState<string | null>(null);

  const { data: pendingPutaways = [], isLoading: loadingPending } = usePutawayRecords('pending');
  const { data: inProgressPutaways = [], isLoading: loadingInProgress } = usePutawayRecords('in_progress');
  const { data: completedPutaways = [], isLoading: loadingCompleted } = usePutawayRecords('completed');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500';
      case 'in_progress':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const handleViewDetails = (id: string) => {
    setSelectedPutawayId(id);
    setDetailsDialogOpen(true);
  };

  const renderPutawayTable = (putaways: any[], isLoading: boolean) => {
    if (isLoading) {
      return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
    }

    if (!putaways.length) {
      return <div className="text-center py-8 text-muted-foreground">No putaways found</div>;
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Putaway #</TableHead>
            <TableHead>GRN Reference</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Putaway Date</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {putaways.map((putaway) => (
            <TableRow key={putaway.id}>
              <TableCell className="font-medium">{putaway.putaway_number}</TableCell>
              <TableCell>{putaway.grn_number || '-'}</TableCell>
              <TableCell>
                <Badge className={getStatusColor(putaway.status)}>
                  {putaway.status.replace('_', ' ')}
                </Badge>
              </TableCell>
              <TableCell>{format(new Date(putaway.putaway_date), 'dd/MM/yyyy')}</TableCell>
              <TableCell>{putaway.assigned_to || '-'}</TableCell>
              <TableCell className="max-w-xs truncate">{putaway.notes || '-'}</TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewDetails(putaway.id)}
                >
                  View Details
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Putaway / Bin Transfer</h1>
          <p className="text-muted-foreground">
            Manage warehouse putaway operations and bin transfers
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Putaway
          </Button>
        </div>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Pending ({pendingPutaways.length})
          </TabsTrigger>
          <TabsTrigger value="in-progress" className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            In Progress ({inProgressPutaways.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Completed ({completedPutaways.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card className="p-6">
            {renderPutawayTable(pendingPutaways, loadingPending)}
          </Card>
        </TabsContent>

        <TabsContent value="in-progress">
          <Card className="p-6">
            {renderPutawayTable(inProgressPutaways, loadingInProgress)}
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card className="p-6">
            {renderPutawayTable(completedPutaways, loadingCompleted)}
          </Card>
        </TabsContent>
      </Tabs>

      <CreatePutawayDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {selectedPutawayId && (
        <PutawayDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          putawayId={selectedPutawayId}
        />
      )}
    </div>
  );
}
