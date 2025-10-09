import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useJournalEntries } from "@/hooks/useJournalEntries";
import { DataTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import type { JournalEntry } from "@/types/generalLedger";
import { format } from "date-fns";
import { CreateJournalEntryWizard } from "./CreateJournalEntryWizard";
import { JournalEntryDetailsDialog } from "./JournalEntryDetailsDialog";

export function JournalEntriesTab() {
  const { journalEntries, isLoading } = useJournalEntries();
  const [searchQuery, setSearchQuery] = useState("");
  const [showJournalWizard, setShowJournalWizard] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const columns: ColumnDef<JournalEntry>[] = [
    {
      accessorKey: "journal_number",
      header: "JE Number",
      cell: ({ row }) => (
        <button 
          onClick={() => {
            setSelectedEntry(row.original);
            setShowDetailsDialog(true);
          }}
          className="font-mono font-medium hover:text-primary hover:underline"
        >
          {row.original.journal_number}
        </button>
      ),
    },
    {
      accessorKey: "journal_date",
      header: "Date",
      cell: ({ row }) => format(new Date(row.original.journal_date), "MMM dd, yyyy"),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <div className="max-w-md truncate">{row.original.description}</div>
      ),
    },
    {
      accessorKey: "total_debit",
      header: "Debit",
      cell: ({ row }) => (
        <div className="text-right font-medium">
          {new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "LKR",
          }).format(row.original.total_debit)}
        </div>
      ),
    },
    {
      accessorKey: "total_credit",
      header: "Credit",
      cell: ({ row }) => (
        <div className="text-right font-medium">
          {new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "LKR",
          }).format(row.original.total_credit)}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const statusColors = {
          draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
          posted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
          void: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
          reversed: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
        };
        return (
          <Badge className={statusColors[row.original.status]}>
            {row.original.status.toUpperCase()}
          </Badge>
        );
      },
    },
  ];

  const filteredEntries = journalEntries?.filter(
    (entry) =>
      entry.journal_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search journal entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button size="sm" onClick={() => setShowJournalWizard(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Journal Entry
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Entries</div>
          <div className="text-2xl font-bold mt-1">{journalEntries?.length || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Draft</div>
          <div className="text-2xl font-bold mt-1 text-yellow-600">
            {journalEntries?.filter((e) => e.status === "draft").length || 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Posted</div>
          <div className="text-2xl font-bold mt-1 text-green-600">
            {journalEntries?.filter((e) => e.status === "posted").length || 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">This Month</div>
          <div className="text-2xl font-bold mt-1">
            {journalEntries?.filter((e) => {
              const entryDate = new Date(e.journal_date);
              const now = new Date();
              return (
                entryDate.getMonth() === now.getMonth() &&
                entryDate.getFullYear() === now.getFullYear()
              );
            }).length || 0}
          </div>
        </Card>
      </div>

      {/* Data Table */}
      <Card className="p-6">
        <div className="cursor-pointer">
          <DataTable
            columns={columns}
            data={filteredEntries || []}
            isLoading={isLoading}
          />
        </div>
      </Card>

      <CreateJournalEntryWizard
        open={showJournalWizard}
        onOpenChange={setShowJournalWizard}
      />

      {selectedEntry && (
        <JournalEntryDetailsDialog
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
          journalEntry={selectedEntry}
        />
      )}
    </div>
  );
}
