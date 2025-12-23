import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMaterialIssues } from '@/hooks/useMaterialIssues';
import { MaterialIssueNote } from '@/types/materialIssueReturn';

interface MaterialIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingIssue?: MaterialIssueNote | null;
}

export function MaterialIssueDialog({ open, onOpenChange, editingIssue }: MaterialIssueDialogProps) {
  const [formData, setFormData] = useState({
    issue_date: new Date().toISOString().split('T')[0],
    issued_to: '',
    department: '',
    purpose: '',
    notes: '',
  });

  const { createMaterialIssue, isCreating } = useMaterialIssues();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.issued_to.trim()) {
      return;
    }

    try {
      await createMaterialIssue({
        issue_date: formData.issue_date,
        issued_to: formData.issued_to.trim(),
        department: formData.department.trim() || undefined,
        purpose: formData.purpose.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      });
      
      // Reset form
      setFormData({
        issue_date: new Date().toISOString().split('T')[0],
        issued_to: '',
        department: '',
        purpose: '',
        notes: '',
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating material issue:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingIssue ? 'Edit Material Issue' : 'Create New Material Issue'}
          </DialogTitle>
          <DialogDescription>
            {editingIssue 
              ? 'Update the material issue details below.'
              : 'Fill in the details to create a new material issue note.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="issue_date">Issue Date</Label>
              <Input
                id="issue_date"
                type="date"
                value={formData.issue_date}
                onChange={(e) => handleInputChange('issue_date', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issued_to">Issued To *</Label>
              <Input
                id="issued_to"
                value={formData.issued_to}
                onChange={(e) => handleInputChange('issued_to', e.target.value)}
                placeholder="Person/Department name"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              value={formData.department}
              onChange={(e) => handleInputChange('department', e.target.value)}
              placeholder="Enter department (optional)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose</Label>
            <Input
              id="purpose"
              value={formData.purpose}
              onChange={(e) => handleInputChange('purpose', e.target.value)}
              placeholder="Purpose of material issue (optional)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Additional notes (optional)"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : editingIssue ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}