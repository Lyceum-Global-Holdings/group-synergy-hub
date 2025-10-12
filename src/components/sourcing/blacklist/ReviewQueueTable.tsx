import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Flag } from "lucide-react";
import { ConductReviewDialog } from "./ConductReviewDialog";
import { format } from "date-fns";

interface ReviewQueueTableProps {
  data: any[];
  isLoading: boolean;
}

export function ReviewQueueTable({ data, isLoading }: ReviewQueueTableProps) {
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);

  const handleConductReview = (entry: any) => {
    setSelectedEntry(entry);
    setShowReviewDialog(true);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading review queue...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Blacklisted Date</TableHead>
              <TableHead>Review Due Date</TableHead>
              <TableHead>Days Overdue</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No pending reviews
                </TableCell>
              </TableRow>
            ) : (
              data.map((entry) => {
                const daysOverdue = Math.floor(
                  (new Date().getTime() - new Date(entry.next_review_date).getTime()) / (1000 * 60 * 60 * 24)
                );
                
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {entry.suppliers?.name || "Unknown Supplier"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.status === 'blacklisted' ? 'destructive' : 'default'}>
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(entry.blacklisted_date), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(entry.next_review_date), "MMM d, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={daysOverdue > 7 ? "destructive" : "default"}>
                        {daysOverdue} days
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => handleConductReview(entry)}>
                        <Flag className="h-4 w-4 mr-2" />
                        Conduct Review
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {selectedEntry && (
        <ConductReviewDialog
          open={showReviewDialog}
          onOpenChange={setShowReviewDialog}
          blacklistEntry={selectedEntry}
        />
      )}
    </div>
  );
}
