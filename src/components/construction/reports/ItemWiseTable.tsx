import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ItemSummary } from "@/hooks/construction/useSiteReportAnalytics";
import { ArrowUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ItemWiseTableProps {
  data: ItemSummary[];
  isLoading?: boolean;
}

type SortField = 'itemCode' | 'itemName' | 'issued' | 'returned' | 'net';
type SortDirection = 'asc' | 'desc';

export function ItemWiseTable({ data, isLoading }: ItemWiseTableProps) {
  const [sortField, setSortField] = useState<SortField>('itemName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchTerm, setSearchTerm] = useState('');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(
      (item) =>
        item.itemName.toLowerCase().includes(term) ||
        item.itemCode.toLowerCase().includes(term)
    );
  }, [data, searchTerm]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case 'itemCode':
          aVal = a.itemCode;
          bVal = b.itemCode;
          break;
        case 'itemName':
          aVal = a.itemName;
          bVal = b.itemName;
          break;
        case 'issued':
          aVal = a.issued;
          bVal = b.issued;
          break;
        case 'returned':
          aVal = a.returned;
          bVal = b.returned;
          break;
        case 'net':
          aVal = a.issued - a.returned;
          bVal = b.issued - b.returned;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [filteredData, sortField, sortDirection]);

  const formatNumber = (num: number) => num.toLocaleString();

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Item-wise Data</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Item-wise Data</CardTitle>
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border max-h-[400px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead><SortButton field="itemCode">Item Code</SortButton></TableHead>
                <TableHead><SortButton field="itemName">Item Name</SortButton></TableHead>
                <TableHead className="text-right"><SortButton field="issued">Issued</SortButton></TableHead>
                <TableHead className="text-right"><SortButton field="returned">Returned</SortButton></TableHead>
                <TableHead className="text-right"><SortButton field="net">Net</SortButton></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {searchTerm ? 'No items match your search' : 'No item data available for the selected period'}
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((item) => (
                  <TableRow key={item.itemId}>
                    <TableCell className="font-mono text-sm">{item.itemCode}</TableCell>
                    <TableCell className="font-medium">{item.itemName}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.issued)}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.returned)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(item.issued - item.returned)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {sortedData.length > 0 && (
          <p className="text-sm text-muted-foreground mt-2">
            Showing {sortedData.length} of {data.length} items
          </p>
        )}
      </CardContent>
    </Card>
  );
}