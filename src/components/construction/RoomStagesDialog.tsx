import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, ListChecks, Circle, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { FloorDrawingRoom, FloorRoomStage, RoomStageStatus, ROOM_STAGE_STATUSES } from '@/types/construction';
import { useRoomStages, useCreateRoomStage, useUpdateRoomStage, useDeleteRoomStage, useAddDefaultStages } from '@/hooks/construction/useRoomStages';

interface RoomStagesDialogProps {
  room: FloorDrawingRoom | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoomStagesDialog({ room, open, onOpenChange }: RoomStagesDialogProps) {
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageDescription, setNewStageDescription] = useState('');

  const { data: stages = [], isLoading } = useRoomStages(room?.id || null);
  const createStage = useCreateRoomStage();
  const updateStage = useUpdateRoomStage();
  const deleteStage = useDeleteRoomStage();
  const addDefaultStages = useAddDefaultStages();

  const completedStages = stages.filter(s => s.status === 'completed').length;
  const totalStages = stages.length;
  const overallProgress = totalStages > 0 
    ? Math.round(stages.reduce((sum, s) => sum + (s.completion_percentage || 0), 0) / totalStages)
    : 0;

  const handleAddStage = () => {
    if (!room || !newStageName.trim()) return;
    
    createStage.mutate({
      room_id: room.id,
      stage_name: newStageName.trim(),
      description: newStageDescription.trim() || undefined,
      stage_order: stages.length + 1,
    }, {
      onSuccess: () => {
        setNewStageName('');
        setNewStageDescription('');
        setIsAddingStage(false);
      },
    });
  };

  const handleAddDefaultStages = () => {
    if (!room) return;
    addDefaultStages.mutate({ room_id: room.id });
  };

  const handleStatusChange = (stage: FloorRoomStage, newStatus: RoomStageStatus) => {
    updateStage.mutate({
      id: stage.id,
      room_id: stage.room_id,
      status: newStatus,
    });
  };

  const handleProgressChange = (stage: FloorRoomStage, percentage: number) => {
    updateStage.mutate({
      id: stage.id,
      room_id: stage.room_id,
      completion_percentage: percentage,
      status: percentage === 100 ? 'completed' : percentage > 0 ? 'in_progress' : 'pending',
    });
  };

  const handleDeleteStage = (stage: FloorRoomStage) => {
    deleteStage.mutate({ id: stage.id, room_id: stage.room_id });
  };

  const getStatusIcon = (status: RoomStageStatus) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'blocked': return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadgeClass = (status: RoomStageStatus) => {
    const statusConfig = ROOM_STAGE_STATUSES.find(s => s.value === status);
    return statusConfig?.color || 'bg-muted text-muted-foreground';
  };

  if (!room) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Room Stages - {room.room_name}
          </DialogTitle>
        </DialogHeader>

        {/* Overall Progress */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-muted-foreground">
              {completedStages}/{totalStages} stages completed
            </span>
          </div>
          <Progress value={overallProgress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1 text-right">{overallProgress}%</p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddDefaultStages}
            disabled={addDefaultStages.isPending || stages.length > 0}
          >
            <ListChecks className="h-4 w-4 mr-2" />
            Add Default Stages
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddingStage(true)}
            disabled={isAddingStage}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Stage
          </Button>
        </div>

        {/* Add New Stage Form */}
        {isAddingStage && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <Input
              placeholder="Stage name"
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
            />
            <Textarea
              placeholder="Description (optional)"
              value={newStageDescription}
              onChange={(e) => setNewStageDescription(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setIsAddingStage(false)}>
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleAddStage}
                disabled={!newStageName.trim() || createStage.isPending}
              >
                Add Stage
              </Button>
            </div>
          </div>
        )}

        {/* Stages List */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-3 pr-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading stages...</p>
            ) : stages.length === 0 ? (
              <div className="text-center py-8">
                <ListChecks className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No stages defined yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click "Add Default Stages" to get started with common construction stages.
                </p>
              </div>
            ) : (
              stages.map((stage) => (
                <div
                  key={stage.id}
                  className="border rounded-lg p-4 space-y-3 bg-background"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      {getStatusIcon(stage.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {stage.stage_order}. {stage.stage_name}
                          </span>
                          <Badge variant="secondary" className={`text-xs ${getStatusBadgeClass(stage.status)}`}>
                            {ROOM_STAGE_STATUSES.find(s => s.value === stage.status)?.label}
                          </Badge>
                        </div>
                        {stage.description && (
                          <p className="text-xs text-muted-foreground mt-1">{stage.description}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteStage(stage)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                      <Select
                        value={stage.status}
                        onValueChange={(value) => handleStatusChange(stage, value as RoomStageStatus)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROOM_STAGE_STATUSES.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Progress: {stage.completion_percentage || 0}%
                      </label>
                      <Input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={stage.completion_percentage || 0}
                        onChange={(e) => handleProgressChange(stage, parseInt(e.target.value))}
                        className="h-8"
                      />
                    </div>
                  </div>

                  <Progress value={stage.completion_percentage || 0} className="h-1.5" />
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
