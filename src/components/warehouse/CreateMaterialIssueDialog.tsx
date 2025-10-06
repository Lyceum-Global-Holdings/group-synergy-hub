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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2 } from 'lucide-react';
import { useMaterialIssues } from '@/hooks/useMaterialIssues';
import { ItemSelector } from '@/components/common/ItemSelector';
import { useWarehouseItems } from '@/hooks/useWarehouseItems';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface MaterialIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface IssueItem {
  item_id: string;
  item_code: string;
  description: string;
  unit_of_measure: string;
  quantity_required: number;
  purpose: string;
}

export function CreateMaterialIssueDialog({ open, onOpenChange }: MaterialIssueDialogProps) {
  const [currentTab, setCurrentTab] = useState('header');
  const [formData, setFormData] = useState({
    requested_by: '',
    contact_number: '',
    epf_number: '',
    department: '',
    job_number: '',
    issue_date: new Date().toISOString().split('T')[0],
    items_required_date: new Date().toISOString().split('T')[0],
    purpose: '',
    pr_number: '',
    po_number: '',
    notes: '',
  });

  const [items, setItems] = useState<IssueItem[]>([]);
  const [currentItem, setCurrentItem] = useState<Partial<IssueItem>>({});

  const { items: warehouseItems } = useWarehouseItems();
  const { createMaterialIssueAsync, isCreating } = useMaterialIssues();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleItemSelect = (item: any) => {
    if (item && item.id) {
      setCurrentItem({
        item_id: item.id,
        item_code: item.item_code,
        description: item.description || item.item_name,
        unit_of_measure: item.unit_of_measure,
        quantity_required: 1,
        purpose: '',
      });
    }
  };

  const addItem = () => {
    if (currentItem.item_id && currentItem.quantity_required) {
      setItems([...items, currentItem as IssueItem]);
      setCurrentItem({});
    }
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!formData.requested_by || items.length === 0) return;

    try {
      const issueNote = await createMaterialIssueAsync({
        issue_date: formData.issue_date,
        issued_to: formData.requested_by,
        department: formData.department || undefined,
        purpose: formData.purpose || undefined,
        notes: formData.notes || undefined,
        requested_by: formData.requested_by,
        contact_number: formData.contact_number || undefined,
        epf_number: formData.epf_number || undefined,
        items_required_date: formData.items_required_date,
        job_number: formData.job_number || undefined,
        pr_number: formData.pr_number || undefined,
        po_number: formData.po_number || undefined,
      });

      // TODO: Add items to the issue note

      // Reset form
      setFormData({
        requested_by: '',
        contact_number: '',
        epf_number: '',
        department: '',
        job_number: '',
        issue_date: new Date().toISOString().split('T')[0],
        items_required_date: new Date().toISOString().split('T')[0],
        purpose: '',
        pr_number: '',
        po_number: '',
        notes: '',
      });
      setItems([]);
      setCurrentTab('header');
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating material issue:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Material Issue Note</DialogTitle>
          <DialogDescription>
            Fill in the material requisition details in three steps
          </DialogDescription>
        </DialogHeader>

        <Tabs value={currentTab} onValueChange={setCurrentTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="header">Header Info</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="review">Review</TabsTrigger>
          </TabsList>

          <TabsContent value="header" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="requested_by">Requested By *</Label>
                <Input
                  id="requested_by"
                  value={formData.requested_by}
                  onChange={(e) => handleInputChange('requested_by', e.target.value)}
                  placeholder="Name of requester"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  placeholder="Department name"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_number">Contact Number</Label>
                <Input
                  id="contact_number"
                  value={formData.contact_number}
                  onChange={(e) => handleInputChange('contact_number', e.target.value)}
                  placeholder="Phone number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="epf_number">EPF Number</Label>
                <Input
                  id="epf_number"
                  value={formData.epf_number}
                  onChange={(e) => handleInputChange('epf_number', e.target.value)}
                  placeholder="Employee EPF number"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="job_number">Job Number</Label>
                <Input
                  id="job_number"
                  value={formData.job_number}
                  onChange={(e) => handleInputChange('job_number', e.target.value)}
                  placeholder="Job/Project reference"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issue_date">Date of Request</Label>
                <Input
                  id="issue_date"
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => handleInputChange('issue_date', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="items_required_date">Items Required Date</Label>
                <Input
                  id="items_required_date"
                  type="date"
                  value={formData.items_required_date}
                  onChange={(e) => handleInputChange('items_required_date', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr_number">PR Number (if any)</Label>
                <Input
                  id="pr_number"
                  value={formData.pr_number}
                  onChange={(e) => handleInputChange('pr_number', e.target.value)}
                  placeholder="Purchase requisition number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose of Requisition *</Label>
              <Textarea
                id="purpose"
                value={formData.purpose}
                onChange={(e) => handleInputChange('purpose', e.target.value)}
                placeholder="Describe the purpose of this requisition"
                rows={3}
                required
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setCurrentTab('items')}>
                Next: Add Items
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="items" className="space-y-4">
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold">Add Item</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Select Item *</Label>
                  <ItemSelector
                    value={currentItem.item_id || ''}
                    onSelect={handleItemSelect}
                    placeholder="Search for item..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantity Required *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={currentItem.quantity_required || ''}
                    onChange={(e) => setCurrentItem({ ...currentItem, quantity_required: parseFloat(e.target.value) })}
                    placeholder="Enter quantity"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Item Code</Label>
                  <Input value={currentItem.item_code || ''} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Unit of Measure</Label>
                  <Input value={currentItem.unit_of_measure || ''} disabled />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={currentItem.description || ''} disabled />
              </div>

              <div className="space-y-2">
                <Label>Purpose (for this item)</Label>
                <Input
                  value={currentItem.purpose || ''}
                  onChange={(e) => setCurrentItem({ ...currentItem, purpose: e.target.value })}
                  placeholder="Specific purpose for this item"
                />
              </div>

              <Button onClick={addItem} disabled={!currentItem.item_id || !currentItem.quantity_required}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            {items.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Line</TableHead>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>UOM</TableHead>
                      <TableHead>Qty Required</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{item.item_code}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{item.unit_of_measure}</TableCell>
                        <TableCell>{item.quantity_required}</TableCell>
                        <TableCell>{item.purpose || '-'}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentTab('header')}>
                Back
              </Button>
              <Button onClick={() => setCurrentTab('review')} disabled={items.length === 0}>
                Next: Review
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="review" className="space-y-4">
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-lg">Header Information</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="font-medium">Requested By:</span> {formData.requested_by}</div>
                <div><span className="font-medium">Department:</span> {formData.department}</div>
                <div><span className="font-medium">Contact:</span> {formData.contact_number || '-'}</div>
                <div><span className="font-medium">EPF:</span> {formData.epf_number || '-'}</div>
                <div><span className="font-medium">Job Number:</span> {formData.job_number || '-'}</div>
                <div><span className="font-medium">Request Date:</span> {formData.issue_date}</div>
                <div><span className="font-medium">Required Date:</span> {formData.items_required_date}</div>
                <div><span className="font-medium">PR Number:</span> {formData.pr_number || '-'}</div>
              </div>
              <div>
                <span className="font-medium">Purpose:</span>
                <p className="text-sm mt-1">{formData.purpose}</p>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Line</TableHead>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead>Qty Required</TableHead>
                    <TableHead>Purpose</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{item.item_code}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.unit_of_measure}</TableCell>
                      <TableCell>{item.quantity_required}</TableCell>
                      <TableCell>{item.purpose || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentTab('items')}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Material Issue Note'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
