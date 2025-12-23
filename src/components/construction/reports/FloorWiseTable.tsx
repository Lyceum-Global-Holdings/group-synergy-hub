import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FloorSummary } from "@/hooks/construction/useSiteReportAnalytics";
import { ArrowUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface FloorWiseTableProps {
  data: FloorSummary[];
  isLoading?: boolean;
}

type SortField = 'floorName' | 'issued' | 'returned' | 'net';
type SortDirection = 'asc' | 'desc';

export function FloorWiseTable({ data, isLoading }: FloorWiseTableProps) {
  const [sortField, setSortField] = useState<SortField>('floorName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    let aVal: number | string;
    let bVal: number | string;

    switch (sortField) {
      case 'floorName':
        aVal = a.floorName;
        bVal = b.floorName;
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
          <CardTitle>Floor-wise Data</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Floor-wise Data</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortButton field="floorName">Floor Name</SortButton></TableHead>
                <TableHead className="text-right"><SortButton field="issued">Issued</SortButton></TableHead>
                <TableHead className="text-right"><SortButton field="returned">Returned</SortButton></TableHead>
                <TableHead className="text-right"><SortButton field="net">Net</SortButton></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No floor data available for the selected period
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((floor) => (
                  <TableRow key={floor.floorId}>
                    <TableCell className="font-medium">{floor.floorName}</TableCell>
                    <TableCell className="text-right">{formatNumber(floor.issued)}</TableCell>
                    <TableCell className="text-right">{formatNumber(floor.returned)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(floor.issued - floor.returned)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}