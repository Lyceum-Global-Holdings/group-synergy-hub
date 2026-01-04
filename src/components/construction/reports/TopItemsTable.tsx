import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { TopItem } from "@/hooks/construction/useItemMasterAnalytics";

interface TopItemsTableProps {
  data: TopItem[];
  isLoading: boolean;
}

export function TopItemsTable({ data, isLoading }: TopItemsTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Items by Stock Quantity</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Items by Stock Quantity</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px]">
          <p className="text-muted-foreground">No items found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Items by Stock Quantity</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>Item Code</TableHead>
              <TableHead>Item Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Stock Qty</TableHead>
              <TableHead>Unit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell className="font-mono text-sm">{item.itemCode}</TableCell>
                <TableCell>{item.itemName}</TableCell>
                <TableCell>{item.categoryName}</TableCell>
                <TableCell className="text-right font-semibold">
                  {item.currentStock.toLocaleString()}
                </TableCell>
                <TableCell className="text-muted-foreground">{item.unit}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
