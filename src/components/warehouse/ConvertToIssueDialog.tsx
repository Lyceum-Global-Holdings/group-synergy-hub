import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MaterialRequest, MaterialRequestItem } from "@/types/materialIssueReturn";
import { useMaterialIssues } from "@/hooks/useMaterialIssues";
import { useMaterialIssueItems } from "@/hooks/useMaterialIssueItems";
import { useMaterialRequests } from "@/hooks/useMaterialRequests";
import { useMaterialRequestItems } from "@/hooks/useMaterialRequestItems";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface ConvertToIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: MaterialRequest;
  items: MaterialRequestItem[];
}

interface IssueItem extends MaterialRequestItem {
  quantity_to_issue: number;
}

export function ConvertToIssueDialog({ open, onOpenChange, request, items }: ConvertToIssueDialogProps) {
  const [issueItems, setIssueItems] = useState<IssueItem[]>(
    items.map(item => ({
      ...item,
      quantity_to_issue: item.quantity_approved || item.quantity_requested,
    }))
  );
  const [notes, setNotes] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  
  const { createMaterialIssueAsync } = useMaterialIssues();
  const { createItems: createIssueItems } = useMaterialIssueItems();
  const { updateRequest } = useMaterialRequests();
  const queryClient = useQueryClient();

  const handleQuantityChange = (index: number, value: number) => {
    const updatedItems = [...issueItems];
    updatedItems[index].quantity_to_issue = value;
    setIssueItems(updatedItems);
  };

  const handleConvert = async () => {
    if (isConverting) return;
    setIsConverting(true);
    try {
      // Create Material Issue Note
      const newIssue = await createMaterialIssueAsync({
        issue_date: new Date().toISOString().split('T')[0],
        issued_to: request.requested_by,
        department: request.department || undefined,
        purpose: request.purpose,
        notes: notes || `Issued from Material Request: ${request.request_number}`,
        requested_by: request.requested_by,
        contact_number: request.contact_number || undefined,
        epf_number: request.epf_number || undefined,
        items_required_date: request.items_required_date,
        job_number: request.job_number || undefined,
        location_id: request.location_id || undefined,
      });

      if (newIssue) {
        // Create Material Issue Items
        await createIssueItems(issueItems.map((item, index) => ({
          min_id: newIssue.id,
          item_id: item.item_id,
          quantity_issued: item.quantity_to_issue,
          line_number: index + 1,
          item_code: item.item_code || undefined,
          description: item.description || undefined,
          unit_of_measure: item.unit_of_measure,
          purpose: item.purpose || undefined,
          notes: item.notes || undefined,
        })));

        // Update material_request_items with quantity_issued and issued_at
        for (const item of issueItems) {
          await supabase
            .from('material_request_items')
            .update({
              quantity_issued: item.quantity_to_issue,
              issued_at: new Date().toISOString(),
            })
            .eq('id', item.id);
        }

        // Update request to link to MIN and mark as issued
        updateRequest({
          id: request.id,
          min_id: newIssue.id,
          status: 'issued',
        });

        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ['material-requests'] });
        queryClient.invalidateQueries({ queryKey: ['material-request-items', request.id] });
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Error converting request to issue:", error);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Issue Materials - {request.request_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg text-sm space-y-1">
            <div><strong>Requested By:</strong> {request.requested_by}</div>
            <div><strong>Location:</strong> {(request as any).warehouse_locations?.name || "N/A"}</div>
            <div><strong>Purpose:</strong> {request.purpose}</div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Items to Issue</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Review and adjust quantities if needed before issuing materials.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead>Qty to Issue</TableHead>
                  <TableHead>UOM</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issueItems.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.item_code}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.quantity_requested}</TableCell>
                    <TableCell>{item.quantity_approved || item.quantity_requested}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.quantity_to_issue}
                        onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)}
                        className="w-24"
                        min="0"
                        step="0.01"
                      />
                    </TableCell>
                    <TableCell>{item.unit_of_measure}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div>
            <Label htmlFor="issue_notes">Additional Notes</Label>
            <Textarea
              id="issue_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes for the material issue"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={isConverting}>
            {isConverting ? "Issuing..." : "Issue Materials"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
